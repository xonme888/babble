import request from "supertest"
import { Express } from "express"
import { initializeTestApp, cleanupDatabase } from "../../utils/e2e-helper"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { User } from "@features/user/domain/user.entity"
import { Script, ScriptDifficulty } from "@features/script/domain/script.entity"
import { container } from "tsyringe"
import { JwtTokenProvider } from "@features/auth/infrastructure/crypto/jwt-token-provider"
import { mockSendNotification } from "../../utils/db-test-setup"

describe("진단 E2E (Atomic BDD)", () => {
    let app: Express
    let authToken: string
    let testUser: User
    let testScript: Script

    beforeAll(async () => {
        app = await initializeTestApp()

        // 설정: 인증된 사용자 및 테스트 스크립트
        const userRepository = AppDataSource.getRepository(User)
        testUser = new User()
        testUser.email = `e2e_assessment_${Date.now()}@example.com`
        testUser.password = "Password123!"
        testUser.firstName = "E2E"
        testUser.isVerified = true
        await userRepository.save(testUser)

        const scriptRepository = AppDataSource.getRepository(Script)
        testScript = new Script()
        testScript.title = "E2E Practice Script"
        testScript.content = "E2E test content."
        testScript.category = "Practice"
        testScript.difficulty = ScriptDifficulty.EASY
        await scriptRepository.save(testScript)

        const tokenProvider = container.resolve<JwtTokenProvider>("ITokenProvider")
        authToken = tokenProvider.generateAccessToken(testUser.id)
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    beforeEach(() => {
        mockSendNotification.mockClear()
    })

    describe("AC1: 음성 평가 제출", () => {
        it("로그인한 사용자가 오디오를 업로드하고 대기 중인 평가를 받을 수 있어야 한다", async () => {
            const audioBuffer = Buffer.from("mock audio content")

            const response = await request(app)
                .post("/api/v1/assessments")
                .set("Authorization", `Bearer ${authToken}`)
                .attach("audio", audioBuffer, "test.wav")
                .field("scriptId", testScript.id.toString())
                .expect(201)

            expect(response.body.success).toBe(true)
            expect(response.body.data.status).toBe("PENDING")
        })

        it("오디오 파일이 없는 경우 제출을 거부해야 한다", async () => {
            await request(app)
                .post("/api/v1/assessments")
                .set("Authorization", `Bearer ${authToken}`)
                .send({ scriptId: testScript.id })
                .expect(400)
        })
    })

    describe("AC2: 진단 이력 추적", () => {
        it("사용자가 자신의 평가 이력을 조회할 수 있어야 한다", async () => {
            // AC1에서 생성된 assessment가 있어야 함
            const response = await request(app)
                .get("/api/v1/assessments")
                .set("Authorization", `Bearer ${authToken}`)
                .expect(200)

            // 페이지네이션 응답: { items, total, limit, offset }
            expect(Array.isArray(response.body.data.items)).toBe(true)
        })
    })
})
