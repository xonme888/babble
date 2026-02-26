/**
 * XP 기본 상수
 * 각 활동별 기본 XP 보상 정의 (GameConfig에서 오버라이드 가능)
 */
export const XP_DEFAULTS = {
    // Assessment 완료 시 기본 XP
    ASSESSMENT_COMPLETE: 50,
    // 높은 점수 보너스 (score >= ASSESSMENT_HIGH_SCORE_THRESHOLD)
    ASSESSMENT_HIGH_SCORE_BONUS: 25,
    // Assessment 고득점 기준
    ASSESSMENT_HIGH_SCORE_THRESHOLD: 90,
    // 게임 — 최초 클리어 XP (v1 호환: 30)
    GAME_COMPLETE: 30,
    // 게임 — 높은 정답률 보너스 (v1 호환: 15, accuracy >= GAME_HIGH_ACCURACY_THRESHOLD)
    GAME_HIGH_ACCURACY_BONUS: 15,
    // 게임 — 높은 정답률 기준
    GAME_HIGH_ACCURACY_THRESHOLD: 80,
    // 게임 — 최초 클리어 (v2)
    GAME_FIRST_CLEAR: 20,
    // 게임 — 반복 (v2)
    GAME_REPEAT: 5,
    // 게임 — 복습 보너스 (v2)
    GAME_REVIEW_BONUS: 15,
    // 게임 — 퍼펙트 보너스 (v2)
    GAME_PERFECT_BONUS: 10,
    // 게임 — 세션 XP 상한 (v2)
    GAME_SESSION_CAP: 60,
    // 일일 목표 달성 시 XP
    DAILY_GOAL_ACHIEVED: 20,
    // 스트릭 보너스 (7일 연속 시)
    STREAK_7_DAYS: 50,
    // 스트릭 보너스 (30일 연속 시)
    STREAK_30_DAYS: 200,
    // 데일리 챌린지 참여 XP
    CHALLENGE_PARTICIPATION: 20,
    // 데일리 챌린지 순위 보너스 XP (1위/2위/3위)
    CHALLENGE_RANK_1: 100,
    CHALLENGE_RANK_2: 60,
    CHALLENGE_RANK_3: 30,
} as const

/** Assessment 완료 XP 계산 (기본 + 고득점 보너스) */
export function calculateAssessmentXp(score: number): number {
    let amount = XP_DEFAULTS.ASSESSMENT_COMPLETE
    if (score >= XP_DEFAULTS.ASSESSMENT_HIGH_SCORE_THRESHOLD) {
        amount += XP_DEFAULTS.ASSESSMENT_HIGH_SCORE_BONUS
    }
    return amount
}

/** 게임 완료 XP 계산 (기본 + 높은 정답률 보너스) */
export function calculateGameSessionXp(accuracy: number): number {
    let amount = XP_DEFAULTS.GAME_COMPLETE
    if (accuracy >= XP_DEFAULTS.GAME_HIGH_ACCURACY_THRESHOLD) {
        amount += XP_DEFAULTS.GAME_HIGH_ACCURACY_BONUS
    }
    return amount
}
