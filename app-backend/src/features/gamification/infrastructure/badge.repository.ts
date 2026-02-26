import { injectable, inject } from "tsyringe"
import { DataSource, Repository } from "typeorm"
import { Badge } from "../domain/badge.entity"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { ILogger } from "@shared/core/logger.interface"

/** 뱃지 마스터 데이터 캐시 TTL (5분) */
const BADGE_CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Badge Repository
 * 마스터 데이터 인메모리 캐싱 — 뱃지는 변경 빈도가 매우 낮음
 */
@injectable()
export class BadgeRepository {
    private repo: Repository<Badge>
    private cachedBadges: Badge[] | null = null
    private cacheExpiresAt: number = 0

    constructor(
        @inject(DI_TOKENS.DataSource) private dataSource: DataSource,
        @inject(DI_TOKENS.ILogger) private logger: ILogger
    ) {
        this.repo = this.dataSource.getRepository(Badge)
    }

    async save(badge: Badge): Promise<Badge> {
        this.invalidateCache()
        return this.repo.save(badge)
    }

    async findAll(): Promise<Badge[]> {
        if (this.cachedBadges && Date.now() < this.cacheExpiresAt) {
            return this.cachedBadges
        }

        const badges = await this.repo.find({ order: { orderIndex: "ASC" } })
        this.cachedBadges = badges
        this.cacheExpiresAt = Date.now() + BADGE_CACHE_TTL_MS
        this.logger.debug(`[BadgeRepository] 캐시 갱신: ${badges.length}개 뱃지`)
        return badges
    }

    async findByCode(code: string): Promise<Badge | null> {
        return this.repo.findOneBy({ code })
    }

    async findById(id: number): Promise<Badge | null> {
        return this.repo.findOneBy({ id })
    }

    /** 캐시 무효화 — save 또는 외부에서 강제 무효화 시 호출 */
    invalidateCache(): void {
        this.cachedBadges = null
        this.cacheExpiresAt = 0
    }
}
