import * as fs from "fs"
import * as path from "path"
import { container } from "tsyringe"
import { AssessmentRepository } from "../infrastructure/assessment.repository"
import { AssessmentAnalysisService } from "../application/assessment-analysis.service"
import { AnalysisResultProcessor } from "../application/analysis-result-processor"
import type { AIAnalysisResult } from "../domain/ai-analysis-result.interface"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { IRedisService } from "@shared/core/redis-service.interface"
import { configurations } from "@shared/infra/config/configurations"
import { TraceContext } from "@shared/infra/logging/trace-context"

/** 결과 큐 키 — AI Worker가 RPUSH, Backend가 BLPOP */
export const RESULT_QUEUE_KEY = "ai:results:completed"

export { SSE_ASSESSMENT_UPDATED_CHANNEL } from "../application/analysis-result-processor"

export const createAnalysisResultSubscriber = () => {
    const logger = container.resolve<ILogger>(DI_TOKENS.ILogger)
    const redisService = container.resolve<IRedisService>(DI_TOKENS.IRedisService)
    const processor = container.resolve(AnalysisResultProcessor)

    let running = true

    logger.info(`[AnalysisSubscriber] Starting BLPOP consumer on key: ${RESULT_QUEUE_KEY}`)

    /** 실패 메시지를 Dead Letter Queue에 저장 */
    async function writeToDLQ(message: string, error: unknown): Promise<void> {
        try {
            const pushed = await redisService.rpush(
                "ai:analysis:dead-letter",
                JSON.stringify({
                    originalMessage: message,
                    error: error instanceof Error ? error.message : String(error),
                    failedAt: new Date().toISOString(),
                })
            )
            if (!pushed) {
                logger.error(
                    "[CRITICAL] [AnalysisSubscriber] DLQ rpush returned 0 — message may be lost"
                )
            }
        } catch (dlqError: unknown) {
            logger.error(
                `[AnalysisSubscriber] Failed to write to dead-letter queue: ${dlqError instanceof Error ? dlqError.message : String(dlqError)}`
            )
            // 파일 시스템 폴백 -- Redis DLQ 쓰기 실패 시 로컬 파일로 저장
            try {
                const dlqDir = path.join(process.cwd(), "logs", "dlq")
                fs.mkdirSync(dlqDir, { recursive: true })
                const filename = `dlq-${Date.now()}.json`
                fs.writeFileSync(
                    path.join(dlqDir, filename),
                    JSON.stringify({
                        originalMessage: message,
                        error: error instanceof Error ? error.message : String(error),
                        failedAt: new Date().toISOString(),
                    })
                )
                logger.warn(`[AnalysisSubscriber] DLQ write failed, saved to file: ${filename}`)
            } catch (fileErr: unknown) {
                logger.error(
                    `[CRITICAL] [AnalysisSubscriber] Both DLQ and file fallback failed: ${fileErr instanceof Error ? fileErr.message : String(fileErr)}`
                )
            }
        }
    }

    /** BLPOP 메인 루프 — 결과 큐에서 메시지를 꺼내 처리 */
    async function pollLoop(): Promise<void> {
        while (running) {
            try {
                // BLPOP: 5초 타임아웃 — 메시지 없으면 null, 있으면 즉시 반환
                const message = await redisService.blpop(RESULT_QUEUE_KEY, 5)
                if (!message) continue

                // 메시지 파싱
                const result: AIAnalysisResult = JSON.parse(message)
                const { jobId, assessmentId } = result

                // 게스트 체험 결과는 assessmentId 없이 polling으로 처리됨 — 무시
                if (typeof jobId === "string" && jobId.startsWith("guest-")) continue

                if (!jobId || !assessmentId) {
                    logger.warn(`[AnalysisSubscriber] Invalid message received: ${message}`)
                    continue
                }

                // 비즈니스 로직 처리 위임
                await TraceContext.run(`analysis-result-${jobId}`, async () => {
                    await processor.process(result)

                    // 자동 재시도 (인프라 관심사 -- Subscriber에서 처리)
                    const assessmentRepo = container.resolve(AssessmentRepository)
                    const assessment = await assessmentRepo.findById(assessmentId)
                    if (assessment?.shouldAutoRetry()) {
                        try {
                            const config = configurations()
                            const analysisService = container.resolve(AssessmentAnalysisService)
                            await analysisService.scheduleRetry(assessmentId, config.queue.retryDelay)
                        } catch (retryError: unknown) {
                            logger.warn(
                                `[AnalysisSubscriber] Auto-retry scheduling failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`
                            )
                        }
                    }
                })
            } catch (error: unknown) {
                if (!running) break

                const errorMessage = error instanceof Error ? error.message : String(error)

                // Redis 연결 오류 시 재시도 대기
                if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTCONN")) {
                    logger.error(`[AnalysisSubscriber] Redis 연결 오류 — 5초 후 재시도: ${errorMessage}`)
                    await new Promise((resolve) => setTimeout(resolve, 5000))
                    continue
                }

                // 메시지 처리 오류 — DLQ 저장
                logger.error(`[AnalysisSubscriber] Error processing message: ${errorMessage}`)
                // BLPOP이 이미 메시지를 꺼냈으므로 DLQ에 저장
                await writeToDLQ(errorMessage, error)
            }
        }
        logger.info("[AnalysisSubscriber] Poll loop stopped")
    }

    // 루프 시작 (비동기 — fire-and-forget)
    pollLoop().catch((err) => {
        logger.error(`[AnalysisSubscriber] Fatal poll loop error: ${err instanceof Error ? err.message : String(err)}`)
    })

    return {
        close: async () => {
            logger.info("[AnalysisSubscriber] Stopping BLPOP consumer...")
            running = false
            // BLPOP 타임아웃(5초) 후 루프가 자연스럽게 종료됨
        },
    }
}
