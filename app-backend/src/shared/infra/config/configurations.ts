import { config } from "dotenv"
import * as path from "path"
import { cleanEnv, str, port, num, bool } from "envalid"
import { AppConfig } from "./configuration.interface"

// dotenv 로드 — data-source.ts가 configurations를 import하므로 여기서 보장
const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env"
config({ path: path.join(process.cwd(), envFile) })

/**
 * envalid 스키마로 환경변수 타입/기본값 검증
 * 프로덕션에서 누락/잘못된 타입의 환경변수는 프로세스 시작 시점에 즉시 실패한다.
 */
function validateEnv() {
    return cleanEnv(process.env, {
        // 앱 기본
        NODE_ENV: str({ default: "development", choices: ["development", "test", "production"] as const }),
        PORT: port({ default: 3000 }),
        ALLOWED_ORIGINS: str({ default: "" }),
        MAIL_PROVIDER: str({
            default: "google",
            choices: ["sendgrid", "google", "console"] as const,
        }),

        // 데이터베이스
        DATABASE_TYPE: str({ default: "postgres", choices: ["postgres"] as const }),
        DATABASE_HOST: str({ default: "localhost" }),
        DATABASE_PORT: num({ default: 5432 }),
        DATABASE_USERNAME: str({ default: "" }),
        DATABASE_PASSWORD: str({ default: "" }),
        DATABASE_DATABASE: str({ default: "babble" }),
        DATABASE_SYNCHRONIZE: bool({ default: false }),
        DATABASE_LOGGING: bool({ default: false }),
        DATABASE_POOL_MIN: num({ default: 2 }),
        DATABASE_POOL_MAX: num({ default: 20 }),
        DATABASE_POOL_IDLE_TIMEOUT: num({ default: 30000 }),
        DATABASE_MAX_QUERY_EXECUTION_TIME: num({ default: 0 }),

        // Redis
        REDIS_HOST: str({ default: "localhost" }),
        REDIS_PORT: port({ default: 6379 }),
        REDIS_PASSWORD: str({ default: "" }),
        REDIS_MAX_RETRY_ATTEMPTS: num({ default: 10 }),
        REDIS_RETRY_LOG_THRESHOLD: num({ default: 3 }),
        REDIS_MAX_RETRY_DELAY_MS: num({ default: 30000 }),

        // JWT
        JWT_SECRET: str({ devDefault: "dev-secret-key-change-this-in-production" }),
        JWT_REFRESH_SECRET: str({ devDefault: "dev-refresh-secret-key" }),
        JWT_ACCESS_EXPIRY: str({ default: "15m" }),
        JWT_REFRESH_EXPIRY: str({ default: "7d" }),

        // 인증
        VERIFICATION_CODE_TTL: num({ default: 600 }),
        RESET_CODE_TTL: num({ default: 600 }),
        REFRESH_TOKEN_TTL: num({ default: 604800 }),
        REFRESH_TOKEN_MAX_AGE: num({ default: 604800000 }),

        // SendGrid
        SENDGRID_APIKEY: str({ default: "" }),
        SENDGRID_FROMEMAIL: str({ default: "" }),

        // Google Mail
        GOOGLE_MAIL_USER: str({ default: "" }),
        GOOGLE_MAIL_PASSWORD: str({ default: "" }),

        // bcrypt
        BCRYPT_ROUNDS: num({ default: 10 }),

        // 큐
        QUEUE_ATTEMPTS: num({ default: 3 }),
        QUEUE_BACKOFF_DELAY: num({ default: 5000 }),
        QUEUE_FAILED_JOB_RETENTION: num({ default: 50 }),
        QUEUE_COMPLETED_JOB_RETENTION: num({ default: 100 }),
        QUEUE_CONCURRENCY: num({ default: 2 }),
        QUEUE_RETRY_DELAY: num({ default: 30000 }),
        QUEUE_ENCRYPTION_KEY: str({ devDefault: "" }),

        // Worker
        WORKER_STUCK_CLEANER_INTERVAL_MS: num({ default: 600000 }),
        WORKER_STUCK_THRESHOLD_MINUTES: num({ default: 30 }),
        WORKER_DLQ_MONITOR_INTERVAL_MS: num({ default: 300000 }),
        WORKER_DLQ_ERROR_THRESHOLD: num({ default: 10 }),

        // 파일 업로드
        UPLOAD_MAX_FILE_SIZE_BYTES: num({ default: 10485760 }),

        // 로깅
        LOG_FORMAT: str({ default: "json", choices: ["json", "text"] as const }),
        DEBUG: bool({ default: false }),

        // Metrics
        METRICS_TOKEN: str({ default: "" }),

        // AI Service (Redis 큐 방식 — 결과 폴링 타임아웃)
        AI_SERVICE_TIMEOUT_MS: num({ default: 60000 }),
    })
}

