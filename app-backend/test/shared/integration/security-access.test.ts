import "reflect-metadata"
import request from "supertest"
import { Express } from "express"
import { container } from "tsyringe"
import { initializeTestApp, cleanupDatabase } from "../../utils/e2e-helper"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { User } from "@features/user/domain/user.entity"
import { Assessment } from "@features/assessment/domain/assessment.entity"
import { JwtTokenProvider } from "@features/auth/infrastructure/crypto/jwt-token-provider"

describe("보안 및 액세스 제어 (통합 테스트)", () => {
    let app: Express
    let userA: User
    let userB: User
    let tokenA: string
    let tokenB: string

    beforeEach(async () => {
        app = await initializeTestApp()
        const userRepository = AppDataSource.getRepository(User)
        const tokenProvider = container.resolve<JwtTokenProvider>("ITokenProvider")

        // 사용자 A 설정
        userA = new User()
        userA.email = `usera_${Date.now()}@example.com`
        userA.password = "Password123!"
        userA.firstName = "UserA"
        userA.isVerified = true
        await userRepository.save(userA)
        tokenA = tokenProvider.generateAccessToken(userA.id)

        // 사용자 B 설정
        userB = new User()
        userB.email = `userb_${Date.now()}@example.com`
        userB.password = "Password123!"
        userB.firstName = "UserB"
        userB.isVerified = true
        await userRepository.save(userB)
        tokenB = tokenProvider.generateAccessToken(userB.id)

        // 스크립트 설정
        const { Script } = await import("@features/script/domain/script.entity")
        const scriptRepo = AppDataSource.getRepository(Script)
        const script = new Script()
        script.title = "Test Script"
        script.content = "Test Content"
        script.category = "Test"
        script.difficulty = "EASY" as unknown
        await scriptRepo.save(script)
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    describe("교차 리소스 접근 방지", () => {
        it("사용자 A가 사용자 B의 평가 데이터에 접근하는 것을 방지해야 한다", async () => {
            // Given: 사용자 B가 평가를 가지고 있음
            const assessmentRepo = AppDataSource.getRepository(Assessment)
            const { Script } = await import("@features/script/domain/script.entity")
            const script = await AppDataSource.getRepository(Script).findOneBy({})
            const assessmentB = Assessment.create(userB.id, "audio.mp3", 60, script!.id)
            await assessmentRepo.save(assessmentB)

            // When: 사용자 A가 사용자 B의 평가에 접근하려고 시도함
            const response = await request(app)
                .get(`/api/v1/assessments/${assessmentB.id}`)
                .set("Authorization", `Bearer ${tokenA}`)

            // Then: 403 또는 404를 반환해야 함 (보안 권장 사항: 존재 여부 유출을 피하기 위해 404 반환)
            expect([403, 404]).toContain(response.status)
        })
    })

    describe("역할 기반 액세스 제어 (RBAC)", () => {
        it("관리자가 아닌 사용자의 스크립트 생성을 방지해야 한다", async () => {
            // When: 일반 사용자 A가 /scripts에 POST 요청을 시도함
            const response = await request(app)
                .post("/api/v1/scripts")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({
                    title: "Hacker Script",
                    content: "Should fail",
                    category: "General",
                    difficulty: "HARD",
                })

            // Then: 403 Forbidden을 반환해야 함
            expect(response.status).toBe(403)
        })
    })
})
