import "reflect-metadata"
import express from "express"
import cookieParser from "cookie-parser"
import path from "path"
import { getAuthRouter } from "@features/auth/presentation/auth.routes"
import { getUserRouter } from "@features/user/presentation/user.routes"
import { getAssessmentRouter } from "@features/assessment/presentation/assessment.routes"
import { getScriptRouter } from "@features/script/presentation/script.routes"
import { getLearningRecordRouter } from "@features/learning/presentation/learning-record.routes"
import { getGameSessionRouter } from "@features/game/presentation/game-session.routes"
import { getDailyChallengeRouter } from "@features/game/presentation/daily-challenge.routes"
import { getGamificationRouter } from "@features/gamification/presentation/gamification.routes"
import {
    getGameConfigClientRouter,
    getGameConfigAdminRouter,
} from "@features/gamification/presentation/game-config.routes"
import { getPhonemeRouter } from "@features/phoneme/presentation/phoneme.routes"
import { getErrorPatternAdminRouter } from "@features/phoneme/presentation/error-pattern-admin.routes"
import { getMinimalPairRouter } from "@features/phoneme/presentation/minimal-pair.routes"
import { getMinimalPairAdminRouter } from "@features/phoneme/presentation/minimal-pair-admin.routes"
import { getSrsRouter } from "@features/srs/presentation/srs.routes"
import { getNotificationRouter } from "@features/notification/presentation/notification.routes"
import { getWeeklyReportRouter } from "@features/weekly-report/presentation/weekly-report.routes"
import { getAnalyticsAdminRouter } from "@features/analytics/presentation/analytics-admin.routes"
import { getReportsAdminRouter } from "@features/weekly-report/presentation/reports-admin.routes"
import { getScenarioAdminRouter } from "@features/scenario/presentation/scenario-admin.routes"
import { getNotificationAdminRouter } from "@features/notification/presentation/notification-admin.routes"
import { getErrorPatternRouter } from "@features/phoneme/presentation/error-pattern.routes"
import { getDiscriminationRouter } from "@features/phoneme/presentation/discrimination.routes"
import { getScenarioRouter } from "@features/scenario/presentation/scenario.routes"
import { getTherapyRouter } from "@features/therapy/presentation/therapy.routes"
import { getSlpDashboardRouter } from "@features/therapy/presentation/slp-dashboard.routes"
import { getDifficultyRouter } from "@features/difficulty/presentation/difficulty.routes"
import { getVoiceDiaryRouter } from "@features/voice-diary/presentation/voice-diary.routes"
import { getFamilyRouter } from "@features/family/presentation/family.routes"
import { getResearchAdminRouter } from "@features/research/presentation/research-admin.routes"
import { globalErrorHandler } from "@shared/presentation/middlewares/error.handler"
import { traceMiddleware } from "@shared/presentation/middlewares/trace.middleware"
import { container } from "tsyringe"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import pinoHttp from "pino-http"
import { PinoLogger, sanitize } from "@shared/infra/logging/pino-logger"
import { TraceContext } from "@shared/infra/logging/trace-context"
import helmet from "helmet"
import cors from "cors"
import swaggerJsdoc from "swagger-jsdoc"
import swaggerUi from "swagger-ui-express"
import { i18nMiddleware } from "@lib/i18n"
import { setupDI } from "@shared/infra/di/diconfig"
import { collectDefaultMetrics } from "prom-client"
import { ConfigService } from "@shared/infra/config/config.service"
import { createBullBoard } from "@bull-board/api"
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter"
import { ExpressAdapter } from "@bull-board/express"
import { assessmentAnalysisQueue } from "@shared/infra/queue/analysis.queue"
import { emailQueue } from "@shared/infra/queue/email.queue"
import { createSSERedisSubscriber } from "@shared/infra/notifications/sse-redis.subscriber"
import { createUserNotificationSubscriber } from "@shared/infra/notifications/user-notification.subscriber"
import { IRedisService } from "@shared/core/redis-service.interface"
import { authGuard } from "@features/auth/presentation/guards/auth.guard"
import { adminGuard } from "@features/auth/presentation/guards/admin.guard"

