import "reflect-metadata"
import request from "supertest"
import { Express } from "express"
import { container } from "tsyringe"
import { initializeTestApp, cleanupDatabase } from "../../utils/e2e-helper"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { User } from "@features/user/domain/user.entity"
import { IRedisService } from "@shared/core/redis-service.interface"

describe("인프라 회복 탄력성 (통합 테스트)", () => {
    let app: Express
    let redisService: IRedisService

    beforeAll(async () => {
        app = await initializeTestApp()
        redisService = container.resolve<IRedisService>("IRedisService")
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    describe("Redis 실패 시나리오", () => {
        it("로그인 시 Redis 실패를 우아하게 처리해야 한다 (Refresh Token 저장 실패)", async () => {
            // Given: refresh 토큰 저장 시에만 에러를 던지도록 Redis Mock 설정
            // (rate limiter의 setRequired 호출은 정상 동작해야 함)
            const originalImpl = (redisService.setRequired as jest.Mock).getMockImplementation()
            const setSpy = jest
                .spyOn(redisService, "setRequired")
                .mockImplementation(async (key: string, value: string, ttl?: number) => {
                    if (key.startsWith("refresh:")) {
                        throw new Error("Redis connection lost")
                    }
                    if (originalImpl) return originalImpl(key, value, ttl)
                })

            // 설정: 올바른 비밀번호 해시를 가진 인증된 사용자 생성
            const bcrypt = await import("bcryptjs")
            const { Password } = await import("@features/user/domain/value-objects/password.vo")
            const hashed = await bcrypt.hash("Password123!", 4)
            const hashedPassword = Password.fromHash(hashed)

            const userRepository = AppDataSource.getRepository(User)
            const user = new User()
            user.email = `redis-fail-${Date.now()}@example.com`
            user.password = hashedPassword.value
            user.firstName = "Fail"
            user.isVerified = true
            await userRepository.save(user)

            // When: 로그인 시도
            const response = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: user.email, password: "Password123!" })

            // Then: 토큰 저장에 실패하므로 500 상태 코드를 반환해야 함
            expect(response.status).toBe(500)
            expect(response.body.message).toMatch(/internal server error/i)

            // 다른 테스트를 위해 Redis Mock 복구
            setSpy.mockRestore()
        })
    })

    describe("이메일 서비스 실패 시나리오", () => {
        it("이메일 발송에 실패하더라도 회원가입 프로세스가 중단되지 않아야 한다 (우아한 성능 저하)", async () => {
            // 설정: 유니크한 이메일 사용
            const testUserDetail = {
                email: `email-fail-${Date.now()}@example.com`,
                password: "Password123!",
                firstName: "Graceful",
                agreedToTerms: true,
            }

            // When: 회원가입
            const response = await request(app).post("/api/v1/auth/register").send(testUserDetail)

            // Then: 계정 생성은 여전히 성공해야 함
            expect(response.status).toBe(201)
            expect(response.body.success).toBe(true)
        })
    })
})
