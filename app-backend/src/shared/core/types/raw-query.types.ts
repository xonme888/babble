/**
 * Repository getRawMany() 결과용 인터페이스 정의
 *
 * TypeORM getRawMany()는 타입을 추론하지 못하므로,
 * 반환 구조를 명시적으로 정의하여 any 사용을 방지한다.
 *
 * 모든 필드는 string | number — getRawMany()가 DB 원시 값을 반환하기 때문
 */

/** Assessment 날짜 조회 결과 */
export interface AssessmentDateRow {
    createdAt: string | Date
}

/** 요일별 활동 통계 결과 */
export interface WeeklyActivityRow {
    dayOfWeek: string
    totalMinutes: string
}

/** 스크립트 진행도 결과 */
export interface ScriptProgressRow {
    scriptId: string
    bestScore: string
}

/** 학습 기록 활동 날짜 결과 */
export interface LearningRecordDateRow {
    activityDate: string | Date
}

/** 게임 취약 스크립트 결과 */
export interface WeakScriptRow {
    scriptId: string
    scriptContent: string
    totalAttempts: string
    correctRate: string
    lastPlayedAt: string | Date
}

/** Assessment 필터 인터페이스 (findAll 파라미터) */
export interface IAssessmentFilter {
    status?: string
    userId?: number
}

/** OpenAPI spec 최소 구조 (빌드 스크립트용) */
export interface OpenAPISpec {
    paths?: Record<string, unknown>
    components?: {
        schemas?: Record<string, OpenAPISchema>
    }
    [key: string]: unknown
}

/** OpenAPI 스키마 구조 */
export interface OpenAPISchema {
    properties?: Record<string, OpenAPIProperty>
    [key: string]: unknown
}

/** OpenAPI 프로퍼티 구조 */
export interface OpenAPIProperty {
    enum?: string[]
    type?: string
    [key: string]: unknown
}
