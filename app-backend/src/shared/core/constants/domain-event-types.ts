/**
 * 도메인 이벤트 타입 상수 — 하드코딩 문자열 대신 사용
 *
 * 새 이벤트 추가 시 반드시 여기에 등록해야 diconfig.ts 부트스트랩 검증이 적용된다.
 */
export const DOMAIN_EVENT_TYPES = {
    EmailVerifiedEvent: "EmailVerifiedEvent",
    AssessmentCompletedEvent: "AssessmentCompletedEvent",
    DailyGoalAchievedEvent: "DailyGoalAchievedEvent",
    GameSessionCompletedEvent: "GameSessionCompletedEvent",
    LevelUpEvent: "LevelUpEvent",
} as const

export type DomainEventType = typeof DOMAIN_EVENT_TYPES[keyof typeof DOMAIN_EVENT_TYPES]
