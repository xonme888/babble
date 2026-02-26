import { injectable, inject } from "tsyringe"
import { timingSafeEqual } from "crypto"
import type { IUserRepository } from "@features/user/domain/user-repository.interface"
import type { INotificationSender } from "@features/notification/domain/notification-sender.interface"
import { IRedisService } from "@shared/core/redis-service.interface"
import { IDomainEventDispatcher } from "@shared/core/domain-event-dispatcher.interface"
import { IConfigService } from "@shared/core/config.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { NotFoundException, ValidationException } from "@shared/core/exceptions/domain-exceptions"
import { verificationEmailTemplate } from "@shared/lib/templates/email-templates"
import { AuthRedisKeys } from "../domain/auth-redis-keys"
import { VerificationCode } from "../domain/verification-code"

@injectable()
export class VerificationService {
    constructor(
        @inject(DI_TOKENS.IUserRepository) private userRepository: IUserRepository,
        @inject(DI_TOKENS.IRedisService) private redisService: IRedisService,
        @inject(DI_TOKENS.IDomainEventDispatcher) private eventDispatcher: IDomainEventDispatcher,
        @inject(DI_TOKENS.IConfigService) private configService: IConfigService,
        @inject(DI_TOKENS.INotificationSender) private notificationService: INotificationSender
    ) {}

    async verifyEmail(email: string, code: string): Promise<{ success: boolean; message: string }> {
        const normalizedEmail = email.toLowerCase().trim()

        // 원자적 get+delete — 코드 사용 후 즉시 소멸 (재사용 공격 방지)
        const redisKey = AuthRedisKeys.verification(normalizedEmail)
        await this.validateAndConsumeCode(redisKey, code, "auth.invalid_verification_code")

        const user = await this.userRepository.findByEmail(normalizedEmail)
        if (!user) {
            throw new NotFoundException("auth.user_not_found")
        }

        user.verifyEmail()
        await this.userRepository.save(user)

        this.eventDispatcher.publishFromAggregate(user)

        return {
            success: true,
            message: "auth.email_verified_success",
        }
    }

    async resendVerificationCode(email: string): Promise<void> {
        const user = await this.userRepository.findByEmail(email)
        if (!user) {
            throw new NotFoundException("auth.user_not_found")
        }

        if (user.isVerified) {
            throw new ValidationException("auth.email_already_verified")
        }

        await this.sendVerificationEmail(user.email)
    }

    /**
     * 인증 코드 생성 + Redis 저장 + 이메일 발송
     * register와 resendVerificationCode에서 공통 사용
     */
    async sendVerificationEmail(email: string): Promise<void> {
        const verificationCode = VerificationCode.generate()
        await this.redisService.setRequired(
            AuthRedisKeys.verification(email),
            verificationCode,
            this.configService.config.auth.verificationCodeTTL
        )

        const template = verificationEmailTemplate(verificationCode)
        await this.notificationService.send(email, template.subject, template.content)
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
