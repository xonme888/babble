import { injectable, inject } from "tsyringe"
import { Script } from "@features/script/domain/script.entity"
import { Assessment } from "../domain/assessment.entity"
import { AssessmentRepository } from "../infrastructure/assessment.repository"
import { IAnalysisQueue, AnalysisType } from "@shared/core/queue.interface"
import type { AnalysisJobData } from "@shared/core/queue.interface"
import { ILogger } from "@shared/core/logger.interface"
import { IDomainEventDispatcher } from "@shared/core/domain-event-dispatcher.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { AssessmentType } from "@shared/core/constants/api-contract"

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
            const jobData = this.buildJobData(assessment)

            await this.analysisQueue.enqueue(jobData, {
                jobId: `assessment-${assessment.id}-${assessment.retryCount}`,
            })

            this.logger.info(
                `[AssessmentAnalysisService] Successfully queued Assessment ${assessmentId}`
            )
        } catch (error: unknown) {
            this.logger.error(
                `[AssessmentAnalysisService] Failed to queue Assessment ${assessmentId}:`,
                error
            )

            assessment.failAnalysis(`Queue error: ${error instanceof Error ? error.message : String(error)}`)
            await this.assessmentRepository.save(assessment)

            await this.eventDispatcher.dispatchAll(assessment.getDomainEvents())
            assessment.clearDomainEvents()

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

        const jobData = this.buildJobData(assessment)

        await this.analysisQueue.enqueue(jobData, {
            jobId: `assessment-${assessment.id}-retry-${assessment.retryCount}`,
            delay: delayMs,
        })

        this.logger.info(
            `[AssessmentAnalysisService] Scheduled retry for Assessment ${assessmentId} in ${delayMs}ms`
        )
    }

    /** assessmentType + scriptContent로 AI 분석 유형을 결정하고 큐 데이터를 구성 */
    private buildJobData(assessment: Assessment): AnalysisJobData {
        const scriptText = assessment.scriptSnapshot?.content
            ?? assessment.referenceText
            ?? assessment.script?.content
            ?? ""
        const sanitizedScript = Script.sanitize(scriptText)

        // WORD_PRACTICE는 전용 경량 파이프라인 사용
        if (assessment.assessmentType === AssessmentType.WORD_PRACTICE) {
            return {
                analysisType: AnalysisType.WORD,
                assessmentId: assessment.id,
                audioUrl: assessment.audioUrl,
                scriptContent: sanitizedScript,
            }
        }

        // 스크립트 유무로 SCRIPT/FREE_SPEECH 분기
        if (sanitizedScript) {
            return {
                analysisType: AnalysisType.SCRIPT,
                assessmentId: assessment.id,
                audioUrl: assessment.audioUrl,
                scriptContent: sanitizedScript,
            }
        }

        return {
            analysisType: AnalysisType.FREE_SPEECH,
            assessmentId: assessment.id,
            audioUrl: assessment.audioUrl,
        }
    }
}
