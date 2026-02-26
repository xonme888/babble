import { injectable, inject } from "tsyringe"
import { XpTransactionRepository } from "../infrastructure/xp-transaction.repository"
import { UserLevelRepository } from "../infrastructure/user-level.repository"
import { XpTransaction, XpSource } from "../domain/xp-transaction.entity"
import { LevelUpEvent } from "../domain/events/level-up.event"
import { IDomainEventDispatcher } from "@shared/core/domain-event-dispatcher.interface"
import { IRedisService } from "@shared/core/redis-service.interface"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { DateUtils } from "@shared/utils/date.utils"
import { GamificationRedisKeys } from "../domain/gamification-redis-keys"
import type { IXpAwarder } from "../domain/xp-awarder.interface"

/**
 * XP Service
 * XP 부여, 레벨 갱신, 레벨업 이벤트 발행
 */
@injectable()
export class XpService implements IXpAwarder {
    constructor(
        @inject(XpTransactionRepository) private xpTransactionRepository: XpTransactionRepository,
        @inject(UserLevelRepository) private userLevelRepository: UserLevelRepository,
        @inject(DI_TOKENS.IDomainEventDispatcher) private eventDispatcher: IDomainEventDispatcher,
        @inject(DI_TOKENS.IRedisService) private redisService: IRedisService,
        @inject(DI_TOKENS.ILogger) private logger: ILogger
    ) {}

    /**
     * XP 부여 — 트랜잭션 기록 + 레벨 갱신
     */
    async awardXp(params: {
        userId: number
        amount: number
        source: XpSource
        referenceId?: number
        description?: string
    }): Promise<void> {
        // 의도적 skip: 0 이하 XP는 부여할 필요 없음
        if (params.amount <= 0) return

        // 멱등성 가드: referenceId가 있으면 중복 체크
        if (params.referenceId != null) {
            const exists = await this.xpTransactionRepository.existsBySourceAndReference(
                params.userId, params.source, params.referenceId
            )
            if (exists) {
                this.logger.warn(
                    `[XpService] 중복 XP 요청 무시: userId=${params.userId}, source=${params.source}, ref=${params.referenceId}`
                )
                return
            }
        }

        // XP 트랜잭션 기록
        const xpTransaction = XpTransaction.create(params)
        await this.xpTransactionRepository.save(xpTransaction)

        // 유저 레벨 갱신
        const userLevel = await this.userLevelRepository.findOrCreateByUserId(params.userId)
        const leveledUp = userLevel.addXp(params.amount)
        await this.userLevelRepository.save(userLevel)

        this.logger.info(
            `[XpService] User ${params.userId} +${params.amount} XP (${params.source}), Level ${userLevel.level}`
        )

        if (leveledUp) {
            const event = new LevelUpEvent(params.userId, userLevel.level, userLevel.totalXp)
            this.eventDispatcher.dispatchAsync(event)
        }

        await this.invalidateGamificationCache(params.userId)
    }

    /**
     * 이번 주 획득 XP
     */
    async getWeeklyXp(userId: number): Promise<number> {
        const monday = DateUtils.getKSTWeekStart()
        return this.xpTransactionRepository.getWeeklyXp(userId, monday)
    }

    /** XP 변경 후 프로필 + 리더보드 캐시 무효화 */
    private async invalidateGamificationCache(userId: number): Promise<void> {
        try {
            await Promise.all([
                this.redisService.delete(GamificationRedisKeys.profile(userId)),
                this.redisService.delete(GamificationRedisKeys.leaderboard(10)),
            ])
        } catch (error) {
            this.logger.warn("게임화 캐시 무효화 실패", error)
        }
    }
}
