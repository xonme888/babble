import { Worker, Job } from "bullmq"
import { container } from "tsyringe"
import { AssessmentRepository } from "@features/assessment/infrastructure/assessment.repository"
import { AssessmentStatus } from "@features/assessment/domain/assessment.entity"
import { configurations } from "@shared/infra/config/configurations"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { ASSESSMENT_ANALYSIS_QUEUE_NAME } from "@shared/infra/queue/analysis.queue"
import { ensureDatasource } from "@shared/infra/persistence/ensure-datasource"
import { TraceContext } from "@shared/infra/logging/trace-context"
import { IRedisService } from "@shared/core/redis-service.interface"
import { ServiceUnavailableException } from "@shared/core/exceptions/infrastructure-exceptions"
import { REDIS_QUEUE_DB } from "@shared/core/constants/redis.constants"
import { AnalysisType } from "@shared/core/queue.interface"
import type { AnalysisJobData, ScriptAnalysisJobData, WordAnalysisJobData } from "@shared/core/queue.interface"
import { assertNever } from "@shared/core/assert-never"

const config = configurations()

/** Redis AI 작업 큐에 분석 요청 푸시 */
async function pushTaskToRedis(
    redisService: IRedisService,
    taskData: Record<string, unknown>,
    assessmentId: number,
    logger: ILogger
): Promise<void> {
    logger.info(
        `[AnalysisWorker] Pushing task to Redis for Python AI: assessment-${assessmentId}`
    )
    const pushed = await redisService.rpush("ai:tasks", JSON.stringify(taskData))
    if (!pushed) {
        throw new ServiceUnavailableException("Redis")
    }
}

