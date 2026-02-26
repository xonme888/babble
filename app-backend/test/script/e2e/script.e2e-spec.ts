import request from "supertest"
import { Express } from "express"
import { initializeTestApp, cleanupDatabase } from "../../utils/e2e-helper"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { User, UserRole } from "@features/user/domain/user.entity"
import { container } from "tsyringe"
import { JwtTokenProvider } from "@features/auth/infrastructure/crypto/jwt-token-provider"

describe("스크립트 관리 E2E (Atomic BDD)", () => {
    let app: Express
    let authToken: string
    let testUser: User

    beforeAll(async () => {
        app = await initializeTestApp()

        // 설정: 관리자 사용자
        const userRepository = AppDataSource.getRepository(User)
        testUser = new User()
        testUser.email = `e2e_script_${Date.now()}@example.com`
        testUser.password = "hashedpassword"
        testUser.firstName = "Admin"
        testUser.role = UserRole.ADMIN
        await userRepository.save(testUser)

        const tokenProvider = container.resolve<JwtTokenProvider>("ITokenProvider")
        authToken = await tokenProvider.generateAccessToken(testUser.id)
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    describe("AC1: 관리자 콘텐츠 생성", () => {
        it("관리자가 트레이닝 라이브러리에 새 스크립트를 생성할 수 있어야 한다", async () => {
            const response = await request(app)
                .post("/api/v1/scripts")
                .set("Authorization", `Bearer ${authToken}`)
                .send({
                    title: "E2E BDD Script",
                    content: "This is a test script content.",
                    category: "General",
                    difficulty: "EASY",
                })
                .expect(201)

            expect(response.body.data.title).toBe("E2E BDD Script")
        })

        it("인증되지 않은 사용자의 스크립트 생성을 거부해야 한다", async () => {
            await request(app)
                .post("/api/v1/scripts")
                .send({ title: "Anonymous Script" })
                .expect(401)
        })
    })

    describe("AC2: 콘텐츠 탐색", () => {
        it("사용자가 사용 가능한 스크립트 목록을 탐색할 수 있어야 한다", async () => {
            const response = await request(app)
                .get("/api/v1/scripts")
                .set("Authorization", `Bearer ${authToken}`)
                .expect(200)

            expect(response.body.data).toHaveProperty("items")
            expect(response.body.data).toHaveProperty("total")
            expect(Array.isArray(response.body.data.items)).toBe(true)
            expect(response.body.data.items.length).toBeGreaterThan(0)
        })

        it("사용자가 랜덤 트레이닝 스크립트 추천을 받을 수 있어야 한다", async () => {
            const response = await request(app)
                .get("/api/v1/scripts/random")
                .set("Authorization", `Bearer ${authToken}`)
                .expect(200)

            expect(response.body.data).toHaveProperty("id")
            expect(response.body.data).toHaveProperty("content")
        })
    })
})
