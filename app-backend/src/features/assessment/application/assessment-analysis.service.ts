import { injectable, inject } from "tsyringe"
import { Script } from "@features/script/domain/script.entity"
import { AssessmentRepository } from "../infrastructure/assessment.repository"
import { IAnalysisQueue } from "@shared/core/queue.interface"
import { ILogger } from "@shared/core/logger.interface"
import { IDomainEventDispatcher } from "@shared/core/domain-event-dispatcher.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"

/**
 * Assessment Analysis Service
 *
 * BullMQ 큐를 이용한 AI 분석 실행 서비스
 */
@injectable()
export class AssessmentAnalysisService {
    constructor(
        @inject(AssessmentRepository) private assessmentRepository: AssessmentRepository,
        @inject(DI_TOKENS.IDomainEventDispatcher) private eventDispatcher: IDomainEventDispatcher,
        @inject(DI_TOKENS.ILogger) private logger: ILogger,
        @inject(DI_TOKENS.IAnalysisQueue) private analysisQueue: IAnalysisQueue
    ) {}

    /**
     * Assessment AI 분석 실행 (BullMQ 큐 추가)
     */
    async analyzeAssessment(assessmentId: number): Promise<void> {
        this.logger.info(
            `[AssessmentAnalysisService] Queueing analysis for Assessment ${assessmentId}`
        )

        const assessment = await this.assessmentRepository.findByIdOrThrow(assessmentId)

        try {
            // Script 텍스트 준비
            const scriptText = assessment.scriptSnapshot?.content ?? assessment.script?.content ?? ""
            const sanitizedScript = Script.sanitize(scriptText)

            // 큐에 분석 작업 추가
            await this.analysisQueue.enqueue(
                {
                    assessmentId: assessment.id,
                    audioUrl: assessment.audioUrl,
                    scriptContent: sanitizedScript,
                },
                {
                    jobId: `assessment-${assessment.id}-${assessment.retryCount}`,
                }
            )

            this.logger.info(
                `[AssessmentAnalysisService] Successfully queued Assessment ${assessmentId}`
            )
        } catch (error: unknown) {
            this.logger.error(
                `[AssessmentAnalysisService] Failed to queue Assessment ${assessmentId}:`,
                error
            )

            // 큐 추가 실패 시 상태 업데이트
            assessment.failAnalysis(`Queue error: ${error instanceof Error ? error.message : String(error)}`)
            await this.assessmentRepository.save(assessment)

            // 이벤트 발행
            await this.eventDispatcher.dispatchAll(assessment.getDomainEvents())
            assessment.clearDomainEvents()

            // 호출자에게 에러 전파 — 사용자가 거짓 성공 응답을 받지 않도록
            throw error
        }
    }

    /**
     * 실패한 Assessment의 자동 재시도를 BullMQ delayed job으로 예약
     * 엔티티 상태는 변경하지 않음 — 워커 실행 시 startAnalysis() 호출
     */
    async scheduleRetry(assessmentId: number, delayMs: number): Promise<void> {
        const assessment = await this.assessmentRepository.findById(assessmentId)

        if (!assessment) {
            this.logger.warn(
                `[AssessmentAnalysisService] scheduleRetry: Assessment ${assessmentId} not found`
            )
            return
        }

        const scriptText = assessment.scriptSnapshot?.content ?? assessment.script?.content ?? ""
        const sanitizedScript = Script.sanitize(scriptText)

        await this.analysisQueue.enqueue(
            {
                assessmentId: assessment.id,
                audioUrl: assessment.audioUrl,
                scriptContent: sanitizedScript,
            },
            {
                jobId: `assessment-${assessment.id}-retry-${assessment.retryCount}`,
                delay: delayMs,
            }
        )

        this.logger.info(
            `[AssessmentAnalysisService] Scheduled retry for Assessment ${assessmentId} in ${delayMs}ms`
        )
    }
}
