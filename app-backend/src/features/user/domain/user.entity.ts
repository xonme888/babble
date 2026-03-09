import {
    Entity,
    Column,
    OneToMany,
    DeleteDateColumn,
} from "typeorm"
import { randomUUID, randomBytes } from "crypto"
import { Assessment } from "@features/assessment/domain/assessment.entity"
import type { UserGoalLog } from "./user-goal-log.entity"
import { AggregateRoot } from "@shared/core/aggregate-root"
import { IPasswordHasher } from "@shared/core/password-hasher.interface"
import {
    ValidationException,
    ConflictException,
    ForbiddenException,
    EmailNotVerifiedException,
    AccountSuspendedException,
} from "@shared/core/exceptions/domain-exceptions"
import { Email } from "./value-objects/email.vo"
import { Password } from "./value-objects/password.vo"
import { UserRegisteredEvent } from "./events/user-registered.event"
import { EmailVerifiedEvent } from "./events/email-verified.event"
import { UserLoggedInEvent } from "./events/user-logged-in.event"

export enum UserRole {
    GUEST = "GUEST",
    USER = "USER",
    ADMIN = "ADMIN",
    THERAPIST = "THERAPIST",
    FAMILY = "FAMILY",
}

/**
 *
 * 도메인 규칙:
 * - 이메일은 고유해야 함
 * - 이메일 인증 전까지는 isVerified = false
 * - 비활성화된 사용자는 로그인 불가
 * - 비밀번호는 항상 해시된 상태로 저장
 * - 주간 목표는 최소 1 이상
 */
@Entity("usr_users")
export class User extends AggregateRoot {
    static readonly DEFAULT_WEEKLY_GOAL = 35

    static readonly DEFAULT_DAILY_GOAL = Math.ceil(User.DEFAULT_WEEKLY_GOAL / 7)

    @Column({ length: 100 })
    firstName: string

    @Column({ type: "varchar", length: 100, nullable: true })
    lastName: string | null

    @Column({ unique: true, length: 255 })
    email: string

    @Column({ select: false }) // Security: Should not be queryable by default
    password: string

    @Column({ default: false })
    isVerified: boolean

    @Column({ default: true })
    isActive: boolean

    @Column({ default: 35 }) // User.DEFAULT_WEEKLY_GOAL
    weeklyGoal: number

    @Column({ type: "simple-enum", enum: UserRole, default: UserRole.USER })
    role: UserRole

    @Column({ type: "timestamp", nullable: true })
    termsAgreedAt: Date | null

    @Column({ type: "varchar", length: 255, nullable: true })
    deviceId: string | null

    @Column({ type: "timestamp with time zone", nullable: true })
    serviceConsentAt: Date | null

    @Column({ type: "varchar", length: 50, nullable: true })
    serviceConsentVersion: string | null

    @Column({ type: "timestamp with time zone", nullable: true })
    voiceConsentAt: Date | null

    @Column({ type: "varchar", length: 50, nullable: true })
    voiceConsentVersion: string | null

    @DeleteDateColumn()
    deletedAt: Date | null

    // Relationships
    @OneToMany("Assessment", (assessment: Assessment) => assessment.user)
    assessments: Assessment[]

    @OneToMany("UserGoalLog", (log: UserGoalLog) => log.user)
    goalLogs: UserGoalLog[]

    static async register(
        email: Email,
        password: Password,
        firstName: string,
        lastName?: string
    ): Promise<User> {
        const user = new User()
        user.email = email.value
        user.password = password.value
        user.firstName = firstName
        user.lastName = lastName ?? null
        user.isVerified = false
        user.isActive = true
        user.role = UserRole.USER
        user.weeklyGoal = User.DEFAULT_WEEKLY_GOAL
        user.termsAgreedAt = null

        return user
    }

    /** 약관 동의 기록 */
    agreeToTerms(): void {
        this.termsAgreedAt = new Date()
    }

    // ── 게스트 익명 계정 ──

    /** 게스트 계정 생성 — 1단계 서비스 동의 포함 */
    static createGuest(deviceId: string, serviceConsentVersion: string): User {
        const user = new User()
        user.email = `guest_${randomUUID()}@guest.local`
        user.password = randomBytes(32).toString("hex")
        user.firstName = "Guest"
        user.lastName = null
        user.role = UserRole.GUEST
        user.isVerified = false
        user.isActive = true
        user.weeklyGoal = User.DEFAULT_WEEKLY_GOAL
        user.termsAgreedAt = null
        user.deviceId = deviceId
        user.serviceConsentAt = new Date()
        user.serviceConsentVersion = serviceConsentVersion
        user.voiceConsentAt = null
        user.voiceConsentVersion = null
        return user
    }

    /** 게스트 여부 판별 */
    isGuest(): boolean {
        return this.role === UserRole.GUEST
    }

    /** 게스트가 아니면 예외 */
    ensureIsGuest(): void {
        if (!this.isGuest()) {
            throw new ForbiddenException("auth.not_guest_account", "NOT_GUEST")
        }
    }

