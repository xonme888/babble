import { expect } from "@jest/globals"

/**
 * API 응답 계약 검증 유틸리티
 * Backend의 표준 응답 구조(ApiSuccessResponse, ApiErrorResponse)와 일치 여부를 검증한다.
 *
 * @see src/shared/core/constants/api-contract.ts
 */

/**
 * 표준 성공 응답 구조를 검증한다.
 * { success: true, data: T, message?: string }
 */
export function assertSuccessResponse(body: unknown) {
    expect(body).toHaveProperty("success", true)
    expect(body).toHaveProperty("data")
}

/**
 * 표준 에러 응답 구조를 검증한다.
 * { success: false, message: string, errorCode: string, errorKey?: string, metadata?: Record }
 */
export function assertErrorResponse(body: unknown, expectedErrorCode?: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = body as any
    expect(body).toHaveProperty("success", false)
    expect(body).toHaveProperty("message")
    expect(body).toHaveProperty("errorCode")
    if (expectedErrorCode) {
        expect(b.errorCode).toBe(expectedErrorCode)
    }
}

/**
 * 페이지네이션 응답 구조를 검증한다.
 * { items: T[], total: number, limit: number, offset: number }
 */
export function assertPaginatedData(data: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any
    expect(data).toHaveProperty("items")
    expect(data).toHaveProperty("total")
    expect(data).toHaveProperty("limit")
    expect(data).toHaveProperty("offset")
    expect(Array.isArray(d.items)).toBe(true)
    expect(typeof d.total).toBe("number")
}

/**
 * 사용자 응답 필드 구조를 검증한다.
 * password/passwordHash는 절대 노출되면 안 된다.
 */
export function assertUserShape(user: unknown) {
    expect(user).toHaveProperty("id")
    expect(user).toHaveProperty("email")
    expect(user).toHaveProperty("firstName")
    expect(user).toHaveProperty("role")
    // password는 절대 노출되면 안 됨
    expect(user).not.toHaveProperty("password")
    expect(user).not.toHaveProperty("passwordHash")
}

/**
 * 구절 응답 필드 구조를 검증한다.
 * difficulty는 EASY | MEDIUM | HARD 중 하나여야 한다.
 */
export function assertScriptShape(script: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = script as any
    expect(script).toHaveProperty("id")
    expect(script).toHaveProperty("title")
    expect(script).toHaveProperty("content")
    expect(["EASY", "MEDIUM", "HARD"]).toContain(s.difficulty)
}

/**
 * 진단 응답 필드 구조를 검증한다.
 * status는 AssessmentStatus enum 값 중 하나여야 한다.
 */
export function assertAssessmentShape(assessment: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = assessment as any
    expect(assessment).toHaveProperty("id")
    expect(assessment).toHaveProperty("audioUrl")
    expect(assessment).toHaveProperty("status")
    expect(["PENDING", "ANALYZING", "COMPLETED", "FAILED", "MAX_RETRY_EXCEEDED"]).toContain(
        a.status
    )
}

/**
 * 게임 세션 응답 필드 구조를 검증한다.
 */
export function assertGameSessionShape(session: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ss = session as any
    expect(session).toHaveProperty("id")
    expect(session).toHaveProperty("gameType")
    expect(session).toHaveProperty("difficulty")
    expect(session).toHaveProperty("score")
    expect(["WORD_MATCH", "PRONUNCIATION_QUIZ", "SPEED_READ"]).toContain(ss.gameType)
    expect(["EASY", "MEDIUM", "HARD"]).toContain(ss.difficulty)
    expect(typeof ss.score).toBe("number")
}

/**
 * 게임화 프로필 응답 필드 구조를 검증한다.
 */
export function assertGamificationProfileShape(profile: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = profile as any
    expect(profile).toHaveProperty("level")
    expect(profile).toHaveProperty("totalXp")
    expect(profile).toHaveProperty("xpToNextLevel")
    expect(profile).toHaveProperty("levelProgress")
    expect(profile).toHaveProperty("weeklyXp")
    expect(profile).toHaveProperty("currentStreak")
    expect(profile).toHaveProperty("longestStreak")
    expect(profile).toHaveProperty("unlockedBadgeCount")
    expect(typeof p.level).toBe("number")
    expect(typeof p.totalXp).toBe("number")
}
