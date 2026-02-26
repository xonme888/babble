# 04. DDD 패턴 (Domain-Driven Design)

## 왜 DDD인가?

### 문제: Transaction Script 안티패턴

비즈니스 로직이 Service에 산재하면:
```typescript
// ❌ 모든 로직이 Service에 있음
class UserService {
    async register(email: string, password: string) {
        // 이메일 형식 검증... 여기서도
        if (!email.includes("@")) throw new Error("Invalid email")
        // 비밀번호 규칙 검증... 여기서도
        if (password.length < 8) throw new Error("Too short")
        // 해싱
        const hashed = await bcrypt.hash(password, 10)
        // 저장
        await this.repo.save({ email, password: hashed })
    }

    async changePassword(userId: number, newPassword: string) {
        // 비밀번호 규칙 검증... 또 여기서도! (중복)
        if (newPassword.length < 8) throw new Error("Too short")
        const hashed = await bcrypt.hash(newPassword, 10)
        await this.repo.update(userId, { password: hashed })
    }
}
```

### 해결: DDD - 도메인 객체에 로직 응집

```typescript
// ✅ 비즈니스 로직이 도메인 객체에 응집
class User {
    static async register(email: Email, password: Password): Promise<User> {
        // Email VO가 형식 검증 담당
        // Password VO가 규칙 검증 + 해싱 담당
        const user = new User()
        user.email = email.value
        user.password = password.value // 이미 해시됨
        return user
    }

    changePassword(newPassword: Password): void {
        // Password VO가 규칙 검증 + 해싱을 이미 처리
        this.password = newPassword.value
    }
}
```

**핵심 차이**: 비밀번호 규칙이 `Password` Value Object **한 곳**에만 존재합니다. Service가 아무리 많아져도 규칙이 분산되지 않습니다.

---

## Entity vs Value Object

### Entity (엔티티)
**고유 ID**가 있습니다. 같은 속성이어도 ID가 다르면 **다른 객체**입니다.

```typescript
// User ID=1 (홍길동)과 User ID=2 (홍길동)은 다른 사용자
const user1 = { id: 1, name: "홍길동" }
const user2 = { id: 2, name: "홍길동" }
// user1 !== user2 (ID가 다름)
```

**왜 Entity인가?** 생명주기 추적이 필요합니다. 사용자가 이름을 바꿔도 **같은 사용자**입니다.

이 프로젝트: `User`, `Assessment`, `Script`, `Chapter`

### Value Object (값 객체)
ID가 없습니다. **값 자체**로 동등성을 비교합니다.

```typescript
// Email("a@b.com") == Email("a@b.com") → 같은 이메일
const email1 = Email.create("a@b.com")
const email2 = Email.create("a@b.com")
// email1.equals(email2) === true (값이 같음)
```

**왜 Value Object인가?** 유효성 검증을 **한 곳**에서 관리합니다.
- `Email.create("invalid")` → 에러! 어디서 만들든 형식 검증
- `Password.create("weak")` → 에러! 어디서 만들든 규칙 검증

이 프로젝트: `Email` (`src/features/user/domain/value-objects/email.vo.ts`), `Password` (`src/features/user/domain/value-objects/password.vo.ts`)

---

## Aggregate Root

**왜?** 비즈니스 규칙의 **일관성 경계**를 정의합니다.

- `User` Aggregate Root: 사용자 정보의 일관성 보장 (이메일 고유성, 인증 상태)
- `Assessment` Aggregate Root: 평가의 상태 전이 규칙 보장 (PENDING → ANALYZING → COMPLETED)

외부에서는 Aggregate Root를 통해서만 내부 상태를 변경할 수 있습니다.

---

## Factory Method

**왜 `new User()` 대신 `User.register()`인가?**

