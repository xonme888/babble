export interface DatabaseConfig {
    type: "postgres"
    host?: string
    port?: number
    username?: string
    password?: string
    database: string
    synchronize: boolean
    logging: boolean
    pool?: {
        min: number
        max: number
        idleTimeoutMillis: number
    }
    /** 느린 쿼리 자동 로깅 threshold (ms) — 0이면 비활성화 */
    maxQueryExecutionTime: number
}

export interface RedisConfig {
    host: string
    port: number
    password?: string
    maxRetryAttempts: number
    retryLogThreshold: number
    maxRetryDelayMs: number
}

export interface JwtConfig {
    secret: string
    refreshSecret: string
    accessExpiry: string
    refreshExpiry: string
}

export interface SendGridConfig {
    apiKey?: string
    fromEmail: string
}

export interface BcryptConfig {
    rounds: number
}

export interface QueueConfig {
    attempts: number
    backoffDelay: number
    failedJobRetention: number
    completedJobRetention: number
    concurrency: number
    retryDelay: number // 도메인 레벨 자동 재시도 지연 (ms)
    encryptionKey?: string // 큐 데이터 암호화 전용 키 (JWT_SECRET과 분리)
}

export interface WorkerConfig {
    stuckCleanerIntervalMs: number
    stuckThresholdMinutes: number
    dlqMonitorIntervalMs: number
    dlqErrorThreshold: number
}

export interface UploadConfig {
    maxFileSizeBytes: number
}

export interface LogConfig {
    format: "json" | "text"
    debug: boolean
}

export interface AuthConfig {
    verificationCodeTTL: number
    resetCodeTTL: number
    refreshTokenTTL: number
    refreshTokenMaxAge: number
}

export interface GoogleMailConfig {
    user?: string
    password?: string
}

export interface AiServiceConfig {
    /** AI 분석 타임아웃 (ms) — Redis 큐 결과 폴링 대기 시간 */
    timeoutMs: number
}

export interface AppConfig {
    env: string
    port: number
    allowedOrigins: string[]
    mailProvider: "sendgrid" | "google" | "console"
    /** /metrics 엔드포인트 접근 토큰 — 미설정 시 IP 허용목록 fallback */
    metricsToken?: string
    database: DatabaseConfig
    redis: RedisConfig
    jwt: JwtConfig
    auth: AuthConfig
    sendgrid: SendGridConfig
    googleMail: GoogleMailConfig
    bcrypt: BcryptConfig
    queue: QueueConfig
    worker: WorkerConfig
    upload: UploadConfig
    log: LogConfig
    ai: AiServiceConfig
}

export interface IConfigService {
    readonly config: AppConfig
}
