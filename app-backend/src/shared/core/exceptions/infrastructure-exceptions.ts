/**
 * 인프라 서비스 사용 불가 예외
 * Redis 등 필수 인프라 서비스가 미연결 시 throw
 */
export class ServiceUnavailableException extends Error {
    /** Minification-safe 식별자 */
    public readonly isInfrastructureException = true as const
    public readonly serviceName: string

    constructor(service: string) {
        super(`${service} is currently unavailable`)
        this.name = "ServiceUnavailableException"
        this.serviceName = service
        Object.setPrototypeOf(this, new.target.prototype)
    }
}

/**
 * DB 중복 키 에러 판별 (PostgreSQL + SQLite)
 */
export function isDuplicateKeyError(error: { message?: string; code?: string }): boolean {
    return (
        error.message?.includes("UNIQUE constraint failed") === true ||
        error.code === "23505" ||
        error.message?.includes("duplicate key value") === true
    )
}

/**
 * 설정 오류 예외
 * 부트스트랩 시점에서 필수 환경변수 누락/잘못된 설정 시 throw
 */
export class ConfigurationException extends Error {
    public readonly isInfrastructureException = true as const

    constructor(message: string) {
        super(message)
        this.name = "ConfigurationException"
        Object.setPrototypeOf(this, new.target.prototype)
    }
}
