import {
    Entity,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
} from "typeorm"
import { SafeVersionColumn } from "@shared/core/decorators/safe-version-column"
import type { User } from "@features/user/domain/user.entity"
import type { Script } from "@features/script/domain/script.entity"
import { AggregateRoot } from "@shared/core/aggregate-root"
import { ValidationException } from "@shared/core/exceptions/domain-exceptions"
import { AssessmentCreatedEvent } from "./events/assessment-created.event"
import { AssessmentAnalyzingEvent } from "./events/assessment-analyzing.event"
import { AssessmentCompletedEvent } from "./events/assessment-completed.event"
import { AssessmentFailedEvent } from "./events/assessment-failed.event"
import type { IAnalysisFeedback } from "./analysis-feedback.interface"
import type { AIAnalysisResult } from "./ai-analysis-result.interface"

export enum AssessmentStatus {
    PENDING = "PENDING", // 업로드 완료, 분석 대기
    ANALYZING = "ANALYZING", // 분석 중 (AI 서버 처리 중)
    COMPLETED = "COMPLETED", // 분석 완료
    FAILED = "FAILED", // 분석 실패 (재시도 가능)
    MAX_RETRY_EXCEEDED = "MAX_RETRY_EXCEEDED", // 재시도 횟수 초과
}

/**
 * Assessment Entity (Aggregate Root)
 *
 * 음성 진단 Aggregate
 * - 오디오 파일 업로드 및 분석 상태 관리
 * - AI 분석 결과 저장
 * - Domain Events 발행 (이벤트 기반 아키텍처)
 */
@Entity("assessments")
@Index(["userId"])
@Index(["status"])
@Index(["createdAt"])
@Index(["userId", "status"])
@Index(["status", "updatedAt"])
@Index(["userId", "status", "createdAt"])
@Index(["userId", "createdAt"])
export class Assessment extends AggregateRoot {
    static readonly MAX_RETRIES = 3

    /** 분석 시작 가능한 상태 집합 */
    private static readonly ANALYZABLE_STATUSES = new Set([
        AssessmentStatus.PENDING,
        AssessmentStatus.FAILED,
        AssessmentStatus.ANALYZING,
    ])

    @SafeVersionColumn()
    version: number


    @Column({ length: 500 })
    audioUrl: string

    @Column({ type: "int", default: 0 })
    duration: number // 발화 시간 (초)


    @Column({ type: "text", nullable: true })
    transcribedText: string // AI가 transcribe한 텍스트

    @ManyToOne("Script", { onDelete: "SET NULL" })
    @JoinColumn({ name: "scriptId" })
    script: Script

    @Column({ type: "int", nullable: true })
    scriptId: number | null


    @Column({
        type: "simple-enum",
        enum: AssessmentStatus,
        default: AssessmentStatus.PENDING,
    })
    status: AssessmentStatus

    @Column({ type: "int", default: 0 })
    retryCount: number

    @Column({ type: "text", nullable: true })
    lastError: string | null


    @Column({ type: "float", nullable: true })
    score: number // 발음 점수 (0~100)

    @Column({ type: "simple-json", nullable: true })
    feedback: IAnalysisFeedback | null // 상세 피드백

    @Column({ type: "simple-json", nullable: true })
    pitchData: { t: number; f0: number }[] | null // Pitch 데이터

    @Column({ type: "float", nullable: true })
    speakingRate: number | null // 말하기 속도 (Syllables Per Minute)

    // 스크립트 스냅샷 (삭제 대비 — 생성 시점 스크립트 정보 보존)
    @Column({ type: "simple-json", nullable: true })
    scriptSnapshot: { title: string; content: string; difficulty: string } | null


    @ManyToOne("User", { onDelete: "CASCADE", nullable: true })
    @JoinColumn({ name: "userId" })
    user: User

    @Column({ nullable: true })
    userId: number | null


    static create(
        userId: number,
        audioUrl: string,
        duration: number,
        scriptId?: number
    ): Assessment {
        const assessment = new Assessment()
        assessment.userId = userId
        assessment.audioUrl = audioUrl
        assessment.duration = duration
        assessment.scriptId = scriptId ?? null
        assessment.status = AssessmentStatus.PENDING
        assessment.retryCount = 0

        return assessment
    }

