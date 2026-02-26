/**
 * Assessment 피처 Redis 키 빌더
 * 키 패턴을 단일 소스로 관리하여 오타/불일치 방지
 */
export const AssessmentRedisKeys = {
    /** 사용자 통계 캐시 (getStatsByUserId) */
    userStats: (userId: number) => `assessment:stats:${userId}`,
    /** 주간 활동 캐시 (getWeeklyActivity) */
    weeklyActivity: (userId: number, weekStart: string) =>
        `assessment:weekly:${userId}:${weekStart}`,
} as const

/** 캐시 TTL (초) */
export const AssessmentCacheTTL = {
    /** 사용자 통계 — 5분 (Assessment 완료 이벤트로 무효화) */
    USER_STATS: 300,
    /** 주간 활동 — 5분 (Assessment 완료 이벤트로 무효화) */
    WEEKLY_ACTIVITY: 300,
} as const
