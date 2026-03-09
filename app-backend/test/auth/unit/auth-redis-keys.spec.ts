export {}

import { AuthRedisKeys, CLIENT_TYPES } from "@features/auth/domain/auth-redis-keys"

describe("AuthRedisKeys (Redis 키 빌더)", () => {
    describe("verification", () => {
        it("이메일로 인증 코드 키를 생성한다", () => {
            expect(AuthRedisKeys.verification("test@example.com")).toBe("verify:test@example.com")
        })
    })

    describe("passwordReset", () => {
        it("이메일로 비밀번호 재설정 키를 생성한다", () => {
            expect(AuthRedisKeys.passwordReset("test@example.com")).toBe("reset:test@example.com")
        })
    })

    describe("refreshToken", () => {
        it("userId와 clientType으로 refresh 토큰 키를 생성한다", () => {
            expect(AuthRedisKeys.refreshToken(42, "mobile")).toBe("refresh:42:mobile")
            expect(AuthRedisKeys.refreshToken(1, "admin")).toBe("refresh:1:admin")
        })
    })

    describe("refreshTokenPrev", () => {
        it("Grace period용 이전 토큰 키를 생성한다", () => {
            expect(AuthRedisKeys.refreshTokenPrev(42, "mobile")).toBe("refresh:42:mobile:prev")
        })
    })

    describe("blacklist", () => {
        it("access 토큰으로 블랙리스트 키를 생성한다", () => {
            const token = "eyJhbGciOiJIUzI1NiJ9.test"
            expect(AuthRedisKeys.blacklist(token)).toBe(`blacklist:${token}`)
        })
    })

    describe("CLIENT_TYPES", () => {
        it("mobile과 admin을 포함한다", () => {
            expect(CLIENT_TYPES).toEqual(["mobile", "admin", "therapy"])
        })

        it("읽기 전용 배열이다", () => {
            expect(Array.isArray(CLIENT_TYPES)).toBe(true)
        })
    })
})
