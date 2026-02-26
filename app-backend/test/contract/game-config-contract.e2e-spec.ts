import request from "supertest"
import { Express } from "express"
import {
    initializeTestApp,
    cleanupDatabase,
    truncateAllTables,
    clearMockRedis,
} from "../utils/e2e-helper"
import { assertSuccessResponse, assertErrorResponse } from "../utils/contract-assertions"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { GameConfig } from "@features/gamification/domain/game-config.entity"
import { User, UserRole } from "@features/user/domain/user.entity"

describe("GameConfig API Contract", () => {
    let app: Express
    let userToken: string
    let adminToken: string

    beforeAll(async () => {
        app = await initializeTestApp()
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    beforeEach(async () => {
        await truncateAllTables()
        clearMockRedis()
    })

    /**
     * 테스트용 사용자 생성 + 토큰 발급 헬퍼
     */
    async function createUserAndGetToken(role: UserRole = UserRole.USER): Promise<string> {
        const email = role === UserRole.ADMIN ? "admin@test.com" : "user@test.com"

        // 1. 회원가입
        await request(app)
            .post("/api/v1/auth/register")
            .send({ email, password: "Test1234!", firstName: "테스트", agreedToTerms: true })

        // 2. 이메일 인증 (모킹된 Redis에서 코드 추출)
        // 모킹 환경에서 인증 코드 직접 설정
        const userRepo = AppDataSource.getRepository(User)
        const user = await userRepo.findOneBy({ email })
        if (user) {
            user.isVerified = true
            if (role === UserRole.ADMIN) {
                user.role = UserRole.ADMIN
            }
            await userRepo.save(user)
        }

        // 3. 로그인
        const loginRes = await request(app)
            .post("/api/v1/auth/login")
            .send({ email, password: "Test1234!" })

        return loginRes.body.data?.accessToken ?? ""
    }

    /**
     * 테스트용 GameConfig 시드 데이터 삽입
     */
    async function seedGameConfig(): Promise<void> {
        const configRepo = AppDataSource.getRepository(GameConfig)
        await configRepo.save([
            configRepo.create({
                key: "hint.maxPerSentence",
                value: 2,
                description: "문장당 최대 힌트",
                category: "hint",
            }),
            configRepo.create({
                key: "hint.xpPenalty",
                value: 5,
                description: "힌트 XP 감소",
                category: "hint",
            }),
            configRepo.create({
                key: "xp.game.firstClear",
                value: 20,
                description: "최초 클리어 XP",
                category: "xp",
            }),
        ])
    }

    describe("GET /api/v1/game-configs/hint (클라이언트 힌트 설정)", () => {
        it("인증 없이 접근 시 401 에러를 반환한다", async () => {
            const res = await request(app).get("/api/v1/game-configs/hint")

            expect(res.status).toBe(401)
            assertErrorResponse(res.body)
        })

        it("인증 시 힌트 설정을 반환한다", async () => {
            // Given
            userToken = await createUserAndGetToken()
            await seedGameConfig()

            // GameConfigService 캐시 로드를 위해 직접 resolve
            const { container } = await import("tsyringe")
            const { GameConfigService } =
                await import("@features/gamification/application/game-config.service")
            const configService = container.resolve(GameConfigService)
            await configService.loadAll()

            // When
            const res = await request(app)
                .get("/api/v1/game-configs/hint")
                .set("Authorization", `Bearer ${userToken}`)

            // Then
            expect(res.status).toBe(200)
            assertSuccessResponse(res.body)
            expect(res.body.data).toHaveProperty(["hint.maxPerSentence"])
            expect(res.body.data).toHaveProperty(["hint.xpPenalty"])
            expect(res.headers["etag"]).toBeDefined()
        })

        it("ETag가 일치하면 304를 반환한다", async () => {
            // Given
            userToken = await createUserAndGetToken()
            await seedGameConfig()

            const { container } = await import("tsyringe")
            const { GameConfigService } =
                await import("@features/gamification/application/game-config.service")
            const configService = container.resolve(GameConfigService)
            await configService.loadAll()

            // 첫 요청에서 ETag 획득
            const firstRes = await request(app)
                .get("/api/v1/game-configs/hint")
                .set("Authorization", `Bearer ${userToken}`)
            const etag = firstRes.headers["etag"]

            // When
            const res = await request(app)
                .get("/api/v1/game-configs/hint")
                .set("Authorization", `Bearer ${userToken}`)
                .set("If-None-Match", etag)

            // Then
            expect(res.status).toBe(304)
        })
    })

    describe("GET /api/v1/admin/game-configs (어드민 전체 설정)", () => {
        it("인증 없이 접근 시 401 에러를 반환한다", async () => {
            const res = await request(app).get("/api/v1/admin/game-configs")

            expect(res.status).toBe(401)
            assertErrorResponse(res.body)
        })

        it("일반 사용자 접근 시 403 에러를 반환한다", async () => {
            // Given
            userToken = await createUserAndGetToken(UserRole.USER)

            // When
            const res = await request(app)
                .get("/api/v1/admin/game-configs")
                .set("Authorization", `Bearer ${userToken}`)

            // Then
            expect(res.status).toBe(403)
            assertErrorResponse(res.body)
        })

        it("어드민은 전체 설정을 조회할 수 있다", async () => {
            // Given
            adminToken = await createUserAndGetToken(UserRole.ADMIN)
            await seedGameConfig()

            // When
            const res = await request(app)
                .get("/api/v1/admin/game-configs")
                .set("Authorization", `Bearer ${adminToken}`)

            // Then
            expect(res.status).toBe(200)
            assertSuccessResponse(res.body)
            expect(Array.isArray(res.body.data)).toBe(true)
            expect(res.body.data.length).toBeGreaterThanOrEqual(3)
        })
    })

    describe("PUT /api/v1/admin/game-configs/:key (어드민 설정 업데이트)", () => {
        it("인증 없이 접근 시 401 에러를 반환한다", async () => {
            const res = await request(app)
                .put("/api/v1/admin/game-configs/xp.game.firstClear")
                .send({ value: 30 })

            expect(res.status).toBe(401)
            assertErrorResponse(res.body)
        })

        it("일반 사용자 접근 시 403 에러를 반환한다", async () => {
            // Given
            userToken = await createUserAndGetToken(UserRole.USER)

            // When
            const res = await request(app)
                .put("/api/v1/admin/game-configs/xp.game.firstClear")
                .set("Authorization", `Bearer ${userToken}`)
                .send({ value: 30 })

            // Then
            expect(res.status).toBe(403)
            assertErrorResponse(res.body)
        })

        it("어드민이 유효한 값으로 설정을 업데이트한다", async () => {
            // Given
            adminToken = await createUserAndGetToken(UserRole.ADMIN)
            await seedGameConfig()

            const { container } = await import("tsyringe")
            const { GameConfigService } =
                await import("@features/gamification/application/game-config.service")
            const configService = container.resolve(GameConfigService)
            await configService.loadAll()

            // When
            const res = await request(app)
                .put("/api/v1/admin/game-configs/xp.game.firstClear")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ value: 30 })

            // Then
            expect(res.status).toBe(200)
            assertSuccessResponse(res.body)
            expect(res.body.data.value).toBe(30)
        })

        it("유효성 검증 실패 시 400 에러를 반환한다", async () => {
            // Given
            adminToken = await createUserAndGetToken(UserRole.ADMIN)
            await seedGameConfig()

            const { container } = await import("tsyringe")
            const { GameConfigService } =
                await import("@features/gamification/application/game-config.service")
            const configService = container.resolve(GameConfigService)
            await configService.loadAll()

            // When — xp.game.firstClear에 문자열 전달
            const res = await request(app)
                .put("/api/v1/admin/game-configs/xp.game.firstClear")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ value: "invalid_string" })

            // Then
            expect(res.status).toBe(400)
            assertErrorResponse(res.body)
        })
    })
})
