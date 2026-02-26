import "reflect-metadata"
import { initializeTransactionalContext } from "typeorm-transactional"
import { container } from "tsyringe"
import { setupDI } from "@shared/infra/di/diconfig"
import { ensureDatasource } from "@shared/infra/persistence/ensure-datasource"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { createEmailWorker } from "@features/notification/worker/email.worker"
import { createAnalysisWorker } from "@features/assessment/worker/analysis.worker"
import { createAnalysisResultSubscriber } from "@features/assessment/worker/analysis-result.subscriber"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { StuckAssessmentCleaner } from "@features/assessment/cron/stuck-assessment-cleaner"
import { GuestAccountCleaner } from "@features/user/cron/guest-account-cleaner"
import { DLQMonitor } from "@features/assessment/cron/dlq-monitor"
import { DailyChallengeGenerator } from "@features/game/worker/daily-challenge-generator"
import { configurations } from "@shared/infra/config/configurations"

async function bootstrap() {
    initializeTransactionalContext()
    await setupDI()

    // DataSource 초기화 — StuckAssessmentCleaner 등에서 엔티티 메타데이터 필요
    await ensureDatasource()

    const logger = container.resolve<ILogger>(DI_TOKENS.ILogger)
    const config = configurations()
    logger.info("Starting worker process...")

    const emailWorker = createEmailWorker()
    const analysisWorker = createAnalysisWorker()
    const resultSubscriber = createAnalysisResultSubscriber()

    // Worker 에러 핸들러 — Redis 장애 시 unhandled error로 프로세스 크래시 방지
    emailWorker.on("error", (err) => {
        logger.error("[Worker] EmailWorker error", err)
    })
    analysisWorker.on("error", (err) => {
        logger.error("[Worker] AnalysisWorker error", err)
    })

    // 3. Start Stuck Job Cleaner (Cron-like)
    const stuckCleaner = container.resolve(StuckAssessmentCleaner)

    const cleanerInterval = setInterval(
        async () => {
            try {
                await stuckCleaner.cleanUp(config.worker.stuckThresholdMinutes)
            } catch (err) {
                logger.error("[Worker] StuckCleaner failed:", err)
            }
        },
        config.worker.stuckCleanerIntervalMs
    )

    // 4. Start Guest Account Cleaner (1시간마다)
    const guestCleaner = container.resolve(GuestAccountCleaner)
    const guestCleanerInterval = setInterval(
        async () => {
            try {
                await guestCleaner.cleanUp()
            } catch (err) {
                logger.error("[Worker] GuestAccountCleaner failed:", err)
            }
        },
        60 * 60 * 1000 // 1시간
    )

    // 5. Start Daily Challenge Generator (1시간마다)
    const challengeGenerator = container.resolve(DailyChallengeGenerator)
    const challengeGeneratorInterval = setInterval(
        async () => {
            try {
                await challengeGenerator.run()
            } catch (err) {
                logger.error("[Worker] DailyChallengeGenerator failed:", err)
            }
        },
        60 * 60 * 1000 // 1시간
    )
    // 최초 실행
    challengeGenerator.run().catch((err) => {
        logger.error("[Worker] DailyChallengeGenerator initial run failed:", err)
    })

    // 6. Start DLQ Monitor
    const dlqMonitor = container.resolve(DLQMonitor)

    const dlqMonitorInterval = setInterval(
        async () => {
            try {
                await dlqMonitor.check()
            } catch (err) {
                logger.error("[Worker] DLQMonitor failed:", err)
            }
        },
        config.worker.dlqMonitorIntervalMs
    )

    logger.info("Worker is listening for jobs and analysis results...")

    // Graceful shutdown 공통 함수
    let isShuttingDown = false
    const gracefulShutdown = async (signal: string) => {
        // 중복 호출 방지
        if (isShuttingDown) return
        isShuttingDown = true

        logger.info(`${signal} signal received: closing queues and subscriptions`)

        // 강제 종료 타임아웃 — 30초 후 프로세스 강제 종료
        const forceExitTimer = setTimeout(() => {
            logger.error("Graceful shutdown timed out (30s), forcing exit")
            process.exit(1)
        }, 30_000)
        forceExitTimer.unref()

        // 1. Cron 인터벌 정리
        clearInterval(cleanerInterval)
        clearInterval(guestCleanerInterval)
        clearInterval(challengeGeneratorInterval)
        clearInterval(dlqMonitorInterval)
        logger.info("Cron intervals cleared")

        // 2. Worker 신규 작업 수신 중지 후 실행 중 작업 완료 대기
        try {
            await emailWorker.close()
            logger.info("Email worker closed")
        } catch (err) {
            logger.error("Error closing email worker:", err)
        }

        try {
            await analysisWorker.close()
            logger.info("Analysis worker closed")
        } catch (err) {
            logger.error("Error closing analysis worker:", err)
        }

        // 3. 결과 큐 소비자 종료 (BLPOP 루프 중단)
        try {
            await resultSubscriber.close()
            logger.info("Result subscriber closed")
        } catch (err) {
            logger.error("Error closing result subscriber:", err)
        }

        // 4. DB 연결 종료
        if (AppDataSource.isInitialized) {
            try {
                await AppDataSource.destroy()
                logger.info("Database connection closed")
            } catch (err) {
                logger.error("Error closing database:", err)
            }
        }

        process.exit(0)
    }

    process.once("SIGTERM", () => gracefulShutdown("SIGTERM"))
    process.once("SIGINT", () => gracefulShutdown("SIGINT"))

    process.once("unhandledRejection", (reason, promise) => {
        logger.error("Unhandled Rejection in worker:", { promise, reason })
        gracefulShutdown("unhandledRejection")
    })

    process.once("uncaughtException", (error) => {
        logger.error("Uncaught Exception in worker:", error)
        process.exit(1)
    })
}

bootstrap().catch((err) => {
    // logger가 초기화되기 전 실패할 수 있어 stderr 직접 출력
    process.stderr.write(`Worker failed to start: ${err}\n`)
    process.exit(1)
})
