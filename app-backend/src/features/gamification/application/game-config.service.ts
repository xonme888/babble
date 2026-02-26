import { injectable, inject } from "tsyringe"
import { Transactional } from "typeorm-transactional"
import { createHash } from "crypto"
import { GameConfigRepository } from "../infrastructure/game-config.repository"
import { GameConfig } from "../domain/game-config.entity"
import { GameConfigHistory } from "../domain/game-config-history.entity"
import { validateGameConfigValue } from "../domain/game-config.validator"
import { ValidationException } from "@shared/core/exceptions/domain-exceptions"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"

/**
 * GameConfig Service
 * 인메모리 캐시 + CRUD + configVersion
 */
@injectable()
export class GameConfigService {
    /** 인메모리 캐시: key → { value, updatedAt } */
    private cache = new Map<string, { value: unknown; updatedAt: Date }>()

    constructor(
        @inject(GameConfigRepository) private gameConfigRepository: GameConfigRepository,
        @inject(DI_TOKENS.ILogger) private logger: ILogger
    ) {}

    /**
     * 앱 시작 시 전체 설정을 캐시에 로드
     */
    async loadAll(): Promise<void> {
        const configs = await this.gameConfigRepository.findAll()
        this.cache.clear()
        for (const config of configs) {
            this.cache.set(config.key, { value: config.value, updatedAt: config.updatedAt })
        }
        this.logger.info(`[GameConfigService] ${configs.length}개 설정 로드 완료`)
    }

    /**
     * 단일 값 조회 (캐시 우선)
     */
    get<T>(key: string, defaultValue: T): T {
        const cached = this.cache.get(key)
        if (cached !== undefined) {
            return cached.value as T
        }
        return defaultValue
    }

    /**
     * 카테고리별 조회 (캐시에서)
     */
    getByCategory(category: string): Record<string, unknown> {
        const result: Record<string, unknown> = {}
        for (const [key, entry] of this.cache.entries()) {
            if (key.startsWith(`${category}.`) || key.split(".")[0] === category) {
                result[key] = entry.value
            }
        }
        return result
    }

    /**
     * configVersion — MAX(updatedAt) SHA-256 해시 (ETag용)
     */
    getConfigVersion(): string {
        let maxDate = new Date(0)
        for (const entry of this.cache.values()) {
            if (entry.updatedAt > maxDate) {
                maxDate = entry.updatedAt
            }
        }
        return createHash("sha256").update(maxDate.toISOString()).digest("hex").slice(0, 16)
    }

    /**
     * 어드민 업데이트 — DB + 캐시 갱신 + 이력 저장
     */
    async update(
        key: string,
        value: unknown,
        updatedBy: number,
        description?: string
    ): Promise<GameConfig> {
        const validation = validateGameConfigValue(key, value)
        if (!validation.valid) {
            throw new ValidationException(`설정값 검증 실패 (${key}): ${validation.message}`)
        }

        const saved = await this.updateInTransaction(key, value, updatedBy, description)

        this.cache.set(key, { value: saved.value, updatedAt: saved.updatedAt })
        this.logger.info(`[GameConfigService] 설정 업데이트: ${key} by user ${updatedBy}`)
        return saved
    }

    /** DB 이력 저장 + 설정 업데이트를 원자적으로 수행 */
    @Transactional()
    private async updateInTransaction(
        key: string,
        value: unknown,
        updatedBy: number,
        description?: string
    ): Promise<GameConfig> {
        const existing = await this.gameConfigRepository.findByKeyOrThrow(key)

        const history = GameConfigHistory.create(
            existing.id,
            key,
            JSON.stringify(existing.value),
            JSON.stringify(value),
            updatedBy
        )
        await this.gameConfigRepository.saveHistory(history)

        existing.updateConfig(value, updatedBy, description)
        return this.gameConfigRepository.save(existing)
    }

    /**
     * 전체 설정 목록 (어드민용)
     */
    async getAll(): Promise<GameConfig[]> {
        return this.gameConfigRepository.findAll()
    }

    /**
     * 특정 키의 변경 이력 조회 (최근 20건)
     */
    async getHistory(key: string): Promise<GameConfigHistory[]> {
        return this.gameConfigRepository.findHistoryByKey(key)
    }
}
