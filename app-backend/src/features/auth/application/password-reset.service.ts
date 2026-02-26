import { injectable, inject } from "tsyringe"
import { timingSafeEqual } from "crypto"
import type { IUserRepository } from "@features/user/domain/user-repository.interface"
import type { INotificationSender } from "@features/notification/domain/notification-sender.interface"
import { IRedisService } from "@shared/core/redis-service.interface"
import { IConfigService } from "@shared/core/config.interface"
import { IPasswordHasher } from "@shared/core/password-hasher.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { NotFoundException, ValidationException } from "@shared/core/exceptions/domain-exceptions"
import { passwordResetEmailTemplate } from "@shared/lib/templates/email-templates"
import { Password } from "@features/user/domain/value-objects/password.vo"
import type { ISessionTokenManager } from "../domain/session-token-manager.interface"
import { AuthRedisKeys } from "../domain/auth-redis-keys"
import { VerificationCode } from "../domain/verification-code"

@injectable()
export class PasswordResetService {
    constructor(
        @inject(DI_TOKENS.IUserRepository) private userRepository: IUserRepository,
        @inject(DI_TOKENS.IRedisService) private redisService: IRedisService,
        @inject(DI_TOKENS.IConfigService) private configService: IConfigService,
        @inject(DI_TOKENS.IPasswordHasher) private passwordHasher: IPasswordHasher,
        @inject(DI_TOKENS.INotificationSender) private notificationService: INotificationSender,
        @inject(DI_TOKENS.ISessionTokenManager) private tokenRotationService: ISessionTokenManager
    ) {}

    async requestPasswordReset(email: string): Promise<void> {
        const user = await this.userRepository.findByEmail(email)
        if (!user) {
            // 보안상 사용자가 없어도 성공 응답 (이메일 노출 방지)
            return
        }

        const resetCode = VerificationCode.generate()
        const template = passwordResetEmailTemplate(resetCode)
        await this.notificationService.send(user.email, template.subject, template.content)

        await this.redisService.setRequired(
            AuthRedisKeys.passwordReset(user.email),
            resetCode,
            this.configService.config.auth.resetCodeTTL
        )
    }

    async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
        const normalizedEmail = email.toLowerCase().trim()

        // 원자적 get+delete — 코드 사용 후 즉시 소멸 (재사용 공격 방지)
        const redisKey = AuthRedisKeys.passwordReset(normalizedEmail)
        await this.validateAndConsumeCode(redisKey, code, "auth.invalid_reset_code")

        const user = await this.userRepository.findByEmail(normalizedEmail)
        if (!user) {
            throw new NotFoundException("auth.user_not_found")
        }

        // Guard: 미인증 사용자는 비밀번호 재설정 불가
        if (!user.isVerified) {
            throw new ValidationException("auth.email_not_verified")
        }

        const newPasswordVO = await Password.createHashed(newPassword, this.passwordHasher)
        user.changePassword(newPasswordVO)

        await this.userRepository.save(user)

        // 비밀번호 재설정 후 모든 세션 무효화 (탈취된 토큰 차단)
        await this.tokenRotationService.clearAllClientTokens(user.id)
    }

    /** 원자적 조회+삭제 후 constant-time 비교 — TOCTOU 레이스 컨디션 방지 */
    private async validateAndConsumeCode(
        redisKey: string,
        code: string,
        errorKey: string
    ): Promise<void> {
        const storedCode = await this.redisService.getAndDeleteRequired(redisKey)
        if (!storedCode || !this.constantTimeEqual(storedCode, code)) {
            throw new ValidationException(errorKey)
        }
    }

    private constantTimeEqual(a: string, b: string): boolean {
        const bufA = Buffer.from(a, "utf8")
        const bufB = Buffer.from(b, "utf8")
        if (bufA.length !== bufB.length) return false
        return timingSafeEqual(bufA, bufB)
    }
}
