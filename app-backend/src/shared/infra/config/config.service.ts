import { injectable } from "tsyringe"
import { ConfigurationException } from "@shared/core/exceptions/infrastructure-exceptions"
import { IConfigService } from "@shared/core/config.interface"
import { AppConfig } from "./configuration.interface"
import { configurations } from "./configurations"

/**
 * 환경 변수 기반 설정 서비스
 * 타입 검증은 envalid가 담당하고, 이 서비스는 시맨틱 검증만 수행한다.
 */
@injectable()
export class ConfigService implements IConfigService {
    private readonly _config: AppConfig

    constructor() {
        this._config = configurations()
        this.validateProductionSemantics()
    }

    /** 플레이스홀더 패턴 — 프로덕션에서 거부할 시크릿 값 */
    private static readonly PLACEHOLDER_PATTERNS = ["dev-secret", "dev-", "CHANGE_THIS", "change_this"]

    /** 값이 플레이스홀더 패턴을 포함하는지 확인 */
    private isPlaceholder(value: string): boolean {
        return ConfigService.PLACEHOLDER_PATTERNS.some((pattern) => value.includes(pattern))
    }

    /**
     * 프로덕션 시맨틱 검증 — dev 기본값/플레이스홀더 거부 등 비즈니스 규칙
     * (타입/필수값 검증은 envalid cleanEnv에서 수행)
     */
    private validateProductionSemantics(): void {
        const config = this._config
        if (config.env !== "production") return

        const errors: string[] = []
        if (!config.jwt.secret || this.isPlaceholder(config.jwt.secret)) {
            errors.push("JWT_SECRET must be set to a secure value for production (no placeholders)")
        }
        if (!config.jwt.refreshSecret || this.isPlaceholder(config.jwt.refreshSecret)) {
            errors.push("JWT_REFRESH_SECRET must be set to a secure value for production (no placeholders)")
        }
        if (!config.database.host) {
            errors.push("DATABASE_HOST must be set for production")
        }
        if (config.allowedOrigins.length === 0) {
            errors.push("ALLOWED_ORIGINS must be set for production")
        }
        if (!config.queue.encryptionKey) {
            errors.push("QUEUE_ENCRYPTION_KEY must be set for production (separate from JWT_SECRET)")
        }
        if (errors.length > 0) {
            throw new ConfigurationException(`Configuration Error:\n${errors.join("\n")}`)
        }
    }

    /**
     * 타입 안전한 전체 설정 객체 가져오기
     */
    get config(): AppConfig {
        return this._config
    }
}
