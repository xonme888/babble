import { injectable, inject } from "tsyringe"
import { Transactional } from "typeorm-transactional"
import { User, UserRole } from "@features/user/domain/user.entity"
import type { IUserRepository } from "@features/user/domain/user-repository.interface"
import { Email } from "@features/user/domain/value-objects/email.vo"
import { Password } from "@features/user/domain/value-objects/password.vo"
import { IPasswordHasher } from "@shared/core/password-hasher.interface"
import { ITokenProvider } from "../domain/token-provider.interface"
import { IRedisService } from "@shared/core/redis-service.interface"
import { LoginStrategyFactory } from "./login-strategy.factory"
import { TokenRotationService } from "./token-rotation.service"
import { VerificationService } from "./verification.service"
import {
    ConflictException,
    ForbiddenException,
    NotFoundException,
    ValidationException,
} from "@shared/core/exceptions/domain-exceptions"
import {
    isDuplicateKeyError,
    ServiceUnavailableException,
} from "@shared/core/exceptions/infrastructure-exceptions"
import { IDomainEventDispatcher } from "@shared/core/domain-event-dispatcher.interface"
import { IConfigService } from "@shared/core/config.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { AuthRedisKeys } from "../domain/auth-redis-keys"
import { ClientType } from "../domain/client-type"
import type { ILogger } from "@shared/core/logger.interface"

export type { ClientType }

@injectable()
export class AuthService {
    constructor(
        @inject(DI_TOKENS.IUserRepository) private userRepository: IUserRepository,
        @inject(DI_TOKENS.ITokenProvider) private tokenProvider: ITokenProvider,
        @inject(LoginStrategyFactory) private loginStrategyFactory: LoginStrategyFactory,
        @inject(DI_TOKENS.IRedisService) private redisService: IRedisService,
        @inject(DI_TOKENS.IDomainEventDispatcher) private eventDispatcher: IDomainEventDispatcher,
        @inject(DI_TOKENS.IConfigService) private configService: IConfigService,
        @inject(DI_TOKENS.IPasswordHasher) private passwordHasher: IPasswordHasher,
        @inject(TokenRotationService) private tokenRotationService: TokenRotationService,
        @inject(VerificationService) private verificationService: VerificationService,
        @inject(DI_TOKENS.ILogger) private logger: ILogger
    ) { }

    /**
     * 이메일 중복 체크 — 존재하면 409 + isVerified 메타데이터
     */
    async checkEmailAvailability(email: string): Promise<void> {
        const existingUser = await this.userRepository.findByEmail(email)
        if (existingUser) {
            throw new ConflictException("auth.email_in_use", undefined, {
                isVerified: existingUser.isVerified,
            })
        }
    }

    /**
     * 회원가입
     * DB 저장은 트랜잭션 내에서, 외부 서비스(이메일/Redis)는 트랜잭션 외부에서 호출
     */
    async register(
        email: string,
        password: string,
        firstName: string,
        lastName?: string,
        agreedToTerms?: boolean
    ): Promise<User> {
        if (agreedToTerms !== true) {
            throw new ValidationException("auth.terms_agreement_required", "TERMS_NOT_AGREED")
        }

        // 1단계: DB 트랜잭션 내에서 사용자 저장
        const user = await this.saveUserInTransaction(email, password, firstName, lastName)

        // 2단계: 트랜잭션 커밋 후 외부 서비스 호출 (이메일 발송, Redis 저장)
        await this.verificationService.sendVerificationEmail(user.email)

        // 3단계: Domain Event 발행
        user.emitRegisteredEvent()
        this.eventDispatcher.publishFromAggregate(user)

        return user
    }

