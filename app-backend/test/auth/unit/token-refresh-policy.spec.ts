import "reflect-metadata"
import { TokenRefreshPolicy } from "@features/auth/domain/token-refresh-policy"

export {}

describe("TokenRefreshPolicy (토큰 갱신 정책)", () => {
    let policy: TokenRefreshPolicy

    beforeEach(() => {
        policy = new TokenRefreshPolicy()
    })

    describe("determineTokenStatus (토큰 상태 판정)", () => {
        it("현재 토큰과 일치하면 'current'를 반환한다", () => {
            const result = policy.determineTokenStatus("stored-token", null, "stored-token")
            expect(result).toBe("current")
        })

        it("이전 토큰과 일치하면 'previous'를 반환한다", () => {
            const result = policy.determineTokenStatus("stored-token", "prev-token", "prev-token")
            expect(result).toBe("previous")
        })

        it("둘 다 불일치하면 'revoked'를 반환한다", () => {
            const result = policy.determineTokenStatus("stored-token", "prev-token", "unknown-token")
            expect(result).toBe("revoked")
        })

        it("stored가 null이고 previous와 일치하면 'previous'를 반환한다", () => {
            const result = policy.determineTokenStatus(null, "prev-token", "prev-token")
            expect(result).toBe("previous")
        })

        it("stored와 previous 모두 null이면 'revoked'를 반환한다", () => {
            const result = policy.determineTokenStatus(null, null, "any-token")
            expect(result).toBe("revoked")
        })
    })

    describe("GRACE_PERIOD_SECONDS (Grace Period 상수)", () => {
        it("10초여야 한다", () => {
            expect(TokenRefreshPolicy.GRACE_PERIOD_SECONDS).toBe(10)
        })
    })
})
