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
export const ScriptCategory = {
    PRACTICE: "practice",
    BIBLE: "bible",
} as const

export type ScriptCategoryType = (typeof ScriptCategory)[keyof typeof ScriptCategory]

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
    THERAPIST: "THERAPIST",
    FAMILY: "FAMILY",
} as const

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole]

export const ActivityType = {
    ASSESSMENT: "ASSESSMENT",
    GAME: "GAME",
    BREATHING: "BREATHING",
    PHONEME_DRILL: "PHONEME_DRILL",
    SCENARIO: "SCENARIO",
    VOICE_DIARY: "VOICE_DIARY",
} as const

export type ActivityTypeType = (typeof ActivityType)[keyof typeof ActivityType]

export const GameType = {
    WORD_MATCH: "WORD_MATCH",
    PRONUNCIATION_QUIZ: "PRONUNCIATION_QUIZ",
    SPEED_READ: "SPEED_READ",
} as const

export type GameTypeType = (typeof GameType)[keyof typeof GameType]

export const GameDifficulty = {
    EASY: "EASY",
    MEDIUM: "MEDIUM",
    HARD: "HARD",
} as const

export type GameDifficultyType = (typeof GameDifficulty)[keyof typeof GameDifficulty]

export const XpSource = {
    ASSESSMENT: "ASSESSMENT",
    GAME: "GAME",
    DAILY_GOAL: "DAILY_GOAL",
    STREAK_BONUS: "STREAK_BONUS",
    PHONEME_DRILL: "PHONEME_DRILL",
    SRS_REVIEW: "SRS_REVIEW",
    SCENARIO: "SCENARIO",
    CHALLENGE: "CHALLENGE",
    VOICE_DIARY: "VOICE_DIARY",
} as const

export type XpSourceType = (typeof XpSource)[keyof typeof XpSource]

export const BadgeCategory = {
    STREAK: "STREAK",
    SCORE: "SCORE",
    COUNT: "COUNT",
    LEVEL: "LEVEL",
    SPECIAL: "SPECIAL",
} as const

export type BadgeCategoryType = (typeof BadgeCategory)[keyof typeof BadgeCategory]

export const GuestFeature = {
    PRACTICE: "PRACTICE",
    CONTINUOUS_READING: "CONTINUOUS_READING",
    WORD_GAME: "WORD_GAME",
    LEADERBOARD: "LEADERBOARD",
    HISTORY: "HISTORY",
    PROFILE: "PROFILE",
} as const

export type GuestFeatureType = (typeof GuestFeature)[keyof typeof GuestFeature]

export const PhonemePosition = {
    INITIAL: "INITIAL",
    MEDIAL: "MEDIAL",
    FINAL: "FINAL",
} as const

export type PhonemePositionType = (typeof PhonemePosition)[keyof typeof PhonemePosition]

export const ErrorCategory = {
    TENSIFICATION: "TENSIFICATION",
    ASPIRATION: "ASPIRATION",
    NASALIZATION: "NASALIZATION",
    LATERALIZATION: "LATERALIZATION",
    FINAL_CONSONANT: "FINAL_CONSONANT",
    VOWEL: "VOWEL",
} as const

export type ErrorCategoryType = (typeof ErrorCategory)[keyof typeof ErrorCategory]

export const DevicePlatform = {
    IOS: "IOS",
    ANDROID: "ANDROID",
} as const

export type DevicePlatformType = (typeof DevicePlatform)[keyof typeof DevicePlatform]

export const SRSItemType = {
    SCRIPT: "SCRIPT",
    PHONEME: "PHONEME",
    MINIMAL_PAIR: "MINIMAL_PAIR",
    SCENARIO: "SCENARIO",
} as const

export type SRSItemTypeType = (typeof SRSItemType)[keyof typeof SRSItemType]

export const SRSItemStatus = {
    ACTIVE: "ACTIVE",
    SUSPENDED: "SUSPENDED",
    GRADUATED: "GRADUATED",
} as const

export type SRSItemStatusType = (typeof SRSItemStatus)[keyof typeof SRSItemStatus]

export const ScenarioCategory = {
    DAILY: "DAILY",
    MEDICAL: "MEDICAL",
    SHOPPING: "SHOPPING",
    SCHOOL: "SCHOOL",
    WORK: "WORK",
    PHONE: "PHONE",
    TRAVEL: "TRAVEL",
    RESTAURANT: "RESTAURANT",
} as const