    /** 2단계 음성 데이터 수집 동의 */
    agreeToVoiceConsent(voiceConsentVersion: string): void {
        this.voiceConsentAt = new Date()
        this.voiceConsentVersion = voiceConsentVersion
    }

    /** 음성 동의 여부 */
    hasVoiceConsent(): boolean {
        return this.voiceConsentAt !== null
    }

    /** 게스트 → 정식 회원 승격 — deviceId 보존 (토큰 유실 시 복구 경로) */
    upgrade(email: string, hashedPassword: string, firstName?: string, lastName?: string): void {
        this.ensureIsGuest()
        this.email = email
        this.password = hashedPassword
        if (firstName) this.firstName = firstName
        this.lastName = lastName ?? null
        this.role = UserRole.USER
        this.isVerified = false
    }

    /** 일일 목표 횟수 — ceil(weeklyGoal / 7), 미설정 시 DEFAULT_DAILY_GOAL */
    get dailyGoalTarget(): number {
        return this.weeklyGoal ? Math.ceil(this.weeklyGoal / 7) : User.DEFAULT_DAILY_GOAL
    }

    /**
     * 도메인 로직: 이메일 인증
     */
    verifyEmail(): void {
        if (this.isVerified) {
            throw new ConflictException("user.email_already_verified", "EMAIL_ALREADY_VERIFIED")
        }

        this.isVerified = true

        // Domain Event 발행
        this.addDomainEvent(new EmailVerifiedEvent(this.id, this.email))
    }

    /**
     * 도메인 로직: 비밀번호 검증
     *
     * @param plainPassword 평문 비밀번호
     * @param passwordHasher 패스워드 해싱 어댑터
     * @returns 비밀번호 일치 여부
     */
    async validatePassword(
        plainPassword: string,
        passwordHasher: IPasswordHasher
    ): Promise<boolean> {
        return passwordHasher.compare(plainPassword, this.password)
    }

    /**
     * 도메인 로직: 비밀번호 변경
     */
    changePassword(newPassword: Password): void {
        this.password = newPassword.value
    }

    /**
     * 도메인 로직: 해시된 비밀번호로 직접 변경 (관리자 전용)
     */
    changePasswordFromHash(hashedPassword: string): void {
        this.password = hashedPassword
    }

    /**
     * 도메인 로직: 프로필 업데이트
     */
    updateProfile(firstName?: string, lastName?: string): void {
        if (firstName) this.firstName = firstName
        if (lastName !== undefined) this.lastName = lastName
    }

    /**
     * 도메인 로직: 주간 목표 설정
     */
    updateWeeklyGoal(goal: number): void {
        if (goal < 1) {
            throw new ValidationException("user.weekly_goal_min", "INVALID_WEEKLY_GOAL")
        }
        this.weeklyGoal = goal
    }

    /**
     * 도메인 로직: 역할 변경
     */
    updateRole(newRole: UserRole): void {
        this.role = newRole
    }

    /**
     * 도메인 로직: 사용자 활성화
     */
    activate(): void {
        if (this.isActive) {
            throw new ConflictException("user.already_active", "USER_ALREADY_ACTIVE")
        }
        this.isActive = true
    }

    /**
     * 도메인 로직: 사용자 비활성화
     */
    deactivate(): void {
        if (!this.isActive) {
            throw new ConflictException("user.already_inactive", "USER_ALREADY_INACTIVE")
        }
        this.isActive = false
    }

    /**
     * 도메인 로직: 활성 상태 설정 (관리자용 — Tell Don't Ask)
     */
    setActiveStatus(isActive: boolean): void {
        if (isActive) {
            this.activate()
        } else {
            this.deactivate()
        }
    }


    /**
     * 도메인 규칙: 로그인 가능 여부
     */
    canLogin(): boolean {
        return this.isActive && this.isVerified
    }

    /**
     * 로그인 전제조건 검증 — 실패 시 적절한 도메인 예외 throw
     */
    ensureLoginEligible(): void {
        if (!this.isVerified) {
            throw new EmailNotVerifiedException(this.email, true, 60)
        }
        if (!this.isActive) {
            throw new AccountSuspendedException("auth.account_deactivated")
        }
    }


    /**
     * 사용자 등록 이벤트 발행 (ID 할당 후 호출)
     */
    emitRegisteredEvent(): void {
        this.addDomainEvent(
            new UserRegisteredEvent(this.id, this.email, this.firstName, this.lastName)
        )
    }

    /**
     * 로그인 이벤트 발행
     */
    emitLoggedInEvent(loginMethod: string): void {
        this.addDomainEvent(new UserLoggedInEvent(this.id, this.email, loginMethod))
    }

    /**
     * Email을 Value Object로 반환
     */
    getEmail(): Email {
        return Email.create(this.email)
    }

    /**
     * 전체 이름 반환
     */
    getFullName(): string {
        return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName
    }
}
