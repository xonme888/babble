import "reflect-metadata"
import { setupDI } from "@shared/infra/di/diconfig"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { container } from "tsyringe"
import { createApp } from "./app"
import { ConfigService } from "@shared/infra/config/config.service"
import { SystemLogger } from "@shared/infra/logging/system-logger"

async function bootstrap() {
    try {
        // 1. DI 설정 및 초기화
        // (typeorm-transactional 초기화는 data-source.ts 모듈 로드 시 자동 수행)
        await setupDI()
        SystemLogger.info("DI dependencies registered")

        // 2. Express 앱 생성
        const { app, closeSubscribers } = await createApp()
        const configService = container.resolve(ConfigService)
        const PORT = configService.config.port

        // 3. DB 연결 및 서버 시작
        await AppDataSource.initialize()
        SystemLogger.info(`Database connected successfully`)

        const server = app.listen(PORT, () => {
            SystemLogger.info(`Server is running on http://localhost:${PORT}`)
        })

        // Graceful Shutdown
        const shutdown = async (signal: string) => {
            SystemLogger.info(`${signal} signal received: starting graceful shutdown`)

            server.close(async () => {
                SystemLogger.info("HTTP server closed")

                // SSE Redis 구독자 정리
                try {
                    await closeSubscribers()
                    SystemLogger.info("SSE subscribers closed")
                } catch (err) {
                    SystemLogger.error("Error closing SSE subscribers:", err)
                }

                try {
                    if (AppDataSource.isInitialized) {
                        await AppDataSource.destroy()
                        SystemLogger.info("Database connection closed")
                    }
                } catch (err) {
                    SystemLogger.error("Error during database shutdown:", err)
                }

                process.exit(0)
            })

            // 30초 후 강제 종료
            setTimeout(() => {
                SystemLogger.error("Graceful shutdown timed out, forcing exit")
                process.exit(1)
            }, 30000).unref()
        }

        process.once("SIGTERM", () => shutdown("SIGTERM"))
        process.once("SIGINT", () => shutdown("SIGINT"))

        process.once("unhandledRejection", (reason, promise) => {
            SystemLogger.error("Unhandled Rejection at:", { promise, reason })
            shutdown("unhandledRejection")
        })

        process.on("uncaughtException", (error) => {
            SystemLogger.error("Uncaught Exception:", error)
            process.exit(1)
        })
    } catch (error) {
        SystemLogger.error("Failed to start server:", error)
        process.exit(1)
    }
}

bootstrap()
