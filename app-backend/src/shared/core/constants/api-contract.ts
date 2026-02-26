/**
 * API 계약 정의 — 모든 서비스가 참조할 표준 구조
 */

// === 에러 응답 구조 ===
export interface ApiErrorResponse {
    success: false
    message: string
    errorCode: string
    errorKey?: string
    metadata?: Record<string, unknown>
}

// === 성공 응답 구조 ===
export interface ApiSuccessResponse<T> {
    success: true
    data: T
    message?: string
}

// === 페이지네이션 응답 구조 ===
export interface PaginatedResponse<T> {
    items: T[]
    total: number
    limit: number
    offset: number
}

// === 공유 Enum 정의 ===
export const AssessmentStatus = {
    PENDING: "PENDING",
    ANALYZING: "ANALYZING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    MAX_RETRY_EXCEEDED: "MAX_RETRY_EXCEEDED",
} as const

export type AssessmentStatusType = (typeof AssessmentStatus)[keyof typeof AssessmentStatus]

export const ScriptDifficulty = {
    EASY: "EASY",
    MEDIUM: "MEDIUM",
    HARD: "HARD",
} as const

export type ScriptDifficultyType = (typeof ScriptDifficulty)[keyof typeof ScriptDifficulty]

export const UserRole = {
    GUEST: "GUEST",
    USER: "USER",
    ADMIN: "ADMIN",
} as const

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole]

export const ActivityType = {
    ASSESSMENT: "ASSESSMENT",
    GAME: "GAME",
} as const

export type ActivityTypeValue = (typeof ActivityType)[keyof typeof ActivityType]

export const GameType = {
    WORD_MATCH: "WORD_MATCH",
    PRONUNCIATION_QUIZ: "PRONUNCIATION_QUIZ",
    SPEED_READ: "SPEED_READ",
} as const

export type GameTypeValue = (typeof GameType)[keyof typeof GameType]

export const GameDifficulty = {
    EASY: "EASY",
    MEDIUM: "MEDIUM",
    HARD: "HARD",
} as const

export type GameDifficultyValue = (typeof GameDifficulty)[keyof typeof GameDifficulty]

export const XpSource = {
    ASSESSMENT: "ASSESSMENT",
    GAME: "GAME",
    DAILY_GOAL: "DAILY_GOAL",
    STREAK_BONUS: "STREAK_BONUS",
} as const

export type XpSourceValue = (typeof XpSource)[keyof typeof XpSource]

export const BadgeCategory = {
    STREAK: "STREAK",
    SCORE: "SCORE",
    COUNT: "COUNT",
    LEVEL: "LEVEL",
    SPECIAL: "SPECIAL",
} as const

export type BadgeCategoryValue = (typeof BadgeCategory)[keyof typeof BadgeCategory]

export const GuestFeature = {
    PRACTICE: "PRACTICE",
    CONTINUOUS_READING: "CONTINUOUS_READING",
    WORD_GAME: "WORD_GAME",
    LEADERBOARD: "LEADERBOARD",
    HISTORY: "HISTORY",
    PROFILE: "PROFILE",
} as const

export type GuestFeatureType = (typeof GuestFeature)[keyof typeof GuestFeature]