/** 캐싱된 AppConfig — cleanEnv() 재파싱 방지 */
let cached: AppConfig | null = null

/**
 * 환경변수 → AppConfig 매핑
 * envalid가 타입 검증을 수행하고, 이 함수가 AppConfig 인터페이스로 변환한다.
 * 결과는 캐싱되어 이후 호출 시 재파싱하지 않는다.
 */
export const configurations = (): AppConfig => {
    if (cached) return cached

    const env = validateEnv()

    const allowedOrigins = env.ALLOWED_ORIGINS
        ? env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
        : ["http://localhost:3000", "http://localhost:3001", "http://localhost:3009"]

    cached = {
        env: env.NODE_ENV,
        port: env.PORT,
        allowedOrigins,
        mailProvider: env.MAIL_PROVIDER as "sendgrid" | "google" | "console",
        metricsToken: env.METRICS_TOKEN || undefined,
        database: {
            type: env.DATABASE_TYPE as "postgres",
            host: env.DATABASE_HOST || undefined,
            port: env.DATABASE_PORT,
            username: env.DATABASE_USERNAME || undefined,
            password: env.DATABASE_PASSWORD || undefined,
            database: env.DATABASE_DATABASE,
            synchronize: env.DATABASE_SYNCHRONIZE,
            logging: env.DATABASE_LOGGING,
            maxQueryExecutionTime: env.DATABASE_MAX_QUERY_EXECUTION_TIME,
            pool: {
                min: env.DATABASE_POOL_MIN,
                max: env.DATABASE_POOL_MAX,
                idleTimeoutMillis: env.DATABASE_POOL_IDLE_TIMEOUT,
            },
        },
        redis: {
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            password: env.REDIS_PASSWORD || undefined,
            maxRetryAttempts: env.REDIS_MAX_RETRY_ATTEMPTS,
            retryLogThreshold: env.REDIS_RETRY_LOG_THRESHOLD,
            maxRetryDelayMs: env.REDIS_MAX_RETRY_DELAY_MS,
        },
        jwt: {
            secret: env.JWT_SECRET,
            refreshSecret: env.JWT_REFRESH_SECRET || env.JWT_SECRET,
            accessExpiry: env.JWT_ACCESS_EXPIRY,
            refreshExpiry: env.JWT_REFRESH_EXPIRY,
        },
        auth: {
            verificationCodeTTL: env.VERIFICATION_CODE_TTL,
            resetCodeTTL: env.RESET_CODE_TTL,
            refreshTokenTTL: env.REFRESH_TOKEN_TTL,
            refreshTokenMaxAge: env.REFRESH_TOKEN_MAX_AGE,
        },
        sendgrid: {
            apiKey: env.SENDGRID_APIKEY || undefined,
            fromEmail: env.SENDGRID_FROMEMAIL,
        },
        googleMail: {
            user: env.GOOGLE_MAIL_USER || undefined,
            password: env.GOOGLE_MAIL_PASSWORD || undefined,
        },
        bcrypt: {
            rounds: env.BCRYPT_ROUNDS,
        },
        queue: {
            attempts: env.QUEUE_ATTEMPTS,
            backoffDelay: env.QUEUE_BACKOFF_DELAY,
            failedJobRetention: env.QUEUE_FAILED_JOB_RETENTION,
            completedJobRetention: env.QUEUE_COMPLETED_JOB_RETENTION,
            concurrency: env.QUEUE_CONCURRENCY,
            retryDelay: env.QUEUE_RETRY_DELAY,
            encryptionKey: env.QUEUE_ENCRYPTION_KEY || undefined,
        },
        worker: {
            stuckCleanerIntervalMs: env.WORKER_STUCK_CLEANER_INTERVAL_MS,
            stuckThresholdMinutes: env.WORKER_STUCK_THRESHOLD_MINUTES,
            dlqMonitorIntervalMs: env.WORKER_DLQ_MONITOR_INTERVAL_MS,
            dlqErrorThreshold: env.WORKER_DLQ_ERROR_THRESHOLD,
        },
        upload: {
            maxFileSizeBytes: env.UPLOAD_MAX_FILE_SIZE_BYTES,
        },
        log: {
            format: env.LOG_FORMAT as "json" | "text",
            debug: env.DEBUG,
        },
        ai: {
            timeoutMs: env.AI_SERVICE_TIMEOUT_MS,
        },
    }

    return cached
}
