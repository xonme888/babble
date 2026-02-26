import { injectable, inject } from "tsyringe"
import { OptimisticLockVersionMismatchError } from "typeorm"
import { ILogger } from "@shared/core/logger.interface"
import { IRedisService } from "@shared/core/redis-service.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { AssessmentRepository } from "../infrastructure/assessment.repository"
import { AssessmentAnalysisService } from "../application/assessment-analysis.service"
import { AssessmentStatus } from "../domain/assessment.entity"
import type { AIAnalysisResult } from "../domain/ai-analysis-result.interface"

/**
 * Stuck Assessment Cleaner
 *
 * 'ANALYZING' 상태로 너무 오래 머물러 있는 진단을 찾아 실패 처리하거나 재시도합니다.
 * Worker가 크래시 나서 Redis 큐에서는 사라졌지만 DB에는 여전히 진행 중으로 남아있는 좀비 작업을 정리합니다.
 */
@injectable()
export class StuckAssessmentCleaner {
    constructor(
        @inject(AssessmentRepository) private assessmentRepository: AssessmentRepository,
        @inject(AssessmentAnalysisService) private analysisService: AssessmentAnalysisService,
        @inject(DI_TOKENS.ILogger) private logger: ILogger,
        @inject(DI_TOKENS.IRedisService) private redisService: IRedisService
    ) { }

    /**
     * 좀비 작업 정리 실행
     * @param thresholdMinutes 기준 시간 (분). 이 시간 이상 ANALYZING/PENDING 상태면 좀비로 간주
     */
    async cleanUp(thresholdMinutes: number = 30): Promise<void> {
        // AI Worker 하트비트 상태 확인
        const heartbeat = await this.redisService.get("ai:worker:heartbeat")
        if (!heartbeat) {
            this.logger.warn(
                "[StuckCleaner] AI Worker 하트비트 미감지 — Worker가 중단되었을 수 있음"
            )
        }

        this.logger.info(
            `[StuckCleaner] Checking for assessments stuck in ANALYZING/PENDING for more than ${thresholdMinutes} minutes...`
        )

        // 1. 오래된 ANALYZING/PENDING 작업 조회
        const stuckAssessments = await this.assessmentRepository.findStuckAssessments(thresholdMinutes)

        if (stuckAssessments.length === 0) {
            this.logger.info("[StuckCleaner] No stuck assessments found.")
            return
        }

        this.logger.info(
            `[StuckCleaner] Found ${stuckAssessments.length} stuck assessments. Processing...`
        )

        // 2. 각 작업 실패 처리 (경합 조건 방지: 상태 재조회)
        for (const assessment of stuckAssessments) {
            try {
                const current = await this.assessmentRepository.findByIdLight(assessment.id)

                // Guard: 이미 다른 프로세스에서 처리됨
                if (
                    !current ||
                    (current.status !== AssessmentStatus.ANALYZING &&
                        current.status !== AssessmentStatus.PENDING)
                ) {
                    this.logger.info(
                        `[StuckCleaner] Assessment ${assessment.id} already resolved (${current?.status}). Skipping.`
                    )
                    continue
                }

                // jobId 형식별 조회 — retryCount - 1도 포함
                // jobId는 생성 시점의 retryCount로 만들어지지만,
                // startAnalysis()에서 retryCount가 증가하여 DB에는 +1된 값이 저장됨
                const resultKeyPatterns = [
                    `ai:results:assessment-${current.id}-${current.retryCount}`,
                    `ai:results:assessment-${current.id}-retry-${current.retryCount}`,
                ]
                if (current.retryCount >= 1) {
                    resultKeyPatterns.push(
                        `ai:results:assessment-${current.id}-${current.retryCount - 1}`,
                        `ai:results:assessment-${current.id}-retry-${current.retryCount - 1}`
                    )
                }

                let cachedResult: string | null = null
                let matchedKey: string | null = null
                for (const key of resultKeyPatterns) {
                    cachedResult = await this.redisService.get(key)
                    if (cachedResult) {
                        matchedKey = key
                        break
                    }
                }

                // Guard: 캐시된 결과 없음 — 좀비로 판정
                if (!cachedResult || !matchedKey) {
                    this.logger.warn(
                        `[StuckCleaner] Marking Assessment ${current.id} as FAILED (zombie)`
                    )
                    current.failAnalysis(
                        "System: Analysis timed out (Stuck in " + current.status + ")"
                    )
                    await this.assessmentRepository.save(current)
                    continue
                }

                // 캐시된 결과 파싱 시도
                let result: AIAnalysisResult
                try {
                    result = JSON.parse(cachedResult)
                } catch (parseErr: unknown) {
                    this.logger.error(
                        `[StuckCleaner] Failed to parse cached result for Assessment ${current.id}: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
                    )
                    current.failAnalysis(
                        "System: Analysis timed out (cached result unparseable)"
                    )
                    await this.assessmentRepository.save(current)
                    await this.redisService.delete(matchedKey)
                    continue
                }

                // 캐시된 분석 결과 적용 (성공/실패 판정은 엔티티가 수행)
                current.applyAnalysisResult(result)
                if (result.success) {
                    this.logger.info(
                        `[StuckCleaner] Recovered result for Assessment ${current.id} from ${matchedKey}`
                    )
                }

                await this.redisService.delete(matchedKey)
                await this.assessmentRepository.save(current)
            } catch (error: unknown) {
                if (error instanceof OptimisticLockVersionMismatchError) {
                    this.logger.info(
                        `[StuckCleaner] Assessment ${assessment.id} was modified by another process. Skipping.`
                    )
                    continue
                }
                this.logger.error(
                    `[StuckCleaner] Failed to clean up Assessment ${assessment.id}: ${error instanceof Error ? error.message : String(error)}`
                )
            }
        }
    }
}