```typescript
// ❌ new는 비즈니스 규칙을 우회할 수 있음
const user = new User()
user.email = "invalid-email"  // 형식 검증 없이 통과!
user.password = "plain"        // 해싱 없이 저장!

// ✅ Factory Method는 비즈니스 규칙을 강제
static async register(email: Email, password: Password): Promise<User> {
    // Email.create()에서 형식 검증 완료
    // Password.create()에서 규칙 검증 + 해싱 완료
    const user = new User()
    user.email = email.value    // 반드시 검증된 이메일
    user.password = password.value  // 반드시 해시된 비밀번호
    return user
}
```

이 프로젝트: `User.register()` (`src/features/user/domain/user.entity.ts:82`), `Assessment.create()` (`src/features/assessment/domain/assessment.entity.ts:124`)

---

## Domain Event

**왜?** 기능 간 결합도를 낮추기 위해.

```
// ❌ 결합도 높음
class AuthService {
    async register(...) {
        await this.userRepo.save(user)
        await this.emailService.sendWelcome(user)  // 직접 의존
        await this.analyticsService.trackRegistration(user)  // 직접 의존
        await this.slackService.notifyNewUser(user)  // 직접 의존
    }
}

// ✅ 이벤트로 분리
class AuthService {
    async register(...) {
        await this.userRepo.save(user)
        user.emitRegisteredEvent()  // 이벤트만 발행
        this.eventDispatcher.publishFromAggregate(user)
    }
}

// 각 핸들러가 독립적으로 처리
class UserRegisteredEventHandler { /* 로깅 */ }
class EmailVerifiedEventHandler { /* 환영 이메일 */ }
// 슬랙 알림 추가? 핸들러만 추가하면 됨. AuthService 수정 불필요!
```

---

## 상태 전이

**왜 Enum 상태인가?** 잘못된 상태 전이를 방지합니다.

```
Assessment 상태 전이도:

PENDING ──── startAnalysis() ────▶ ANALYZING
                                       │
                                       ├── completeAnalysis() ──▶ COMPLETED
                                       │
                                       └── failAnalysis() ──────▶ FAILED
                                                                    │
                                                                    └── startAnalysis() ──▶ ANALYZING (재시도)

COMPLETED에서 다시 ANALYZING으로는 갈 수 없음! (도메인 규칙)
```

```typescript
// src/features/assessment/domain/assessment.entity.ts:163-175
startAnalysis(): void {
    if (this.status !== AssessmentStatus.PENDING &&
        this.status !== AssessmentStatus.FAILED &&
        this.status !== AssessmentStatus.ANALYZING) {
        throw new ValidationException(
            'assessment.invalid_status_for_analysis',
            'INVALID_ASSESSMENT_STATUS',
            { currentStatus: this.status }
        )
    }
    this.status = AssessmentStatus.ANALYZING
}
```

---

## 실제 프로젝트에서 찾아보기

| 개념 | 파일 경로 |
|------|----------|
| User Aggregate Root | `src/features/user/domain/user.entity.ts` |
| Assessment Aggregate Root | `src/features/assessment/domain/assessment.entity.ts` |
| Email Value Object | `src/features/user/domain/value-objects/email.vo.ts` |
| Password Value Object | `src/features/user/domain/value-objects/password.vo.ts` |
| Factory Method (User.register) | `src/features/user/domain/user.entity.ts:82` |
| Factory Method (Assessment.create) | `src/features/assessment/domain/assessment.entity.ts:124` |
| Domain Event 기본 클래스 | `src/shared/core/domain-event.ts` |
| UserRegisteredEvent | `src/features/user/domain/events/user-registered.event.ts` |
| AssessmentCreatedEvent | `src/features/assessment/domain/events/assessment-created.event.ts` |
| 상태 전이 (startAnalysis) | `src/features/assessment/domain/assessment.entity.ts:163` |
| 상태 전이 (completeAnalysis) | `src/features/assessment/domain/assessment.entity.ts:195` |
| 도메인 이벤트 축적/발행 | `src/features/user/domain/user.entity.ts:213-229` |
