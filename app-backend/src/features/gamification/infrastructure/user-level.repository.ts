import { injectable, inject } from "tsyringe"
import { DataSource, Repository } from "typeorm"
import { UserLevel } from "../domain/user-level.entity"
import { DI_TOKENS } from "@shared/core/di-tokens"

/**
 * UserLevel Repository
 */
@injectable()
export class UserLevelRepository {
    private repo: Repository<UserLevel>

    constructor(@inject(DI_TOKENS.DataSource) private dataSource: DataSource) {
        this.repo = this.dataSource.getRepository(UserLevel)
    }

    async save(level: UserLevel): Promise<UserLevel> {
        return this.repo.save(level)
    }

    /**
     * 사용자 레벨 조회 또는 생성 (없으면 레벨 1 생성)
     * UPSERT로 race condition 방지 (userId 유니크 인덱스 활용)
     */
    async findOrCreateByUserId(userId: number): Promise<UserLevel> {
        await this.repo
            .createQueryBuilder()
            .insert()
            .into(UserLevel)
            .values({ userId, level: 1, totalXp: 0, lastSeenLevel: 1 })
            .orIgnore()
            .execute()

        return this.repo.findOneByOrFail({ userId })
    }

    /**
     * 전체 레벨 랭킹 (리더보드용)
     */
    async getLeaderboard(limit: number = 10): Promise<UserLevel[]> {
        return this.repo.find({
            order: { totalXp: "DESC" },
            take: limit,
            relations: ["user"],
        })
    }

    /**
     * 사용자가 확인한 마지막 레벨 업데이트
     */
    async updateLastSeenLevel(userId: number, level: number): Promise<void> {
        await this.repo.update({ userId }, { lastSeenLevel: level })
    }
}