// Initialize Prometheus default metrics collection (happens once on module load)
collectDefaultMetrics()

export async function createApp() {
    // 로거는 컨테이너에서 가져옴. 컨테이너가 초기화 안 됐으면 초기화 시도.
    if (!container.isRegistered(DI_TOKENS.ILogger)) {
        await setupDI()
    }

    const logger = container.resolve<ILogger>(DI_TOKENS.ILogger)

    // 2. Express 앱 설정
    const app = express()

    // 2.1. 실시간 알림 구독자 시작 (SSE용, 수평 확장 대응 — Redis Pub/Sub 기반)
    // 각 인스턴스가 독립적으로 Redis Pub/Sub을 구독하므로 replicas: 2에서도 알림 누락 없음
    const sseSubscriber = createSSERedisSubscriber() // admin 브로드캐스트
    const userNotificationSubscriber = createUserNotificationSubscriber() // 사용자 타겟 전송

    // 3. 미들웨어 설정
    // Helmet 기본 보안 헤더 (CSP는 경로별 분리 적용)
    app.use(
        helmet({
            contentSecurityPolicy: false,
            crossOriginOpenerPolicy: { policy: "unsafe-none" },
            crossOriginResourcePolicy: { policy: "cross-origin" },
        })
    )

    // 경로별 CSP — Swagger UI에만 unsafe-inline 허용
    const swaggerCsp = helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "https:", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    })
    const defaultCsp = helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "https:"],
            imgSrc: ["'self'", "data:", "https:"],
            upgradeInsecureRequests: null, // Localhost에서 HTTPS 강제 리다이렉트 방지
        },
    })
    app.use((req, res, next) => {
        if (req.path.startsWith("/api-docs")) {
            swaggerCsp(req, res, next)
        } else {
            defaultCsp(req, res, next)
        }
    })

    const configService = container.resolve(ConfigService)
    const allowedOrigins = configService.config.allowedOrigins

    app.use(
        cors({
            origin: (origin, callback) => {
                // 허용 목록에 있는 경우 허용
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true)
                } else {
                    logger.warn(`CORS blocked: ${origin}`)
                    callback(new Error("Not allowed by CORS"))
                }
            },
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
            allowedHeaders: [
                "Content-Type",
                "Authorization",
                "x-client-type",
                "Accept-Language",
                "X-Request-Id",
            ],
        })
    )
    app.use(i18nMiddleware) // i18n 미들웨어 추가
    app.use(traceMiddleware)
    app.use(express.json({ limit: "1mb" }))
    app.use(express.urlencoded({ extended: true, limit: "1mb" }))
    app.use(cookieParser())

    // Serve static files from uploads directory (for audio recordings) - 인증 필요
    app.use("/uploads", authGuard, express.static(path.join(process.cwd(), "uploads")))

    // 4. pino-http 구조화된 로깅 미들웨어
    const pinoLogger = container.resolve(PinoLogger)
    const isDev = configService.config.env !== "production"

    // Response body 캡처 — pinoHttp에서 응답 본문 로깅용
    app.use((_req, res, next) => {
        const originalJson = res.json.bind(res)
        res.json = function (body: unknown) {
            res.__body = body
            return originalJson(body)
        } as typeof res.json
        next()
    })

    app.use(
        pinoHttp({
            logger: pinoLogger.getInstance(),
            autoLogging: {
                ignore: (req) => req.url === "/health" || req.url === "/metrics",
            },
            customProps: () => {
                const traceId = TraceContext.getTraceId()
                return traceId ? { traceId } : {}
            },
            // 2xx~4xx 응답 로깅 — 개발: 항상 body, 프로덕션: 에러(4xx)만 body
            customSuccessObject: (req, res, val) => {
                const isError = res.statusCode >= 400
                if (!isDev && !isError) return val

                const extras: Record<string, unknown> = {}
                const resBody = res.__body
                if (resBody) extras.responseBody = sanitize(resBody)
                // 프로덕션 에러 시 요청 body도 포함 (개발은 req serializer에서 이미 포함)
                if (!isDev && isError) {
                    const reqBody = req.body
                    if (reqBody) extras.requestBody = sanitize(reqBody)
                }
                return { ...val, ...extras }
            },
            // 5xx/에러 응답 로깅 — 항상 요청+응답 body 포함
            customErrorObject: (req, res, _error, val) => {
                const extras: Record<string, unknown> = {}
                const resBody = res.__body
                if (resBody) extras.responseBody = sanitize(resBody)
                const reqBody = req.body
                if (reqBody) extras.requestBody = sanitize(reqBody)
                return { ...val, ...extras }
            },
            serializers: {
                req: (req) => ({
                    method: req.method,
                    url: req.url,
                    query: req.query,
                    ...(isDev && req.raw?.body ? { body: sanitize(req.raw.body) } : {}),
                }),
                res: (res) => ({
                    statusCode: res.statusCode,
                }),
            },
        })
    )

    // OpenAPI / Swagger — 프로덕션에서 비활성화
    if (configService.config.env === "production") {
        app.use("/api-docs", (_req, res) => res.status(404).json({ message: "Not Found" }))
        app.get("/api-docs.json", (_req, res) => res.status(404).json({ message: "Not Found" }))
    } else {
    const swaggerSpec = swaggerJsdoc({
        definition: {
            openapi: "3.0.3",
            info: {
                title: "Babble API",
                version: "1.0.0",
                description: "Babble API — 발음 연습 서비스",
            },
            servers: [{ url: "/api/v1" }],
            components: {
                securitySchemes: {
                    bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
                },
                schemas: {
                    SuccessResponse: {
                        type: "object",
                        properties: {
                            success: { type: "boolean", example: true },
                            data: { type: "object" },
                            message: { type: "string" },
                        },
                    },
                    ApiErrorResponse: {
                        type: "object",
                        properties: {
                            success: { type: "boolean", example: false },
                            message: { type: "string" },
                            errorCode: { type: "string" },
                            errorKey: { type: "string" },
                        },
                    },
                    PaginatedResponse: {
                        type: "object",
                        properties: {
                            items: { type: "array", items: {} },
                            total: { type: "integer" },
                            limit: { type: "integer" },
                            offset: { type: "integer" },
                        },
                    },
                },
            },
            security: [{ bearerAuth: [] }],
        },
        apis: ["./src/features/**/dtos/*.ts", "./src/features/**/*.routes.ts"],
    })
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))
    app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec))
    } // end swagger dev-only block

    // 5. 라우터 설정
    app.use("/api/v1/auth", getAuthRouter())
    app.use("/api/v1/users", getUserRouter())
    app.use("/api/v1/assessments", getAssessmentRouter())
    app.use("/api/v1/scripts", getScriptRouter())
    app.use("/api/v1/learning-records", getLearningRecordRouter())
    app.use("/api/v1/game-sessions", getGameSessionRouter())
    app.use("/api/v1/challenges", getDailyChallengeRouter())
    app.use("/api/v1/gamification", getGamificationRouter())
    app.use("/api/v1/game-configs", getGameConfigClientRouter())
    app.use("/api/v1/admin/game-configs", getGameConfigAdminRouter())
    app.use("/api/v1/phoneme-scores", getPhonemeRouter())
    app.use("/api/v1/admin/error-patterns", getErrorPatternAdminRouter())
    app.use("/api/v1/minimal-pairs", getMinimalPairRouter())
    app.use("/api/v1/admin/minimal-pairs", getMinimalPairAdminRouter())
    app.use("/api/v1/srs", getSrsRouter())
    app.use("/api/v1/notifications", getNotificationRouter())
    app.use("/api/v1/weekly-reports", getWeeklyReportRouter())
    app.use("/api/v1/admin/analytics", getAnalyticsAdminRouter())
    app.use("/api/v1/admin/reports", getReportsAdminRouter())
    app.use("/api/v1", getScenarioRouter())
    app.use("/api/v1/admin/scenarios", getScenarioAdminRouter())
    app.use("/api/v1/admin/notifications", getNotificationAdminRouter())
    app.use("/api/v1/therapy", getTherapyRouter())
    app.use("/api/v1/therapy/discrimination-sessions", getDiscriminationRouter())
    app.use("/api/v1/slp", getSlpDashboardRouter())
    app.use("/api/v1/phonemes/error-patterns", getErrorPatternRouter())
    app.use("/api/v1/phonemes/minimal-pairs", getMinimalPairRouter())
    app.use("/api/v1/difficulty", getDifficultyRouter())
    app.use("/api/v1/voice-diaries", getVoiceDiaryRouter())
    app.use("/api/v1/family", getFamilyRouter())
    app.use("/api/v1/admin/research", getResearchAdminRouter())

    // Bull Board 설정
    try {
        const serverAdapter = new ExpressAdapter()
        serverAdapter.setBasePath("/admin/queues")

        createBullBoard({
            queues: [new BullMQAdapter(assessmentAnalysisQueue), new BullMQAdapter(emailQueue)],
            serverAdapter: serverAdapter,
        })

        app.use("/admin/queues", authGuard, adminGuard, serverAdapter.getRouter())
        logger.info("Bull Board initialized at /admin/queues")
    } catch (e) {
        logger.error("Failed to initialize Bull Board", e)
    }

    // 6. Prometheus Metrics Endpoint (토큰 인증 또는 내부 네트워크만 접근 허용)
    const metricsToken = configService.config.metricsToken
    app.get("/metrics", async (req, res) => {
        // 1차: Bearer 토큰 인증 (Prometheus authorization 호환)
        if (metricsToken) {
            const auth = req.headers.authorization || ""
            const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : ""
            if (bearer !== metricsToken) {
                return res.status(403).json({ message: "Forbidden" })
            }
        } else {
            // 2차 fallback: IP 허용목록 (토큰 미설정 시)
            const clientIP = req.ip || req.socket.remoteAddress || ""
            const isInternal =
                ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(clientIP) ||
                clientIP.startsWith("172.") ||
                clientIP.startsWith("192.168.") ||
                clientIP.startsWith("10.") ||
                clientIP.startsWith("::ffff:172.") ||
                clientIP.startsWith("::ffff:192.168.") ||
                clientIP.startsWith("::ffff:10.")

            if (!isInternal) {
                return res.status(403).json({ message: "Forbidden" })
            }
        }

        try {
            const { register } = await import("prom-client")
            res.set("Content-Type", register.contentType)
            res.end(await register.metrics())
        } catch (ex) {
            logger.error("Failed to collect metrics", ex)
            res.status(500).json({ message: "Failed to collect metrics" })
        }
    })

    // 헬스체크 (강화된 버전)
    app.get("/health", async (req, res) => {
        const health: {
            status: string
            timestamp: string
            uptime: number
            checks: {
                database: string
                redis: string
                aiWorker: string
            }
        } = {
            status: "ok",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            checks: {
                database: "unknown",
                redis: "unknown",
                aiWorker: "unknown",
            },
        }

        // 데이터베이스 연결 체크
        try {
            const { AppDataSource } = await import("@shared/infra/persistence/data-source")
            health.checks.database = AppDataSource.isInitialized ? "healthy" : "unhealthy"
        } catch {
            health.checks.database = "error"
            health.status = "degraded"
        }

        // Redis 연결 체크
        let redisService: IRedisService | null = null
        try {
            redisService = container.resolve<IRedisService>(DI_TOKENS.IRedisService)
            await redisService.ping()
            health.checks.redis = "healthy"
        } catch {
            health.checks.redis = "error"
        }

        // AI Worker 하트비트 체크
        if (redisService) {
            try {
                const heartbeat = await redisService.get("ai:worker:heartbeat")
                health.checks.aiWorker = heartbeat ? "healthy" : "unavailable"
            } catch {
                health.checks.aiWorker = "error"
            }
        }

        // 전체 상태 판단
        const isHealthy = health.checks.database === "healthy"
        const statusCode = isHealthy ? 200 : 503

        res.status(statusCode).json(health)
    })

    // 6. 전역 에러 핸들러 (반드시 라우터 뒤에 위치)
    app.use(globalErrorHandler)

    return {
        app,
        /** SSE 구독자 정리 — graceful shutdown 시 호출 */
        closeSubscribers: async () => {
            await sseSubscriber.close()
            await userNotificationSubscriber.close()
        },
    }
}
