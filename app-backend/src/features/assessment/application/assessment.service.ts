import { injectable, inject } from "tsyringe"
import { Assessment } from "../domain/assessment.entity"
import { AssessmentRepository } from "../infrastructure/assessment.repository"
import {
    NotFoundException,
    ValidationException,
    ForbiddenException,
} from "@shared/core/exceptions/domain-exceptions"
import { IDomainEventDispatcher } from "@shared/core/domain-event-dispatcher.interface"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { DEFAULT_PAGE_LIMIT } from "@shared/core/constants/pagination.constants"
import { AssessmentAnalysisService } from "./assessment-analysis.service"
import type { IChapterProgressChecker } from "@features/script/domain/chapter-progress-checker.interface"
import type { IScriptProvider } from "@features/script/domain/script-provider.interface"

@injectable()
export class AssessmentService {
    constructor(
        @inject(AssessmentRepository) private assessmentRepository: AssessmentRepository,
        @inject(DI_TOKENS.IDomainEventDispatcher) private eventDispatcher: IDomainEventDispatcher,
        @inject(DI_TOKENS.ILogger) private logger: ILogger,
        @inject(AssessmentAnalysisService) private analysisService: AssessmentAnalysisService,
        @inject(DI_TOKENS.IChapterProgressChecker) private chapterProgressService: IChapterProgressChecker,
        @inject(DI_TOKENS.IScriptProvider) private scriptProvider: IScriptProvider
    ) {}

    /**
     * Assessment 생성 (오디오 업로드)
     *
     * 핵심 경로(AI 분석)는 직접 await — 실패 시 사용자에게 에러 전파
     * 부수 효과(로깅/통계)는 이벤트로 처리
     */
    async createAssessment(
        userId: number,
        audioUrl: string,
        duration: number,
        scriptId?: number
    ): Promise<Assessment> {
        // 챕터 접근 검증 (scriptId가 있을 때만)
        if (scriptId) {
            const unlocked = await this.chapterProgressService.isScriptUnlocked(
                userId,
                scriptId
            )
            if (!unlocked) {
                throw new ForbiddenException("chapter.script_not_unlocked")
            }
        }

        // Factory Method로 생성
        const assessment = Assessment.create(userId, audioUrl, duration, scriptId)

        // 스크립트 스냅샷 저장
        if (scriptId) {
            try {
                const script = await this.scriptProvider.getScript(scriptId)
                assessment.scriptSnapshot = {
                    title: script.title,
                    content: script.content,
                    difficulty: script.difficulty,
                }
            } catch (error: unknown) {
                // 스크립트를 못 찾아도 assessment 생성은 계속 진행
                this.logger.warn(
                    `[AssessmentService] 스크립트 스냅샷 조회 실패 scriptId=${scriptId}: ${error instanceof Error ? error.message : String(error)}`
                )
            }
        }

        // 저장
        const savedAssessment = await this.assessmentRepository.save(assessment)

        // 핵심 경로: 직접 await — 실패하면 사용자에게 에러 전파
        await this.analysisService.analyzeAssessment(savedAssessment.id)

        // 부수 효과: 이벤트 (로깅, 통계 등 비핵심)
        savedAssessment.emitCreatedEvent()
        this.eventDispatcher.publishFromAggregate(savedAssessment)

        return savedAssessment
    }

    async getAssessment(assessmentId: number, userId?: number): Promise<Assessment> {
        const assessment = await this.assessmentRepository.findByIdOrThrow(assessmentId)

        // 권한 확인 (본인 것만 조회 가능)
        if (userId && assessment.userId !== userId) {
            throw new NotFoundException("assessment.not_found")
        }

        return assessment
    }

    /**
     * 사용자의 Assessment 이력 조회
     */
    async getAssessmentHistory(
        userId: number,
        limit: number = DEFAULT_PAGE_LIMIT,
        offset: number = 0
    ): Promise<{ items: Assessment[]; total: number }> {
        return this.assessmentRepository.findByUserId(userId, limit, offset)
    }

    /**
     * 모든 Assessment 조회 (관리자용)
     */
    async getAllAssessments(
        limit: number = DEFAULT_PAGE_LIMIT,
        offset: number = 0,
        filters: Record<string, unknown> = {}
    ): Promise<{ items: Assessment[]; total: number }> {
        return this.assessmentRepository.findAll(limit, offset, filters)
    }

    async retryAnalysis(assessmentId: number): Promise<void> {
        const assessment = await this.assessmentRepository.findByIdLightOrThrow(assessmentId)

        if (!assessment.canRetry()) {
            throw new ValidationException("assessment.cannot_retry")
        }

        // 도메인 로직 호출 (Domain Event 발행: 로깅용)
        assessment.startAnalysis()
        await this.assessmentRepository.save(assessment)

        // Queueing analysis (BullMQ)
        await this.analysisService.analyzeAssessment(assessment.id)

        // Domain Events 발행 (비동기)
        this.eventDispatcher.publishFromAggregate(assessment)
    }

}