    /**
     * Assessment 생성 이벤트 발행 (ID 할당 후 호출)
     */
    emitCreatedEvent(): void {
        this.addDomainEvent(
            new AssessmentCreatedEvent(
                this.id,
                this.userId,
                this.audioUrl,
                this.duration
            )
        )
    }

    startAnalysis(): void {
        this.ensureCanStartAnalysis()

        // 이미 ANALYZING 상태면 중복 호출 — retryCount 증가 방지 (레이스 컨디션 방어)
        if (this.status !== AssessmentStatus.ANALYZING) {
            this.retryCount++
        }
        this.status = AssessmentStatus.ANALYZING

        // Domain Event 발행
        this.addDomainEvent(
            new AssessmentAnalyzingEvent(
                this.id,
                this.userId,
                this.audioUrl,
                this.retryCount
            )
        )
    }

    /**
     * 분석 완료
     */
    completeAnalysis(result: {
        score: number
        transcribedText: string
        feedback: IAnalysisFeedback
        pitchData?: { t: number; f0: number }[]
        speakingRate?: number
    }): void {
        if (this.status !== AssessmentStatus.ANALYZING) {
            throw new ValidationException(
                "assessment.invalid_status_for_completion",
                "INVALID_ASSESSMENT_STATUS",
                { currentStatus: this.status }
            )
        }

        this.status = AssessmentStatus.COMPLETED
        this.score = result.score
        this.transcribedText = result.transcribedText
        this.feedback = result.feedback
        this.pitchData = result.pitchData ?? null
        this.speakingRate = result.speakingRate ?? null
        this.lastError = null

        // Domain Event 발행
        this.addDomainEvent(
            new AssessmentCompletedEvent(this.id, this.userId, result.score, result.transcribedText)
        )
    }

    /**
     * 분석 실패
     */
    failAnalysis(error: string, maxRetries: number = Assessment.MAX_RETRIES): void {
        this.lastError = error

        if (this.retryCount >= maxRetries) {
            this.status = AssessmentStatus.MAX_RETRY_EXCEEDED
        } else {
            this.status = AssessmentStatus.FAILED
        }

        // Domain Event 발행
        this.addDomainEvent(
            new AssessmentFailedEvent(
                this.id,
                this.userId,
                error,
                this.retryCount,
                this.status === AssessmentStatus.MAX_RETRY_EXCEEDED
            )
        )
    }

    /**
     * 자동 재시도 대상 여부 — FAILED 상태일 때만 true (MAX_RETRY_EXCEEDED는 제외)
     */
    shouldAutoRetry(): boolean {
        return this.status === AssessmentStatus.FAILED
    }

    /**
     * 재시도 가능 여부
     */
    canRetry(): boolean {
        // FAILED, MAX_RETRY_EXCEEDED 상태라면 재시도 가능하도록 완화
        return (
            this.status === AssessmentStatus.FAILED ||
            this.status === AssessmentStatus.MAX_RETRY_EXCEEDED ||
            this.status === AssessmentStatus.ANALYZING // 분석 중이더라도 강제 재시도 가능케 함
        )
    }

    /**
     * AI 분석 결과 적용 — 성공/실패 판정을 엔티티가 직접 수행
     */
    applyAnalysisResult(result: AIAnalysisResult): void {
        if (!result.success) {
            this.failAnalysis(result.message || "AI analysis failed")
            return
        }
        this.completeAnalysis({
            score: result.score ?? 0,
            transcribedText: result.transcribed_text ?? "",
            feedback: {
                similarity: result.similarity,
                alignment: result.alignment,
                fa_score: result.fa_score,
                phoneme_accuracy: result.phoneme_accuracy,
            },
            pitchData: result.pitch_data,
            speakingRate: result.speaking_rate,
        })
    }

    /** 분석 시작 가능 상태 가드 — 허용 상태 이외에서 호출 시 예외 */
    private ensureCanStartAnalysis(): void {
        if (!Assessment.ANALYZABLE_STATUSES.has(this.status)) {
            throw new ValidationException(
                "assessment.invalid_status_for_analysis",
                "INVALID_ASSESSMENT_STATUS",
                { currentStatus: this.status }
            )
        }
    }

}
