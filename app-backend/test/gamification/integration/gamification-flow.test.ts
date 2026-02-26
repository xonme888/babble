import "reflect-metadata"
import request from "supertest"
import { Express } from "express"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { initializeTestApp, cleanupDatabase, truncateAllTables, clearMockRedis } from "../../utils/e2e-helper"
import { Badge } from "@features/gamification/domain/badge.entity"
import { BADGE_SEEDS } from "@features/gamification/infrastructure/seed/badge-seed"
import { extractVerificationCode } from "../../utils/db-test-setup"

describe("게임화 통합 테스트", () => {
    let app: Express
    let accessToken: string

    let testUser: { email: string; password: string; firstName: string; lastName: string; agreedToTerms: boolean }

    beforeAll(async () => {
        app = await initializeTestApp()
    })

    beforeEach(async () => {
        await truncateAllTables()
        clearMockRedis()

        testUser = {
            email: `gamification_test_${Date.now()}_${Math.floor(Math.random() * 10000)}@example.com`,
            password: "TestPassword123!",
            firstName: "Gamification",
            lastName: "Tester",
            agreedToTerms: true,
        }

        // 뱃지 시드 삽입
        const badgeRepo = AppDataSource.getRepository(Badge)
        for (const seed of BADGE_SEEDS) {
            await badgeRepo.save(badgeRepo.create(seed))
        }

        // 회원가입 → 이메일 인증 → 로그인
        await request(app).post("/api/v1/auth/register").send(testUser).expect(201)
        const code = extractVerificationCode()
        await request(app)
            .post("/api/v1/auth/verify-email")
            .send({ email: testUser.email, code })
            .expect(200)
        const loginRes = await request(app)
            .post("/api/v1/auth/login")
            .send({ email: testUser.email, password: testUser.password })
            .expect(200)
        accessToken = loginRes.body.data.accessToken
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    describe("GET /api/v1/gamification/profile", () => {
        it("초기 게임화 프로필을 반환한다 (level:1, totalXp:0)", async () => {
            const res = await request(app)
                .get("/api/v1/gamification/profile")
                .set("Authorization", `Bearer ${accessToken}`)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)

            const profile = res.body.data
            expect(profile.level).toBe(1)
            expect(profile.totalXp).toBe(0)
            expect(profile).toHaveProperty("xpToNextLevel")
            expect(profile).toHaveProperty("levelProgress")
            expect(profile).toHaveProperty("weeklyXp")
            expect(profile).toHaveProperty("currentStreak")
            expect(profile).toHaveProperty("longestStreak")
            expect(profile).toHaveProperty("unlockedBadgeCount")
            expect(profile.unlockedBadgeCount).toBe(0)
        })

        it("인증 없이 접근 시 401을 반환한다", async () => {
            const res = await request(app).get("/api/v1/gamification/profile")
            expect(res.status).toBe(401)
        })
    })

    describe("GET /api/v1/gamification/badges", () => {
        it("전체 뱃지 목록을 반환한다 (모두 isUnlocked: false)", async () => {
            const res = await request(app)
                .get("/api/v1/gamification/badges")
                .set("Authorization", `Bearer ${accessToken}`)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(Array.isArray(res.body.data)).toBe(true)
            expect(res.body.data.length).toBe(BADGE_SEEDS.length)

            // 모든 뱃지가 해금 전 상태
            const allLocked = res.body.data.every((b: any) => b.isUnlocked === false)
            expect(allLocked).toBe(true)

            // 뱃지 필드 구조 검증
            const firstBadge = res.body.data[0]
            expect(firstBadge).toHaveProperty("id")
            expect(firstBadge).toHaveProperty("code")
            expect(firstBadge).toHaveProperty("title")
            expect(firstBadge).toHaveProperty("description")
            expect(firstBadge).toHaveProperty("iconName")
            expect(firstBadge).toHaveProperty("category")
            expect(firstBadge).toHaveProperty("isUnlocked")
            expect(firstBadge).toHaveProperty("unlockedAt")
        })

        it("인증 없이 접근 시 401을 반환한다", async () => {
            const res = await request(app).get("/api/v1/gamification/badges")
            expect(res.status).toBe(401)
        })
    })

    describe("GET /api/v1/gamification/leaderboard", () => {
        it("리더보드를 반환한다", async () => {
            const res = await request(app)
                .get("/api/v1/gamification/leaderboard")
                .set("Authorization", `Bearer ${accessToken}`)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(Array.isArray(res.body.data)).toBe(true)
        })

        it("인증 없이 접근 시 401을 반환한다", async () => {
            const res = await request(app).get("/api/v1/gamification/leaderboard")
            expect(res.status).toBe(401)
        })
    })
})
