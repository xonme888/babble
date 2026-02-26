/**
 * 레벨 시스템 규칙
 * 레벨별 필요 XP — 점진적 증가
 */

/**
 * 특정 레벨에 도달하기 위해 필요한 누적 XP
 * 공식: level * 100 * (1 + (level - 1) * 0.2)
 */
export function xpRequiredForLevel(level: number): number {
    if (level <= 1) return 0
    return Math.floor(level * 100 * (1 + (level - 1) * 0.2))
}

/**
 * 현재 XP로 달성 가능한 레벨
 */
export function levelForXp(totalXp: number): number {
    let level = 1
    while (xpRequiredForLevel(level + 1) <= totalXp) {
        level++
    }
    return level
}

/**
 * 최대 레벨
 */
export const MAX_LEVEL = 50