export type ScenarioCategoryType = (typeof ScenarioCategory)[keyof typeof ScenarioCategory]

export const ScenarioSessionStatus = {
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETED: "COMPLETED",
    ABANDONED: "ABANDONED",
} as const

export type ScenarioSessionStatusType =
    (typeof ScenarioSessionStatus)[keyof typeof ScenarioSessionStatus]

export const ChallengeStatus = {
    ACTIVE: "ACTIVE",
    COMPLETED: "COMPLETED",
} as const

export type ChallengeStatusType = (typeof ChallengeStatus)[keyof typeof ChallengeStatus]

export const NotificationStatus = {
    PENDING: "PENDING",
    SENT: "SENT",
    FAILED: "FAILED",
} as const

export type NotificationStatusType = (typeof NotificationStatus)[keyof typeof NotificationStatus]

export const AnalysisLogStatus = {
    SUCCESS: "SUCCESS",
    FAIL: "FAIL",
} as const

export type AnalysisLogStatusType = (typeof AnalysisLogStatus)[keyof typeof AnalysisLogStatus]

export const AssessmentOrigin = {
    MOBILE: "MOBILE",
    THERAPY: "THERAPY",
    GUEST: "GUEST",
} as const

export type AssessmentOriginType = (typeof AssessmentOrigin)[keyof typeof AssessmentOrigin]

export const AssessmentType = {
    SCRIPT_READING: "SCRIPT_READING",
    MINIMAL_PAIR: "MINIMAL_PAIR",
    SCENARIO_LINE: "SCENARIO_LINE",
    WORD_PRACTICE: "WORD_PRACTICE",
    FREE_SPEECH: "FREE_SPEECH",
} as const

export type AssessmentTypeType = (typeof AssessmentType)[keyof typeof AssessmentType]

export const ASSESSMENT_TYPE_VALUES = Object.values(AssessmentType) as AssessmentTypeType[]

export const TherapyPhase = {
    PHASE_0: "PHASE_0",
    PHASE_1: "PHASE_1",
    PHASE_2: "PHASE_2",
    PHASE_3: "PHASE_3",
    PHASE_4: "PHASE_4",
} as const

export type TherapyPhaseType = (typeof TherapyPhase)[keyof typeof TherapyPhase]

export const BreathingExerciseType = {
    MPT: "MPT",
    S_DURATION: "S_DURATION",
    Z_DURATION: "Z_DURATION",
} as const

export type BreathingExerciseTypeType =
    (typeof BreathingExerciseType)[keyof typeof BreathingExerciseType]

export const OralMotorExerciseType = {
    LIP_ROUND: "LIP_ROUND",
    LIP_SPREAD: "LIP_SPREAD",
    TONGUE_UP: "TONGUE_UP",
    TONGUE_SIDE: "TONGUE_SIDE",
    JAW_OPEN: "JAW_OPEN",
    TONGUE_PROTRUDE: "TONGUE_PROTRUDE",
} as const

export type OralMotorExerciseTypeType =
    (typeof OralMotorExerciseType)[keyof typeof OralMotorExerciseType]

export const CueingLevel = {
    INDEPENDENT: 0,
    VISUAL_ONLY: 1,
    VISUAL_AUDITORY: 2,
    MAXIMUM: 3,
} as const

export type CueingLevelType = (typeof CueingLevel)[keyof typeof CueingLevel]

export const ProgressionOperator = {
    GTE: ">=",
    LTE: "<=",
    EQ: "==",
    GT: ">",
} as const

export type ProgressionOperatorType = (typeof ProgressionOperator)[keyof typeof ProgressionOperator]

export const DifficultyLevel = {
    EASY: "EASY",
    MEDIUM: "MEDIUM",
    HARD: "HARD",
} as const

export type DifficultyLevelType = (typeof DifficultyLevel)[keyof typeof DifficultyLevel]

export const DiaryMood = {
    GREAT: "GREAT",
    GOOD: "GOOD",
    OKAY: "OKAY",
    BAD: "BAD",
    TERRIBLE: "TERRIBLE",
} as const

export type DiaryMoodType = (typeof DiaryMood)[keyof typeof DiaryMood]

export const DiaryAnalysisStatus = {
    NONE: "NONE",
    PENDING: "PENDING",
    ANALYZING: "ANALYZING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
} as const

export type DiaryAnalysisStatusType = (typeof DiaryAnalysisStatus)[keyof typeof DiaryAnalysisStatus]
