/**
 * 게스트 도메인 정책 — 순수 상수 + 순수 함수, 인프라 의존 없음
 *
 * 게스트 체험 관련 비즈니스 규칙의 Single Source of Truth.
 * Presentation/Infrastructure에서 이 파일을 참조한다.
 */

/** 게스트 사용자 폴백 ID — DB에 미존재하는 값으로 빈 결과 유도 */
export const GUEST_USER_ID = 0

/** 게스트 JWT 액세스 토큰 TTL */
export const GUEST_TOKEN_TTL = "1h"

/** 동의 미수집 게스트 자동 삭제 TTL (시간) */
export const GUEST_NO_CONSENT_TTL_HOURS = 24

/** 비활성 게스트 soft delete TTL (일) */
export const GUEST_INACTIVE_TTL_DAYS = 30

/** Cron 1회당 처리할 최대 게스트 수 */
export const GUEST_CLEANUP_BATCH_SIZE = 100

/** 게스트가 체험 가능한 기능 목록 */
export const GuestFeature = {
    PRACTICE: "PRACTICE",
    CONTINUOUS_READING: "CONTINUOUS_READING",
    WORD_GAME: "WORD_GAME",
    LEADERBOARD: "LEADERBOARD",
    HISTORY: "HISTORY",
    PROFILE: "PROFILE",
} as const

export type GuestFeatureType = (typeof GuestFeature)[keyof typeof GuestFeature]

/** 기능별 게스트 최대 체험 횟수 */
export const GUEST_MAX_TRIALS: Record<GuestFeatureType, number> = {
    PRACTICE: 1,
    CONTINUOUS_READING: 1,
    WORD_GAME: 0,
    LEADERBOARD: 0,
    HISTORY: 0,
    PROFILE: 0,
}

/** 게스트 토큰 발급 rate limit 정책값 */
export const GUEST_TOKEN_RATE_LIMIT = { maxAttempts: 10, windowSeconds: 600 }

/** 역할이 GUEST인지 판별하는 순수 함수 */
export function isGuestRole(role?: string): boolean {
    return role === "GUEST"
}
