/**
 * Gamification 피처 Redis 키 빌더
 * 키 패턴을 단일 소스로 관리하여 오타/불일치 방지
 */
export const GamificationRedisKeys = {
    /** 게임화 프로필 캐시 */
    profile: (userId: number) => `gamification:profile:${userId}`,
    /** XP 리더보드 캐시 */
    leaderboard: (limit: number) => `gamification:leaderboard:${limit}`,
} as const

/** 캐시 TTL (초) */
export const GamificationCacheTTL = {
    PROFILE: 300,       // 5분
    LEADERBOARD: 60,    // 1분
} as const