export const createAnalysisWorker = () => {
    const worker = new Worker(
        ASSESSMENT_ANALYSIS_QUEUE_NAME,
        async (job: Job) => {
            const logger = container.resolve<ILogger>(DI_TOKENS.ILogger)
            const redisService = container.resolve<IRedisService>(DI_TOKENS.IRedisService)

            try {
                await ensureDatasource()

                const data = job.data as AnalysisJobData
                const { assessmentId, audioUrl } = data

                // 하위호환: 배포 시 큐 잔류 기존 메시지에 analysisType 없을 수 있음
                const analysisType = data.analysisType ?? AnalysisType.SCRIPT

                if (!assessmentId || !audioUrl) {
                    logger.error(
                        `[AnalysisWorker] Job ${job.id} 필수 데이터 누락: ` +
                        `assessmentId=${assessmentId}, audioUrl=${!!audioUrl}`
                    )
                    return
                }

                let script: string
                let taskType: string

                switch (analysisType) {
                    case AnalysisType.SCRIPT:
                        if (!(data as ScriptAnalysisJobData).scriptContent) {
                            logger.error(
                                `[AnalysisWorker] Job ${job.id} SCRIPT 분석에 scriptContent 누락`
                            )
                            return
                        }
                        script = (data as ScriptAnalysisJobData).scriptContent
                        taskType = "ASSESSMENT"
                        break
                    case AnalysisType.WORD:
                        if (!(data as WordAnalysisJobData).scriptContent) {
                            logger.error(
                                `[AnalysisWorker] Job ${job.id} WORD 분석에 scriptContent 누락`
                            )
                            return
                        }
                        script = (data as WordAnalysisJobData).scriptContent
                        taskType = "WORD_PRACTICE"
                        break
                    case AnalysisType.BREATHING:
                        script = ""
                        taskType = "BREATHING_ASSESSMENT"
                        break
                    case AnalysisType.FREE_SPEECH:
                        script = ""
                        taskType = "DIARY_ANALYSIS"
                        break
                    default:
                        assertNever(analysisType)
                }

                const traceId = data.traceId
                await TraceContext.run(traceId ?? `analysis-job-${job.id}`, async () => {
                    logger.info(`[AnalysisWorker] Processing ${taskType} ${assessmentId}`)

                    // Assessment 엔티티 기반 분석만 상태 전이 (음성 일기/호흡 평가는 별도 엔티티)
                    const NON_ASSESSMENT_TYPES = new Set([AnalysisType.FREE_SPEECH, AnalysisType.BREATHING])
                    if (!NON_ASSESSMENT_TYPES.has(analysisType)) {
                        const assessmentRepo = container.resolve(AssessmentRepository)
                        const assessment = await assessmentRepo.findById(assessmentId)
                        if (!assessment) {
                            logger.error(
                                `[AnalysisWorker] Assessment ${assessmentId} not found`
                            )
                            return
                        }

                        if (assessment.status !== AssessmentStatus.ANALYZING) {
                            assessment.startAnalysis()
                            await assessmentRepo.save(assessment)
                        }
                    }

                    const taskData = {
                        jobId: job.id,
                        assessmentId,
                        audioUrl,
                        script,
                        type: taskType,
                        traceId: TraceContext.getTraceId(),
                    }

                    await pushTaskToRedis(redisService, taskData, assessmentId, logger)

                    logger.info(
                        `[AnalysisWorker] Task successfully delegated for ${taskType} ${assessmentId}. BullMQ job completed.`
                    )
                })
            } catch (fatalError: unknown) {
                logger.error("[AnalysisWorker] Fatal Error:", fatalError instanceof Error ? fatalError.message : String(fatalError))
                throw fatalError
            }
        },
        {
            connection: {
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password,
                db: REDIS_QUEUE_DB,
            },
            concurrency: config.queue.concurrency,
        }
    )

    // Redis 장애 시 unhandled error 방지 — 프로세스 크래시 예방
    worker.on("error", (err) => {
        const logger = container.resolve<ILogger>(DI_TOKENS.ILogger)
        logger.error("[AnalysisWorker] Worker error", err)
    })

    // BullMQ 최종 실패 시 Assessment를 FAILED로 변경
    worker.on("failed", async (job: Job | undefined, err: Error) => {
        if (!job) return
        const logger = container.resolve<ILogger>(DI_TOKENS.ILogger)

        // 모든 재시도 소진된 최종 실패인 경우에만 처리
        // defaultJobOptions.attempts가 job.opts.attempts에 병합되므로 ?? config 폴백
        const maxAttempts = job.opts?.attempts ?? config.queue.attempts
        const isFinalFailure = job.attemptsMade >= maxAttempts
        if (!isFinalFailure) {
            logger.warn(
                `[AnalysisWorker] Job ${job.id} 실패 (${job.attemptsMade}/${maxAttempts}회) — BullMQ 재시도 예정: ${err.message}`
            )
            return
        }

        logger.error(
            `[AnalysisWorker] Job ${job.id} 최종 실패 (${job.attemptsMade}회 시도): ${err.message}`
        )

        try {
            await ensureDatasource()
            const data = job.data as AnalysisJobData
            const { assessmentId } = data
            if (!assessmentId) return

            // 비-Assessment 엔티티 최종 실패 — Assessment 상태 전이 불필요
            const analysisType = data.analysisType ?? AnalysisType.SCRIPT
            if (analysisType === AnalysisType.FREE_SPEECH || analysisType === AnalysisType.BREATHING) {
                logger.error(
                    `[AnalysisWorker] ${analysisType} ${assessmentId} 최종 실패: ${err.message}`
                )
                return
            }

            const assessmentRepo = container.resolve(AssessmentRepository)
            const assessment = await assessmentRepo.findByIdLight(assessmentId)
            if (!assessment) return

            // 이미 완료/실패 처리된 경우 무시
            if (
                assessment.status !== AssessmentStatus.ANALYZING &&
                assessment.status !== AssessmentStatus.PENDING
            ) {
                return
            }

            assessment.failAnalysis(`System: BullMQ 작업 ${job.attemptsMade}회 시도 후 최종 실패 — ${err.message}`)
            await assessmentRepo.save(assessment)
            logger.info(
                `[AnalysisWorker] Assessment ${assessmentId} FAILED 상태로 변경 완료`
            )
        } catch (saveErr: unknown) {
            logger.error(
                `[AnalysisWorker] Assessment 상태 갱신 실패: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`
            )
        }
    })

    return worker
}