    /**
     * 사용자 저장 (트랜잭션 격리)
     * DB 작업만 트랜잭션 안에서 수행하고, 외부 서비스 호출은 포함하지 않음
     */
    @Transactional()
    private async saveUserInTransaction(
        email: string,
        password: string,
        firstName: string,
        lastName?: string
    ): Promise<User> {
        const existingUser = await this.userRepository.findByEmail(email)

        if (existingUser) {
            throw new ConflictException("auth.email_in_use")
        }

        // 신규 사용자 등록
        const emailVO = Email.create(email)
        const passwordVO = await Password.createHashed(password, this.passwordHasher)

        const user = await User.register(emailVO, passwordVO, firstName, lastName)
        user.agreeToTerms()

        try {
            await this.userRepository.save(user)
        } catch (error: unknown) {
            if (isDuplicateKeyError(error as { message?: string; code?: string })) {
                throw new ConflictException("auth.email_in_use")
            }
            throw new ServiceUnavailableException("Database")
        }

        return user
    }

    /**
     * 로그인 (Strategy Pattern)
     * @param clientType 클라이언트 타입 — Redis 키를 분리하여 세션 간섭 방지
     */
    async login(
        strategyName: string,
        credentials: Record<string, unknown>,
        clientType: ClientType
    ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
        // Strategy 패턴으로 로그인 수행
        const strategy = this.loginStrategyFactory.getStrategy(strategyName)
        const user = await strategy.login(credentials)

        // JWT 토큰 생성
        const accessToken = this.tokenProvider.generateAccessToken(user.id, user.role)
        const refreshToken = this.tokenProvider.generateRefreshToken(user.id)

        // Refresh Token을 Redis에 저장 (클라이언트별 분리)
        await this.redisService.setRequired(
            AuthRedisKeys.refreshToken(user.id, clientType),
            refreshToken,
            this.configService.config.auth.refreshTokenTTL
        )

        // UserLoggedInEvent 발행
        user.emitLoggedInEvent(strategyName)
        this.eventDispatcher.publishFromAggregate(user)

        return { accessToken, refreshToken, user }
    }

    /**
     * 토큰 갱신 — TokenRotationService에 위임
     */
    async refreshToken(
        token: string,
        clientType: ClientType
    ): Promise<{ accessToken: string; refreshToken: string }> {
        return this.tokenRotationService.refresh(token, clientType)
    }

    /**
     * 로그아웃 (특정 클라이언트 타입만) — TokenRotationService에 위임
     */
    async logout(accessToken: string, clientType: ClientType): Promise<void> {
        return this.tokenRotationService.revoke(accessToken, clientType)
    }

    /**
     * 전체 로그아웃 (모든 클라이언트 세션 종료) — TokenRotationService에 위임
     */
    async logoutAll(accessToken: string): Promise<void> {
        return this.tokenRotationService.revokeAll(accessToken)
    }

    // ── 게스트 익명 계정 (PRD-015) ──

    /**
     * 게스트 계정 생성 + 토큰 발급
     * 같은 deviceId로 이미 GUEST가 존재하면 기존 계정 반환 (중복 방지)
     */
    async createGuestAccount(
        deviceId: string,
        serviceConsentVersion: string,
        clientType: ClientType
    ): Promise<{ accessToken: string; refreshToken: string }> {
        // 기존 게스트 확인 (deviceId 중복 방지)
        const existing = await this.userRepository.findGuestByDeviceId(deviceId)
        if (existing) {
            return this.generateGuestTokens(existing, clientType)
        }

        // upgrade된 사용자 감지 — 앱 업데이트 등으로 토큰 유실 후 같은 deviceId로 재요청 시
        const upgraded = await this.userRepository.findUpgradedUserByDeviceId(deviceId)
        if (upgraded) {
            const maskedEmail = upgraded.email.replace(
                /^(.)(.*)(@.*)$/,
                (_, first, middle, domain) =>
                    first + "*".repeat(Math.min(middle.length, 3)) + domain
            )
            throw new ConflictException("auth.device_already_upgraded", "DEVICE_ALREADY_UPGRADED", {
                maskedEmail,
            })
        }

        const guest = User.createGuest(deviceId, serviceConsentVersion)
        await this.userRepository.save(guest)

        return this.generateGuestTokens(guest, clientType)
    }

