import { injectable, inject } from "tsyringe"
import { DataSource, Repository } from "typeorm"
import { XpTransaction, XpSource } from "../domain/xp-transaction.entity"
import { DEFAULT_PAGE_LIMIT } from "@shared/core/constants/pagination.constants"
import { DI_TOKENS } from "@shared/core/di-tokens"

/**
 * XpTransaction Repository
 */
@injectable()
export class XpTransactionRepository {
    private repo: Repository<XpTransaction>

    constructor(@inject(DI_TOKENS.DataSource) private dataSource: DataSource) {
        this.repo = this.dataSource.getRepository(XpTransaction)
    }

    async save(tx: XpTransaction): Promise<XpTransaction> {
        return this.repo.save(tx)
    }

    /**
     * 동일 source + referenceId 조합의 트랜잭션 존재 여부 (멱등성 가드)
     */
    async existsBySourceAndReference(
        userId: number,
        source: XpSource,
        referenceId: number
    ): Promise<boolean> {
        return this.repo.existsBy({ userId, source, referenceId })
    }

    /**
     * 이번 주 획득 XP 합계
     */
    async getWeeklyXp(userId: number, weekStart: Date): Promise<number> {
        const result = await this.repo
            .createQueryBuilder("tx")
            .select("COALESCE(SUM(tx.amount), 0)", "total")
            .where("tx.userId = :userId", { userId })
            .andWhere("tx.createdAt >= :weekStart", { weekStart })
            .getRawOne()

        return parseInt(result?.total || "0", 10)
    }

    /**
     * 최근 XP 이력 조회
     */
    async findRecentByUserId(userId: number, limit: number = DEFAULT_PAGE_LIMIT): Promise<XpTransaction[]> {
        return this.repo.find({
            where: { userId },
            order: { createdAt: "DESC" },
            take: limit,
        })
    }
}
