import "reflect-metadata"
import { EmailLoginStrategy } from "@features/auth/application/email-login.strategy"
import { User } from "@features/user/domain/user.entity"
import { UnauthorizedException } from "@shared/core/exceptions/domain-exceptions"
import { createMockUserRepository, createMockPasswordHasher } from "../../utils/mock-factories"

describe("EmailLoginStrategy (이메일 로그인 전략)", () => {
    let strategy: EmailLoginStrategy
    let mockUserRepo: ReturnType<typeof createMockUserRepository>
    let mockPasswordHasher: ReturnType<typeof createMockPasswordHasher>

    const credentials = { email: "test@example.com", password: "password123" }

    function createVerifiedActiveUser(): User {
        const user = new User()
        user.id = 1
        user.email = "test@example.com"
        user.isVerified = true
        user.isActive = true
        user.password = "$2a$10$hashedpassword"
        return user
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockUserRepo = createMockUserRepository()
        mockPasswordHasher = createMockPasswordHasher()
        strategy = new EmailLoginStrategy(mockUserRepo, mockPasswordHasher)
    })

    describe("getName (전략 이름)", () => {
        it("'email'을 반환해야 한다", () => {
            expect(strategy.getName()).toBe("email")
        })
    })

    describe("login (로그인)", () => {
        it("유효한 자격증명으로 로그인 성공 시 사용자를 반환해야 한다", async () => {
            // Given
            const user = createVerifiedActiveUser()
            mockUserRepo.findByEmailWithPassword.mockResolvedValue(user)
            mockPasswordHasher.compare.mockResolvedValue(true)

            // When
            const result = await strategy.login(credentials)

            // Then
            expect(result).toBe(user)
            expect(mockUserRepo.findByEmailWithPassword).toHaveBeenCalledWith("test@example.com")
        })

        it("존재하지 않는 이메일이면 UnauthorizedException을 던져야 한다", async () => {
            // Given
            mockUserRepo.findByEmailWithPassword.mockResolvedValue(null)

            // When & Then
            await expect(strategy.login(credentials)).rejects.toThrow(UnauthorizedException)
        })

        it("비밀번호가 틀리면 UnauthorizedException을 던져야 한다", async () => {
            // Given
            const user = createVerifiedActiveUser()
            mockUserRepo.findByEmailWithPassword.mockResolvedValue(user)
            mockPasswordHasher.compare.mockResolvedValue(false)

            // When & Then
            await expect(strategy.login(credentials)).rejects.toThrow(UnauthorizedException)
        })

        it("이메일 미인증 사용자이면 예외를 던져야 한다", async () => {
            // Given
            const user = createVerifiedActiveUser()
            user.isVerified = false
            mockUserRepo.findByEmailWithPassword.mockResolvedValue(user)
            mockPasswordHasher.compare.mockResolvedValue(true)

            // When & Then
            await expect(strategy.login(credentials)).rejects.toThrow()
        })

        it("비활성화된 사용자이면 예외를 던져야 한다", async () => {
            // Given
            const user = createVerifiedActiveUser()
            user.isActive = false
            mockUserRepo.findByEmailWithPassword.mockResolvedValue(user)
            mockPasswordHasher.compare.mockResolvedValue(true)

            // When & Then
            await expect(strategy.login(credentials)).rejects.toThrow()
        })
    })
})
