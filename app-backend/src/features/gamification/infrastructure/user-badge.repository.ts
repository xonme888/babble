import { injectable, inject } from "tsyringe"
import { DataSource, Repository, IsNull, In } from "typeorm"
import { UserBadge } from "../domain/user-badge.entity"
import { DI_TOKENS } from "@shared/core/di-tokens"

/**
 * UserBadge Repository
 */
@injectable()
export class UserBadgeRepository {
    private repo: Repository<UserBadge>

    constructor(@inject(DI_TOKENS.DataSource) private dataSource: DataSource) {
        this.repo = this.dataSource.getRepository(UserBadge)
    }

    async save(userBadge: UserBadge): Promise<UserBadge> {
        return this.repo.save(userBadge)
    }

    /** 여러 UserBadge를 한 번에 저장 (배치) */
    async saveAll(userBadges: UserBadge[]): Promise<UserBadge[]> {
        if (userBadges.length === 0) return []
        return this.repo.save(userBadges)
    }

    /**
     * 사용자가 특정 뱃지를 이미 해금했는지 확인
     */
    async existsByUserAndBadge(userId: number, badgeId: number): Promise<boolean> {
        return this.repo.existsBy({ userId, badgeId })
    }

    /**
     * 사용자가 해금한 뱃지 ID 목록을 한 번에 조회 (N+1 방지)
     */
    async findUnlockedBadgeIdsByUser(userId: number): Promise<Set<number>> {
        const results = await this.repo.find({
            where: { userId },
            select: ["badgeId"],
        })
        return new Set(results.map((ub) => ub.badgeId))
    }

    /**
     * 사용자의 해금된 뱃지 목록
     */
    async findUnlockedByUserId(userId: number): Promise<UserBadge[]> {
        return this.repo.find({
            where: { userId },
            relations: ["badge"],
            order: { unlockedAt: "DESC" },
        })
    }

    /**
     * 사용자가 확인하지 않은 뱃지 목록
     */
    async findUnseenByUserId(userId: number): Promise<UserBadge[]> {
        return this.repo.find({
            where: {
                userId,
                seenAt: IsNull(),
            },
            relations: ["badge"],
            order: { unlockedAt: "ASC" },
        })
    }

    /**
     * 모든 미확인 뱃지를 확인 처리
     */
    async markAllAsSeen(userId: number): Promise<void> {
        await this.repo.update(
            { userId, seenAt: IsNull() },
            { seenAt: new Date() }
        )
    }

    /**
     * 특정 뱃지 목록을 확인 처리
     */
    async markAsSeen(userId: number, badgeIds: number[]): Promise<void> {
        if (badgeIds.length === 0) return

        await this.repo.update(
            {
                userId,
                badgeId: In(badgeIds),
                seenAt: IsNull(),
            },
            { seenAt: new Date() }
        )
    }
}
