import { injectable, inject } from "tsyringe"
import { DataSource } from "typeorm"
import { AssessmentRepository } from "../infrastructure/assessment.repository"
import { AssessmentAnalysisLog, AnalysisLogStatus } from "../domain/assessment-analysis-log.entity"
import { AssessmentStatus } from "../domain/assessment.entity"
import type { AIAnalysisResult } from "../domain/ai-analysis-result.interface"
import { ILogger } from "@shared/core/logger.interface"
import { IRedisService } from "@shared/core/redis-service.interface"
import { IDomainEventDispatcher } from "@shared/core/domain-event-dispatcher.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import type { IChapterProgressChecker } from "@features/script/domain/chapter-progress-checker.interface"

export const SSE_ASSESSMENT_UPDATED_CHANNEL = "sse:assessment:updated"

/**
 * 분석 결과 처리기 (Application Layer)
 *
 * AI 분석 결과를 받아 DB 저장, 이벤트 발행, SSE 알림을 수행한다.
 * Redis Pub/Sub, JSON 파싱, DLQ 등 인프라 관심사는 Subscriber가 담당한다.
 */
@injectable()
export class AnalysisResultProcessor {
    constructor(
        @inject(AssessmentRepository) private assessmentRepo: AssessmentRepository,
        @inject(DI_TOKENS.IDomainEventDispatcher) private eventDispatcher: IDomainEventDispatcher,
        @inject(DI_TOKENS.IChapterProgressChecker) private chapterProgressService: IChapterProgressChecker,
        @inject(DI_TOKENS.IRedisService) private redisService: IRedisService,
        @inject(DI_TOKENS.DataSource) private dataSource: DataSource,
        @inject(DI_TOKENS.ILogger) private logger: ILogger
    ) {}

    /**
     * 분석 결과 처리 -- DB 저장, 이벤트 발행, SSE 알림
     * Subscriber로부터 호출됨 (인프라 관심사는 Subscriber가 담당)
     */
    async process(result: AIAnalysisResult): Promise<void> {
        const { jobId, assessmentId } = result

        this.logger.info(`[AnalysisProcessor] Received result for Assessment ${assessmentId}`, {
            success: result.success,
            score: result.score,
            fa_score: result.fa_score,
            phoneme_accuracy: result.phoneme_accuracy,
            speaking_rate: result.speaking_rate,
            has_alignment: !!result.alignment,
            has_similarity: !!result.similarity,
            has_pitch_data: !!result.pitch_data,
            message: result.success ? undefined : result.message,
        })

        const assessment = await this.assessmentRepo.findById(assessmentId)
        if (!assessment) {
            this.logger.error(`[AnalysisProcessor] Assessment ${assessmentId} not found`)
            return
        }

        // 이미 완료된 assessment -- 중복 메시지 무시 (DLQ 오염 방지)
        if (assessment.status === AssessmentStatus.COMPLETED) {
            this.logger.info(
                `[AnalysisProcessor] Assessment ${assessmentId} already COMPLETED — skipping duplicate`
            )
            return
        }

        // 분석 결과 적용 (성공/실패 판정은 엔티티가 수행)
        assessment.applyAnalysisResult(result)
        const logEntry = AssessmentAnalysisLog.create({
            assessmentId,
            attemptNumber: assessment.retryCount,
            status: result.success ? AnalysisLogStatus.SUCCESS : AnalysisLogStatus.FAIL,
            errorMessage: result.success ? undefined : (result.message ?? "AI analysis failed"),
        })

        // DB 저장 (트랜잭션으로 원자성 보장)
        await this.dataSource.transaction(async (manager) => {
            await manager.save(assessment)
            await manager.save(logEntry)
        })

        // 이벤트 발행 실패 시 로그 + 계속 진행 (이벤트 핸들러는 로깅/통계 용도)
        try {
            await this.eventDispatcher.dispatchAll(assessment.getDomainEvents())
        } catch (eventErr: unknown) {
            this.logger.warn(
                `[AnalysisProcessor] Event dispatch failed: ${eventErr instanceof Error ? eventErr.message : String(eventErr)}`
            )
        }
        assessment.clearDomainEvents()

        // 번들 완료 판정 (성공 시에만, 실패해도 SSE 전송은 진행)
        let bundleCompletion = null
        if (result.success && assessment.scriptId && assessment.userId) {
            try {
                bundleCompletion = await this.chapterProgressService.checkBundleCompletion(
                    assessment.userId,
                    assessment.scriptId
                )
            } catch (e: unknown) {
                this.logger.warn(
                    `[AnalysisProcessor] Bundle completion check failed: ${e instanceof Error ? e.message : String(e)}`
                )
            }
        }

        // SSE 알림 발행 -- DB 업데이트 후에만 전송 (클라이언트 조회 시 최신 데이터 보장)
        await this.redisService.publish(
            SSE_ASSESSMENT_UPDATED_CHANNEL,
            JSON.stringify({
                userId: assessment.userId,
                assessmentId: assessment.id,
                status: assessment.status,
                ...(bundleCompletion ? { bundleCompletion } : {}),
            })
        )

        // 임시 결과 Redis 키 정리
        await this.redisService.delete(`ai:results:${jobId}`)

        this.logger.info(`[AnalysisProcessor] Successfully processed Assessment ${assessmentId}`)
    }
}
