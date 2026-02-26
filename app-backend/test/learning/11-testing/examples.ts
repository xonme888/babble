export {}

/**
 * 11. Jest 테스트 패턴 예제
 *
 * 실행: npx ts-node test/learning/11-testing/examples.ts
 *
 * 참고: 이 파일은 실제 Jest 없이도 실행되도록 테스트 패턴을 시뮬레이션합니다.
 * 실제 테스트는 `npx jest test/user/unit/user-entity.spec.ts`로 실행합니다.
 */

// ============================================================
// 1. 테스트 대상: 간단한 도메인 엔티티
// ============================================================

class ExValidationException extends Error {
    constructor(message: string) {
        super(message)
        this.name = "ExValidationException"
    }
}

class ExConflictException extends Error {
    constructor(message: string) {
        super(message)
        this.name = "ExConflictException"
    }
}

/**
 * User 엔티티 (테스트 대상)
 */
class ExUser {
    id: number = 0
    email: string = ""
    isVerified: boolean = false
    isActive: boolean = true
    weeklyGoal: number = 35

    static create(id: number, email: string): ExUser {
        const user = new ExUser()
        user.id = id
        user.email = email
        return user
    }

    verifyEmail(): void {
        if (this.isVerified) {
            throw new ExConflictException("이미 인증된 이메일입니다")
        }
        this.isVerified = true
    }

    updateWeeklyGoal(goal: number): void {
        if (goal < 1) {
            throw new ExValidationException("주간 목표는 1 이상이어야 합니다")
        }
        this.weeklyGoal = goal
    }

    canLogin(): boolean {
        return this.isActive && this.isVerified
    }

    deactivate(): void {
        if (!this.isActive) {
            throw new ExConflictException("이미 비활성화된 사용자입니다")
        }
        this.isActive = false
    }
}

// ============================================================
// 2. 테스트 유틸리티 (Jest 없이 시뮬레이션)
// ============================================================

let passCount = 0
let failCount = 0

function describe(name: string, fn: () => void) {
    console.log(`\n📦 ${name}`)
    (fn as any)()
}

function it(name: string, fn: () => void) {
    try {
        (fn as any)()
        passCount++
        console.log(`  ✅ ${name}`)
    } catch (error: unknown) {
        failCount++
        console.log(`  ❌ ${name}`)
        console.log(`     에러: ${(error as Error).message}`)
    }
}

function expect(value: unknown) {
    return {
        toBe(expected: unknown) {
            if (value !== expected) {
                throw new Error(`Expected ${expected}, got ${value}`)
            }
        },
        toBeTruthy() {
            if (!value) throw new Error(`Expected truthy, got ${value}`)
        },
        toBeFalsy() {
            if (value) throw new Error(`Expected falsy, got ${value}`)
        },
        toThrow(ErrorClass?: unknown) {
            try {
                value()
                throw new Error("Expected function to throw, but it didn't")
            } catch (error: unknown) {
                if (ErrorClass && !(error instanceof ErrorClass)) {
                    throw new Error(`Expected ${ErrorClass.name}, got ${error.constructor.name}`)
                }
            }
        },
        toHaveBeenCalledTimes(count: number) {
            if (value._callCount !== count) {
                throw new Error(`Expected ${count} calls, got ${value._callCount}`)
            }
        },
    }
}

/** jest.(fn as any)() 시뮬레이션 */
function mockFn(returnValue?: unknown) {
    const fn = function (...args: unknown[]) {
        fn._callCount++
        fn._lastArgs = args
        return returnValue
    } as unknown
    fn._callCount = 0
    fn._lastArgs = []
    return fn
}

// ============================================================
// 3. 단위 테스트: User 엔티티 (Given-When-Then)
// ============================================================

console.log("=== Jest 테스트 패턴 시뮬레이션 ===")

describe("User Entity - 도메인 로직 테스트", () => {
    it("이메일 인증 성공", () => {
        // Given: 미인증 사용자
        const user = ExUser.create(1, "test@example.com")

        // When: 이메일 인증
        user.verifyEmail()

        // Then: 인증 상태 변경
        expect(user.isVerified).toBe(true)
    })

    it("이미 인증된 이메일 재인증 시 ConflictException", () => {
        // Given: 이미 인증된 사용자
        const user = ExUser.create(1, "test@example.com")
        user.verifyEmail()

        // When & Then: 재인증 시 에러
        expect(() => user.verifyEmail()).toThrow(ExConflictException)
    })

    it("주간 목표 업데이트 성공", () => {
        // Given
        const user = ExUser.create(1, "test@example.com")

        // When
        user.updateWeeklyGoal(50)

        // Then
        expect(user.weeklyGoal).toBe(50)
    })

    it("주간 목표 0 이하 시 ValidationException", () => {
        // Given
        const user = ExUser.create(1, "test@example.com")

        // When & Then
        expect(() => user.updateWeeklyGoal(0)).toThrow(ExValidationException)
        expect(() => user.updateWeeklyGoal(-1)).toThrow(ExValidationException)
    })

    it("인증되고 활성화된 사용자만 로그인 가능", () => {
        // Given: 미인증 사용자
        const user = ExUser.create(1, "test@example.com")

        // Then: 로그인 불가
        expect(user.canLogin()).toBeFalsy()

        // When: 이메일 인증
        user.verifyEmail()

        // Then: 로그인 가능
        expect(user.canLogin()).toBeTruthy()
    })

    it("비활성화된 사용자는 로그인 불가", () => {
        // Given: 인증된 사용자
        const user = ExUser.create(1, "test@example.com")
        user.verifyEmail()

        // When: 비활성화
        user.deactivate()

        // Then: 로그인 불가
        expect(user.canLogin()).toBeFalsy()
    })

    it("이미 비활성화된 사용자 재비활성화 시 ConflictException", () => {
        // Given: 비활성화된 사용자
        const user = ExUser.create(1, "test@example.com")
        user.deactivate()

        // When & Then
        expect(() => user.deactivate()).toThrow(ExConflictException)
    })
})

// ============================================================
// 4. Mock 사용 예제: Service 테스트
// ============================================================

describe("UserService - Mock Repository 테스트", () => {
    it("사용자 조회 시 Repository가 호출됨", () => {
        // Given: Mock Repository
        const mockFindByEmail = mockFn(null) // null 반환 (사용자 없음)
        const mockRepo = { findByEmail: mockFindByEmail }

        // When: 서비스에서 조회
        (mockRepo as any).findByEmail("test@example.com")

        // Then: 호출 확인
        expect(mockFindByEmail).toHaveBeenCalledTimes(1)
    })

    it("사용자 저장 시 Repository.save가 호출됨", () => {
        // Given: Mock Repository
        const mockSave = mockFn({ id: 1, email: "test@example.com" })
        const mockRepo = { save: mockSave }

        // When: 저장
        (mockRepo as any).save({ email: "test@example.com" })

        // Then
        expect(mockSave).toHaveBeenCalledTimes(1)
    })
})

// ============================================================
// 결과 출력
// ============================================================

console.log(`\n${"─".repeat(40)}`)
console.log(`결과: ${passCount} passed, ${failCount} failed`)
console.log(`${"─".repeat(40)}`)

if (failCount > 0) {
    console.log("\n❌ 일부 테스트 실패!")
} else {
    console.log("\n✅ 모든 테스트 통과!")
}

console.log(`
실제 프로젝트에서 테스트 실행:
  npm run test:unit     # 단위 테스트
  npm run test:int      # 통합 테스트
  npm run test:e2e      # E2E 테스트
  npm run test:coverage # 커버리지 리포트
`)
