import { injectable } from "tsyringe"
import type { BadgeConditionCache } from "./badge-condition.interface"

/**
 * BadgeConditionEvaluator (Domain Service)
 * 사전 조회된 캐시 데이터로 뱃지 조건을 동기 평가
 */
@injectable()
export class BadgeConditionEvaluator {
    /**
     * 뱃지 조건 평가
     * @param condition 뱃지의 조건 (type + value)
     * @param cache 사전 조회된 데이터
     * @returns 조건 충족 여부
     */
    evaluate(condition: { type: string; value: number }, cache: BadgeConditionCache): boolean {
        const { type, value } = condition

        switch (type) {
            case "streak":
                return (cache.streak?.longestStreak ?? 0) >= value
            case "score":
                return cache.scoreThresholds.get(value) ?? false
            case "count":
                return (cache.stats?.completedLessons ?? 0) >= value
            case "level":
                return (cache.level?.level ?? 0) >= value
            default:
                return false
        }
    }
}
