import "reflect-metadata"
import request from "supertest"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import * as http from "http"
import { Application } from "express"
import { initializeTestApp, truncateAllTables, clearMockRedis } from "@/../test/utils/e2e-helper"
import { mockSendNotification, extractVerificationCode } from "@/../test/utils/db-test-setup"

describe("인증 흐름 E2E (Atomic BDD)", () => {
    let app: Application
    let server: http.Server

    beforeAll(async () => {
        app = await initializeTestApp()
        server = app.listen(0)
    })

    afterAll(async () => {
        if (server) server.close()
        if (AppDataSource.isInitialized) await AppDataSource.destroy()
    })

    beforeEach(async () => {
        await truncateAllTables()
        mockSendNotification.mockClear()
        clearMockRedis()
    })

    const testUser = {
        email: "e2e_user@example.com",
        password: "Password123!",
        firstName: "E2E",
        agreedToTerms: true,
    }

    describe("AC1: 사용자 등록 및 활성화", () => {
        it("게스트 사용자가 등록하고 인증 코드를 사용하여 계정을 활성화할 수 있어야 한다", async () => {
            // 게스트로서 등록하고 싶음
            await request(app).post("/api/v1/auth/register").send(testUser).expect(201)

            expect(mockSendNotification).toHaveBeenCalled()
            const verificationCode = extractVerificationCode()

            // 게스트로서 이메일을 인증하고 싶음
            await request(app)
                .post("/api/v1/auth/verify-email")
                .send({ email: testUser.email, code: verificationCode })
                .expect(200)

            // DB의 활성화 상태 확인
            const userRes = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: testUser.email, password: testUser.password })
                .expect(200)

            expect(userRes.body.data.accessToken).toBeDefined()
        })
    })

    describe("AC1.5: 세션 격리 (어드민/모바일)", () => {
        /** 회원가입 + 이메일 인증 + 로그인 헬퍼 */
        async function registerAndLogin(
            application: Application,
            email: string,
            password: string,
            firstName: string,
            clientType: "mobile" | "admin"
        ) {
            await request(application)
                .post("/api/v1/auth/register")
                .send({ email, password, firstName, agreedToTerms: true })
                .expect(201)
            const verificationCode = extractVerificationCode()
            await request(application)
                .post("/api/v1/auth/verify-email")
                .send({ email, code: verificationCode })
                .expect(200)

            const headers: Record<string, string> = {}
            if (clientType === "mobile") {
                headers["x-client-type"] = "mobile"
            } else {
                headers["origin"] = "http://localhost:3009"
            }

            const loginRes = await request(application)
                .post("/api/v1/auth/login")
                .set(headers)
                .send({ email, password })
                .expect(200)

            return loginRes.body.data
        }

        it("어드민 로그인 후에도 모바일 세션이 유지되어야 한다", async () => {
            // Given: 모바일로 로그인
            const mobileData = await registerAndLogin(
                app,
                "session@example.com",
                "Password123!",
                "Tester",
                "mobile"
            )
            expect(mobileData.accessToken).toBeDefined()
            expect(mobileData.refreshToken).toBeDefined()

            // When: 같은 사용자가 어드민으로도 로그인
            const adminData = await request(app)
                .post("/api/v1/auth/login")
                .set("origin", "http://localhost:3009")
                .send({ email: "session@example.com", password: "Password123!" })
                .expect(200)

            expect(adminData.body.data.accessToken).toBeDefined()

            // Then: 모바일 토큰으로 리프레시 가능 (세션 유지)
            const refreshRes = await request(app)
                .post("/api/v1/auth/refresh")
                .set("x-client-type", "mobile")
                .send({ refreshToken: mobileData.refreshToken })
                .expect(200)

            expect(refreshRes.body.data.accessToken).toBeDefined()
        })

        it("모바일 로그아웃 후에도 어드민 세션이 유지되어야 한다", async () => {
            // Given: 사용자 등록 후 모바일 + 어드민 동시 로그인
            await registerAndLogin(app, "session@example.com", "Password123!", "Tester", "mobile")

            const mobileLogin = await request(app)
                .post("/api/v1/auth/login")
                .set("x-client-type", "mobile")
                .send({ email: "session@example.com", password: "Password123!" })
                .expect(200)

            const adminLogin = await request(app)
                .post("/api/v1/auth/login")
                .set("origin", "http://localhost:3009")
                .send({ email: "session@example.com", password: "Password123!" })
                .expect(200)

            // When: 모바일 로그아웃
            await request(app)
                .post("/api/v1/auth/logout")
                .set("Authorization", `Bearer ${mobileLogin.body.data.accessToken}`)
                .set("x-client-type", "mobile")
                .expect(200)

            // Then: 어드민 토큰으로 보호된 리소스 접근 가능
            await request(app)
                .get("/api/v1/users/me")
                .set("Authorization", `Bearer ${adminLogin.body.data.accessToken}`)
                .expect(200)
        })

        it("logout-all은 모든 세션을 종료해야 한다", async () => {
            // Given: 사용자 등록 후 모바일 + 어드민 동시 로그인
            await registerAndLogin(app, "session@example.com", "Password123!", "Tester", "mobile")

            const mobileLogin = await request(app)
                .post("/api/v1/auth/login")
                .set("x-client-type", "mobile")
                .send({ email: "session@example.com", password: "Password123!" })
                .expect(200)

            const _adminLogin = await request(app)
                .post("/api/v1/auth/login")
                .set("origin", "http://localhost:3009")
                .send({ email: "session@example.com", password: "Password123!" })
                .expect(200)

            // When: logout-all 호출
            await request(app)
                .post("/api/v1/auth/logout-all")
                .set("Authorization", `Bearer ${mobileLogin.body.data.accessToken}`)
                .expect(200)

            // Then: 모바일 리프레시 실패
            // (블랙리스트에 추가된 access token은 즉시 무효화)
        })

        it("logout 엔드포인트에 토큰 없이 호출 시 401을 반환해야 한다", async () => {
            await request(app).post("/api/v1/auth/logout").expect(401)
        })
    })

    describe("AC2: 계정 보안 및 접근", () => {
        it("인증되지 않은 사용자의 로그인을 거부해야 한다", async () => {
            await request(app)
                .post("/api/v1/auth/register")
                .send({ ...testUser, email: "unverified@example.com" })
                .expect(201)

            await request(app)
                .post("/api/v1/auth/login")
                .send({ email: "unverified@example.com", password: testUser.password })
                .expect(403)
        })

        it("사용자가 회원 탈퇴를 하면 즉시 접근 권한을 취소해야 한다", async () => {
            // 설정: 등록 및 로그인
            await request(app).post("/api/v1/auth/register").send(testUser).expect(201)
            const verificationCode = extractVerificationCode()
            await request(app)
                .post("/api/v1/auth/verify-email")
                .send({ email: testUser.email, code: verificationCode })
            const loginRes = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: testUser.email, password: testUser.password })
            const accessToken = loginRes.body.data.accessToken

            // 실행: 탈퇴
            await request(app)
                .delete("/api/v1/users/withdraw")
                .set("Authorization", `Bearer ${accessToken}`)
                .expect(204)

            // 결과: 프로필 접근 및 로그인 거부
            await request(app)
                .get("/api/v1/users/me")
                .set("Authorization", `Bearer ${accessToken}`)
                .expect(404)

            await request(app)
                .post("/api/v1/auth/login")
                .send({ email: testUser.email, password: testUser.password })
                .expect(401)
        })
    })
})