    /** 게스트 토큰 생성 + Redis 저장 */
    private async generateGuestTokens(
        guest: User,
        clientType: ClientType
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const accessToken = this.tokenProvider.generateAccessToken(guest.id, guest.role)
        const refreshToken = this.tokenProvider.generateRefreshToken(guest.id)

        await this.redisService.setRequired(
            AuthRedisKeys.refreshToken(guest.id, clientType),
            refreshToken,
            this.configService.config.auth.refreshTokenTTL
        )

        return { accessToken, refreshToken }
    }

    /** 2단계 음성 동의 기록 */
    async recordVoiceConsent(userId: number, voiceConsentVersion: string): Promise<Date> {
        const user = await this.userRepository.findByIdOrThrow(userId)
        user.agreeToVoiceConsent(voiceConsentVersion)
        await this.userRepository.save(user)
        if (!user.voiceConsentAt) {
            throw new ValidationException("auth.voice_consent_not_set", "VOICE_CONSENT_NOT_SET")
        }
        return user.voiceConsentAt
    }

    /**
     * 게스트 → 정식 회원 승격
     * 기존 userId 유지 → 모든 데이터 자동 연결
     */
    async upgradeGuest(
        userId: number,
        email: string,
        password: string,
        firstName?: string,
        lastName?: string,
        clientType: ClientType = "mobile"
    ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
        // 이메일 중복 확인
        const emailExists = await this.userRepository.existsByEmail(email)
        if (emailExists) {
            throw new ConflictException("auth.email_in_use")
        }

        const user = await this.userRepository.findByIdOrThrow(userId)
        user.ensureIsGuest()

        // 비밀번호 해싱 + 승격
        const hashedPassword = await this.passwordHasher.hash(password)
        user.upgrade(email, hashedPassword, firstName, lastName)
        user.agreeToTerms()
        await this.userRepository.save(user)

        // 이메일 인증 발송
        await this.verificationService.sendVerificationEmail(email)

        // 새 토큰 발급 (role=USER)
        const accessToken = this.tokenProvider.generateAccessToken(user.id, user.role)
        const refreshToken = this.tokenProvider.generateRefreshToken(user.id)

        await this.redisService.setRequired(
            AuthRedisKeys.refreshToken(user.id, clientType),
            refreshToken,
            this.configService.config.auth.refreshTokenTTL
        )

        return { accessToken, refreshToken, user }
    }

    /**
     * 게스트 데이터를 기존 회원에 병합
     * 게스트 User의 FK 참조 데이터를 targetUser로 UPDATE 후 게스트 soft delete
     */
    @Transactional()
    async mergeGuestToUser(guestUserId: number, targetUserId: number): Promise<void> {
        const guest = await this.userRepository.findByIdOrThrow(guestUserId, "auth.guest_not_found")
        guest.ensureIsGuest()

        const target = await this.userRepository.findByIdOrThrow(targetUserId)
        if (target.isGuest()) {
            throw new ForbiddenException("auth.merge_target_is_guest", "MERGE_TARGET_IS_GUEST")
        }

        // 게스트 deviceId를 인증 사용자에 이전 (토큰 유실 시 복구 경로)
        if (guest.deviceId && !target.deviceId) {
            target.deviceId = guest.deviceId
            await this.userRepository.save(target)
        }

        // FK가 걸린 테이블들의 userId를 일괄 UPDATE + 게스트 soft delete
        await this.userRepository.mergeGuestData(guestUserId, targetUserId)
        await this.userRepository.softDelete(guestUserId)

        this.logger.info("게스트 데이터 병합 완료", {
            guestUserId,
            targetUserId,
        })
    }

    /** 게스트 본인 데이터 삭제 */
    async deleteGuestAccount(userId: number): Promise<void> {
        const user = await this.userRepository.findByIdOrThrow(userId)
        user.ensureIsGuest()
        await this.userRepository.softDelete(userId)
    }
}
