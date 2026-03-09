import { injectable, inject } from "tsyringe"
import { UserLevelRepository } from "../infrastructure/user-level.repository"
import { XpTransactionRepository } from "../infrastructure/xp-transaction.repository"
import { BadgeService } from "./badge.service"
import type { ILearningRecordProvider } from "@features/learning/domain/learning-record-provider.interface"
import { DateUtils } from "@shared/utils/date.utils"
import { getOrFetch } from "@shared/utils/cache.utils"
import { IRedisService } from "@shared/core/redis-service.interface"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { GamificationRedisKeys, GamificationCacheTTL } from "../domain/gamification-redis-keys"
import type { IGamificationProvider } from "../domain/gamification-provider.interface"

/**
 * Gamification Service
 * 게임화 통합 API — 프로필, 뱃지, 리더보드
 */
@injectable()
export class GamificationService implements IGamificationProvider {
    constructor(
        @inject(UserLevelRepository) private userLevelRepository: UserLevelRepository,
        @inject(XpTransactionRepository) private xpTransactionRepository: XpTransactionRepository,
        @inject(BadgeService) private badgeService: BadgeService,
        @inject(DI_TOKENS.ILearningRecordProvider) private learningRecordService: ILearningRecordProvider,
        @inject(DI_TOKENS.IRedisService) private redisService: IRedisService,
        @inject(DI_TOKENS.ILogger) private logger: ILogger
    ) { }

    /**
     * 게임화 프로필 조회
     */
    async getProfile(userId: number): Promise<{
        level: number
        totalXp: number
        xpToNextLevel: number
        levelProgress: number
        weeklyXp: number
        currentStreak: number
        longestStreak: number
        unlockedBadgeCount: number
    }> {
        return getOrFetch(
            this.redisService,
            this.logger,
            GamificationRedisKeys.profile(userId),
            GamificationCacheTTL.PROFILE,
            async () => {
                const [userLevel, weeklyXp, streak, unlockedBadges] = await Promise.all([
                    this.userLevelRepository.findOrCreateByUserId(userId),
                    this.getWeeklyXp(userId),
                    this.learningRecordService.getStreak(userId),
                    this.badgeService.getUnlockedBadges(userId),
                ])

                return {
                    level: userLevel.level,
                    totalXp: userLevel.totalXp,
                    xpToNextLevel: userLevel.xpToNextLevel,
                    levelProgress: Math.round(userLevel.levelProgress * 100) / 100,
                    weeklyXp,
                    currentStreak: streak.currentStreak,
                    longestStreak: streak.longestStreak,
                    unlockedBadgeCount: unlockedBadges.length,
                }
            },
        )
    }

    /**
     * 뱃지 raw 데이터 조회 (전체 + 해금 목록)
     * 응답 포맷팅은 Presentation 계층(BadgeResponseDto)에서 처리
     */
    async getBadgesRaw(userId: number): Promise<{
        allBadges: Awaited<ReturnType<BadgeService["getAllBadges"]>>
        unlockedBadges: Awaited<ReturnType<BadgeService["getUnlockedBadges"]>>
    }> {
        const [allBadges, unlockedBadges] = await Promise.all([
            this.badgeService.getAllBadges(),
            this.badgeService.getUnlockedBadges(userId),
        ])

        return { allBadges, unlockedBadges }
    }

    /**
     * XP 리더보드
     */
    async getLeaderboard(limit: number = 10): Promise<
        Array<{
            rank: number
            userId: number
            firstName: string
            level: number
            totalXp: number
        }>
    > {
        return getOrFetch(
            this.redisService,
            this.logger,
            GamificationRedisKeys.leaderboard(limit),
            GamificationCacheTTL.LEADERBOARD,
            async () => {
                const topUsers = await this.userLevelRepository.getLeaderboard(limit)
                return topUsers.map((ul, index) => ({
                    rank: index + 1,
                    userId: ul.userId,
                    firstName: ul.user?.firstName ?? "익명",
                    level: ul.level,
                    totalXp: ul.totalXp,
                }))
            },
        )
    }

    /**
     * 업적 목록 (기존 user.service.getAchievements 대체)
     */
    async getAchievements(userId: number): Promise<
        Array<{
            id: string
            title: string
            description: string
            iconName: string
            isUnlocked: boolean
            unlockedAt: Date | null
        }>
    > {
        const { allBadges, unlockedBadges } = await this.getBadgesRaw(userId)
        const unlockedMap = new Map(unlockedBadges.map((ub) => [ub.badgeId, ub.unlockedAt]))

        return allBadges.map((badge) => ({
            id: String(badge.id),
            title: badge.title,
            description: badge.description,
            iconName: badge.iconName,
            isUnlocked: unlockedMap.has(badge.id),
            unlockedAt: unlockedMap.get(badge.id) ?? null,
        }))
    }

    private async getWeeklyXp(userId: number): Promise<number> {
        const monday = DateUtils.getKSTWeekStart()
        return this.xpTransactionRepository.getWeeklyXp(userId, monday)
    }

    /**
     * 미확인 보상 조회 (뱃지, 레벨업)
     */
    async getUnseenRewards(userId: number): Promise<{
        levelUps: Array<{
            fromLevel: number
            toLevel: number
            achievedAt: Date
        }>
        newBadges: Array<{
            id: number
            code: string
            title: string
            description: string
            iconName: string
            category: string
            unlockedAt: Date
        }>
    }> {
        const unseenBadges = await this.badgeService.getUnseenBadges(userId)
        const userLevel = await this.userLevelRepository.findOrCreateByUserId(userId)

        const levelUps: Array<{ fromLevel: number; toLevel: number; achievedAt: Date }> = []
        const unseenLevelUp = userLevel.getUnseenLevelUp()
        if (unseenLevelUp) {
            levelUps.push({ ...unseenLevelUp, achievedAt: userLevel.updatedAt })
        }

        return {
            levelUps,
            newBadges: unseenBadges.map((ub) => ({
                id: ub.badge.id,
                code: ub.badge.code,
                title: ub.badge.title,
                description: ub.badge.description,
                iconName: ub.badge.iconName,
                category: ub.badge.category,
                unlockedAt: ub.unlockedAt,
            })),
        }
    }

    /**
     * 보상 확인 처리
     */
    async acknowledgeRewards(
        userId: number,
        badgeIds: number[] = [],
        levelAcknowledged?: number,
    ): Promise<{
        acknowledgedBadges: number
        acknowledgedLevel: number | null
    }> {
        let acknowledgedBadges = 0
        if (badgeIds.length > 0) {
            await this.badgeService.markBadgesAsSeen(userId, badgeIds)
            acknowledgedBadges = badgeIds.length
        }

        let acknowledgedLevelResult: number | null = null
        if (levelAcknowledged !== undefined) {
            const userLevel = await this.userLevelRepository.findOrCreateByUserId(userId)
            if (userLevel.canAcknowledgeLevel(levelAcknowledged)) {
                await this.userLevelRepository.updateLastSeenLevel(userId, levelAcknowledged)
                acknowledgedLevelResult = levelAcknowledged
            }
        }

        return {
            acknowledgedBadges,
            acknowledgedLevel: acknowledgedLevelResult,
        }
    }
}
