import { injectable, inject } from "tsyringe"
import { DataSource, Repository } from "typeorm"
import { GameConfig } from "../domain/game-config.entity"
import { GameConfigHistory } from "../domain/game-config-history.entity"
import { NotFoundException } from "@shared/core/exceptions/domain-exceptions"
import { DI_TOKENS } from "@shared/core/di-tokens"

/** 변경 이력 기본 조회 건수 */
const HISTORY_DEFAULT_LIMIT = 20

/**
 * GameConfig Repository
 */
@injectable()
export class GameConfigRepository {
    private repo: Repository<GameConfig>
    private historyRepo: Repository<GameConfigHistory>

    constructor(@inject(DI_TOKENS.DataSource) private dataSource: DataSource) {
        this.repo = this.dataSource.getRepository(GameConfig)
        this.historyRepo = this.dataSource.getRepository(GameConfigHistory)
    }

    async findAll(): Promise<GameConfig[]> {
        return this.repo.find({ order: { category: "ASC", key: "ASC" } })
    }

    async findByKey(key: string): Promise<GameConfig | null> {
        return this.repo.findOneBy({ key })
    }

    async findByKeyOrThrow(key: string, message?: string): Promise<GameConfig> {
        const entity = await this.findByKey(key)
        if (!entity) throw new NotFoundException(message ?? `설정을 찾을 수 없습니다: ${key}`)
        return entity
    }

    async findByCategory(category: string): Promise<GameConfig[]> {
        return this.repo.find({ where: { category }, order: { key: "ASC" } })
    }

    async save(config: GameConfig): Promise<GameConfig> {
        return this.repo.save(config)
    }

    async update(id: number, partial: Partial<GameConfig>): Promise<void> {
        await this.repo.update(id, partial as Record<string, unknown>)
    }

    async saveHistory(history: GameConfigHistory): Promise<GameConfigHistory> {
        return this.historyRepo.save(history)
    }

    /**
     * 특정 키의 변경 이력 조회 (최근 N건)
     */
    async findHistoryByKey(key: string): Promise<GameConfigHistory[]> {
        return this.historyRepo.find({
            where: { key },
            order: { changedAt: "DESC" },
            take: HISTORY_DEFAULT_LIMIT,
        })
    }
}
