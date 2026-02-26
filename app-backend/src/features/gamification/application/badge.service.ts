import { injectable, inject } from "tsyringe"
import { BadgeRepository } from "../infrastructure/badge.repository"
import { UserBadgeRepository } from "../infrastructure/user-badge.repository"
import { UserLevelRepository } from "../infrastructure/user-level.repository"
import type { ILearningRecordProvider } from "@features/learning/domain/learning-record-provider.interface"
import type { IAssessmentStatsProvider } from "@features/assessment/domain/assessment-stats-provider.interface"
import { UserBadge } from "../domain/user-badge.entity"
import { Badge } from "../domain/badge.entity"
import { BadgeConditionEvaluator } from "../domain/badge-condition-evaluator"
import type { BadgeConditionCache } from "../domain/badge-condition.interface"
import { IRedisService } from "@shared/core/redis-service.interface"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { GamificationRedisKeys } from "../domain/gamification-redis-keys"

/**
 * Badge Service
 * 뱃지 조건 평가 및 해금
 */
@injectable()
export class BadgeService {
    constructor(
        @inject(BadgeRepository) private badgeRepository: BadgeRepository,
        @inject(UserBadgeRepository) private userBadgeRepository: UserBadgeRepository,
        @inject(UserLevelRepository) private userLevelRepository: UserLevelRepository,
        @inject(DI_TOKENS.ILearningRecordProvider) private learningRecordService: ILearningRecordProvider,
        @inject(DI_TOKENS.IAssessmentStatsProvider) private assessmentRepository: IAssessmentStatsProvider,
        @inject(DI_TOKENS.IRedisService) private redisService: IRedisService,
        @inject(DI_TOKENS.ILogger) private logger: ILogger,
        @inject(BadgeConditionEvaluator) private conditionEvaluator: BadgeConditionEvaluator
    ) { }

    /**
     * 사용자의 뱃지 해금 상태 평가 및 새 해금
     * 배치 조회로 N+1 쿼리 방지
     */
    async evaluateAndUnlock(userId: number): Promise<UserBadge[]> {
        const [badges, unlockedIds] = await Promise.all([
            this.badgeRepository.findAll(),
            this.userBadgeRepository.findUnlockedBadgeIdsByUser(userId),
        ])

        const candidates = badges.filter((b) => !unlockedIds.has(b.id))
        if (candidates.length === 0) return []

        // 조건 type별 데이터를 1회만 조회하여 재사용
        const conditionData = await this.prefetchConditionData(userId, candidates)

        const newlyUnlocked: Badge[] = []
        for (const badge of candidates) {
            if (this.conditionEvaluator.evaluate(badge.condition, conditionData)) {
                newlyUnlocked.push(badge)
            }
        }

        if (newlyUnlocked.length === 0) return []

        // 배치 저장
        const userBadges = newlyUnlocked.map((badge) =>
            UserBadge.create({ userId, badgeId: badge.id })
        )
        const saved = await this.userBadgeRepository.saveAll(userBadges)

        // badge 관계 연결 + 로깅
        const badgeMap = new Map(newlyUnlocked.map((b) => [b.id, b]))
        for (const ub of saved) {
            const badge = badgeMap.get(ub.badgeId)
            if (!badge) continue
            ub.badge = badge
            this.logger.info(`[BadgeService] User ${userId} 뱃지 해금: ${ub.badge.code}`)
        }

        try {
            await this.redisService.delete(GamificationRedisKeys.profile(userId))
        } catch (error) {
            this.logger.warn("뱃지 해금 후 프로필 캐시 무효화 실패", error)
        }

        return saved
    }

    /**
     * 후보 뱃지의 조건 type을 분석하여 필요한 데이터를 한 번에 조회
     */
    private async prefetchConditionData(
        userId: number,
        candidates: Badge[]
    ): Promise<BadgeConditionCache> {
        const types = new Set(candidates.map((b) => b.condition.type))
        const scoreValues = candidates
            .filter((b) => b.condition.type === "score")
            .map((b) => b.condition.value)

        const promises: Promise<void>[] = []
        const result: BadgeConditionCache = { scoreThresholds: new Map() }

        if (types.has("streak")) {
            promises.push(
                this.learningRecordService.getStreak(userId).then((s) => {
                    result.streak = s
                })
            )
        }

        if (types.has("count")) {
            promises.push(
                this.assessmentRepository.getStatsByUserId(userId).then((s) => {
                    result.stats = s
                })
            )
        }

        if (types.has("level")) {
            promises.push(
                this.userLevelRepository.findOrCreateByUserId(userId).then((l) => {
                    result.level = l
                })
            )
        }

        if (types.has("score")) {
            // 각 score threshold를 개별 조회 (existsBy 수준이므로 가벼움)
            for (const value of scoreValues) {
                promises.push(
                    this.assessmentRepository.hasScoreAbove(userId, value).then((met) => {
                        result.scoreThresholds.set(value, met)
                    })
                )
            }
        }

        await Promise.all(promises)
        return result
    }

    /**
     * 전체 뱃지 목록 조회
     */
    async getAllBadges(): Promise<Badge[]> {
        return this.badgeRepository.findAll()
    }

    /**
     * 사용자의 해금된 뱃지 목록
     */
    async getUnlockedBadges(userId: number): Promise<UserBadge[]> {
        return this.userBadgeRepository.findUnlockedByUserId(userId)
    }

    /**
     * 사용자가 확인하지 않은 뱃지 목록
     */
    async getUnseenBadges(userId: number): Promise<UserBadge[]> {
        return this.userBadgeRepository.findUnseenByUserId(userId)
    }

    /**
     * 뱃지 확인 처리
     */
    async markBadgesAsSeen(userId: number, badgeIds?: number[]): Promise<void> {
        if (badgeIds && badgeIds.length > 0) {
            await this.userBadgeRepository.markAsSeen(userId, badgeIds)
        } else {
            await this.userBadgeRepository.markAllAsSeen(userId)
        }
    }
}
