import "reflect-metadata"
import * as bcrypt from "bcryptjs"
import { User, UserRole } from "@features/user/domain/user.entity"
import { Email } from "@features/user/domain/value-objects/email.vo"
import { Password } from "@features/user/domain/value-objects/password.vo"
import { EmailVerifiedEvent } from "@features/user/domain/events/email-verified.event"
import {
    ConflictException,
    ForbiddenException,
    ValidationException,
} from "@shared/core/exceptions/domain-exceptions"

describe("User 엔티티 (단위 테스트)", () => {
    describe("register (회원가입)", () => {
        it("팩토리 메서드를 통해 새로운 사용자 인스턴스를 생성해야 한다", async () => {
            // Given
            const email = Email.create("test@example.com")
            const hashed = await bcrypt.hash("Password123!", 4)
            const password = Password.fromHash(hashed)
            const firstName = "John"
            const lastName = "Doe"

            // When
            const user = await User.register(email, password, firstName, lastName)

            // Then
            expect(user.email).toBe(email.value)
            expect(user.password).toBe(password.value)
            expect(user.firstName).toBe(firstName)
            expect(user.lastName).toBe(lastName)
            expect(user.isVerified).toBe(false)
            expect(user.isActive).toBe(true)
            expect(user.role).toBe(UserRole.USER)
            expect(user.weeklyGoal).toBe(35)
        })
    })

    describe("verifyEmail (이메일 인증)", () => {
        it("이메일을 인증하고 도메인 이벤트를 추가해야 한다", () => {
            // Given
            const user = new User()
            user.id = 1
            user.email = "test@example.com"
            user.isVerified = false

            // When
            user.verifyEmail()

            // Then
            expect(user.isVerified).toBe(true)
            const events = user.getDomainEvents()
            expect(events.length).toBe(1)
            expect(events[0]).toBeInstanceOf(EmailVerifiedEvent)
        })

        it("이미 인증된 경우 에러를 던져야 한다", () => {
            // Given
            const user = new User()
            user.isVerified = true

            // When & Then
            expect(() => user.verifyEmail()).toThrow(ConflictException)
        })
    })

    describe("updateProfile (프로필 수정)", () => {
        it("프로필 필드를 업데이트해야 한다", () => {
            // Given
            const user = new User()
            user.firstName = "Old"
            user.lastName = "Old"

            // When
            user.updateProfile("New", "New")

            // Then
            expect(user.firstName).toBe("New")
            expect(user.lastName).toBe("New")
        })

        it("프로필 필드의 일부만 업데이트할 수 있어야 한다", () => {
            // Given
            const user = new User()
            user.firstName = "Old"
            user.lastName = "Old"

            // When
            user.updateProfile("New")

            // Then
            expect(user.firstName).toBe("New")
            expect(user.lastName).toBe("Old")
        })
    })

    describe("updateWeeklyGoal (주간 목표 수정)", () => {
        it("유효한 경우 주간 목표를 업데이트해야 한다", () => {
            // Given
            const user = new User()
            user.weeklyGoal = 35

            // When
            user.updateWeeklyGoal(50)

            // Then
            expect(user.weeklyGoal).toBe(50)
        })

        it("목표치가 1보다 작은 경우 에러를 던져야 한다", () => {
            // Given
            const user = new User()

            // When & Then
            expect(() => user.updateWeeklyGoal(0)).toThrow(ValidationException)
        })
    })

    describe("deactivate/activate", () => {
        it("활성화 상태를 토글해야 한다", () => {
            // Given
            const user = new User()
            user.isActive = true

            // When (비활성화)
            user.deactivate()
            // Then
            expect(user.isActive).toBe(false)

            // When (활성화)
            user.activate()
            // Then
            expect(user.isActive).toBe(true)
        })

        it("이미 비활성화된 사용자를 비활성화하려고 하면 에러를 던져야 한다", () => {
            // Given
            const user = new User()
            user.isActive = false

            // When & Then
            expect(() => user.deactivate()).toThrow(ConflictException)
        })
    })

    describe("dailyGoalTarget (일일 목표 계산)", () => {
        it("weeklyGoal이 있으면 ceil(weeklyGoal / 7)을 반환한다", () => {
            const user = new User()
            user.weeklyGoal = 35

            expect(user.dailyGoalTarget).toBe(5)
        })

        it("weeklyGoal이 7로 나누어떨어지지 않으면 올림한다", () => {
            const user = new User()
            user.weeklyGoal = 10

            expect(user.dailyGoalTarget).toBe(2) // ceil(10/7) = 2
        })

        it("weeklyGoal이 0이면 DEFAULT_DAILY_GOAL을 반환한다", () => {
            const user = new User()
            user.weeklyGoal = 0

            expect(user.dailyGoalTarget).toBe(User.DEFAULT_DAILY_GOAL)
        })
    })

    describe("canLogin", () => {
        it("활성화되고 인증된 경우에만 true를 반환해야 한다", () => {
            // Given
            const user = new User()

            // 케이스 1: 비활성, 미인증
            user.isActive = false
            user.isVerified = false
            expect(user.canLogin()).toBe(false)

            // 케이스 2: 활성, 미인증
            user.isActive = true
            user.isVerified = false
            expect(user.canLogin()).toBe(false)

            // 케이스 3: 활성, 인증됨
            user.isActive = true
            user.isVerified = true
            expect(user.canLogin()).toBe(true)
        })
    })

    // ── 게스트 익명 계정 (PRD-015) ──

    describe("createGuest (게스트 계정 생성)", () => {
        it("GUEST 역할의 User를 생성한다", () => {
            // When
            const guest = User.createGuest("device-123", "2026-02-24")

            // Then
            expect(guest.role).toBe(UserRole.GUEST)
            expect(guest.isActive).toBe(true)
            expect(guest.isVerified).toBe(false)
            expect(guest.firstName).toBe("Guest")
            expect(guest.deviceId).toBe("device-123")
            expect(guest.email).toMatch(/^guest_.*@guest\.local$/)
            expect(guest.password).toHaveLength(64) // 32 bytes hex
        })

        it("1단계 서비스 동의가 기록된다", () => {
            const guest = User.createGuest("device-abc", "2026-02-24")

            expect(guest.serviceConsentAt).toBeInstanceOf(Date)
            expect(guest.serviceConsentVersion).toBe("2026-02-24")
        })

        it("2단계 음성 동의는 null이다", () => {
            const guest = User.createGuest("device-abc", "2026-02-24")

            expect(guest.voiceConsentAt).toBeNull()
            expect(guest.voiceConsentVersion).toBeNull()
        })
    })

    describe("isGuest / ensureIsGuest", () => {
        it("GUEST 역할이면 true를 반환한다", () => {
            const guest = User.createGuest("d1", "v1")
            expect(guest.isGuest()).toBe(true)
        })

        it("USER 역할이면 false를 반환한다", () => {
            const user = new User()
            user.role = UserRole.USER
            expect(user.isGuest()).toBe(false)
        })

        it("게스트가 아닌 경우 ensureIsGuest가 예외를 던진다", () => {
            const user = new User()
            user.role = UserRole.USER
            expect(() => user.ensureIsGuest()).toThrow(ForbiddenException)
        })
    })

    describe("agreeToVoiceConsent (2단계 음성 동의)", () => {
        it("음성 동의 시점과 버전이 기록된다", () => {
            // Given
            const guest = User.createGuest("d1", "v1")

            // When
            guest.agreeToVoiceConsent("2026-02-24")

            // Then
            expect(guest.voiceConsentAt).toBeInstanceOf(Date)
            expect(guest.voiceConsentVersion).toBe("2026-02-24")
            expect(guest.hasVoiceConsent()).toBe(true)
        })

        it("동의 전에는 hasVoiceConsent가 false이다", () => {
            const guest = User.createGuest("d1", "v1")
            expect(guest.hasVoiceConsent()).toBe(false)
        })
    })

    describe("upgrade (게스트 → 정식 회원 승격)", () => {
        it("게스트를 정식 회원으로 승격한다", () => {
            // Given
            const guest = User.createGuest("d1", "v1")

            // When
            guest.upgrade("real@test.com", "hashedPw123", "John", "Doe")

            // Then
            expect(guest.role).toBe(UserRole.USER)
            expect(guest.email).toBe("real@test.com")
            expect(guest.password).toBe("hashedPw123")
            expect(guest.firstName).toBe("John")
            expect(guest.lastName).toBe("Doe")
            expect(guest.isVerified).toBe(false)
            expect(guest.deviceId).toBe("d1")
        })

        it("firstName을 생략하면 기존 값을 유지한다", () => {
            const guest = User.createGuest("d1", "v1")
            guest.upgrade("a@b.com", "pw")

            expect(guest.firstName).toBe("Guest")
        })

        it("게스트가 아닌 사용자에서 호출하면 예외를 던진다", () => {
            const user = new User()
            user.role = UserRole.USER

            expect(() => user.upgrade("a@b.com", "pw")).toThrow(ForbiddenException)
        })
    })
})
