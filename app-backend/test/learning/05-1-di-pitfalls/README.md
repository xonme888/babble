# 05-1. DI 안티패턴(Pitfalls)

> 의존성 주입을 사용하면서도 잘못 사용하는 8가지 설계 실수

## 왜 DI 안티패턴을 알아야 하는가?

05-dependency-injection에서 tsyringe를 이용한 DI의 **올바른 사용법**을 배웠다. 하지만 DI 컨테이너를 도입했다고 해서 설계가 자동으로 좋아지지는 않는다. 오히려 DI를 **잘못 사용하면** 컨테이너 없을 때보다 더 복잡하고 추적이 어려운 코드가 된다.

이 모듈은 순수 TypeScript로 8가지 DI 안티패턴을 재현하고, 이 프로젝트의 `diconfig.ts`가 왜 그렇게 설계되어 있는지 이해하는 것이 목표다.

## 실행 방법

```bash
npx ts-node test/learning/05-1-di-pitfalls/examples.ts
```

## 8가지 안티패턴 요약

| # | 안티패턴 | 위험도 | 증상 | 해결 |
|---|---------|--------|------|------|
| 1 | Control Freak | 🔴 높음 | 서비스 안에서 `new` 직접 생성 | 생성자 주입 |
| 2 | Service Locator | 🔴 높음 | 메서드 안에서 `container.resolve()` | 생성자에 의존성 명시 |
| 3 | Concrete Dependency | 🟡 중간 | 인터페이스 없이 구현체에 직접 의존 | 인터페이스에 의존 (DIP) |
| 4 | Hidden Dependency | 🔴 높음 | 전역 변수/환경 변수 직접 접근 | 설정도 생성자로 주입 |
| 5 | Constructor Over-injection | 🟡 중간 | 의존성 7개+ → SRP 위반 | 책임 분리 + Facade |
| 6 | Captive Dependency | 🔴 높음 | Singleton이 Transient를 가둠 | Factory 주입 |
| 7 | Circular Dependency | 🔴 높음 | A → B → A 순환 참조 | 이벤트 분리 / 인터페이스 추출 |
| 8 | Unnecessary Abstraction | 🟡 중간 | 구현 1개인데 인터페이스 생성 | YAGNI 적용 |

---

## 1. Control Freak (내부 new 직접 생성)

DI를 **사용하지 않는** 가장 기본적인 안티패턴.

### 왜 문제인가?
- 서비스 안에서 `new MySQLDatabase()`, `new MailgunSender()`를 직접 생성
- 의존 객체를 **교체할 수 없음** → 테스트 시 실제 DB/이메일에 접근해야 함
- 하나를 바꾸면 그것을 `new`하는 **모든 곳**을 수정해야 함

### 해결
- 생성자 파라미터로 의존성 주입 (Constructor Injection)
- 인터페이스에 의존하면 구현체를 자유롭게 교체 가능

### 프로젝트 참조
- `src/features/user/user.service.ts:17-23` — 생성자에서 의존성 주입
- `src/shared/infra/di/diconfig.ts:55-56` — 인터페이스 → 구현체 등록

---

## 2. Service Locator (컨테이너 남용)

DI를 쓰면서도 **DI의 장점을 버리는** 패턴.

### 왜 문제인가?
- 비즈니스 로직 안에서 `container.resolve("Logger")`를 직접 호출
- 생성자만 보면 의존성이 0개로 보이지만, 실제로는 여러 개 숨겨져 있음
- 테스트 시 **전역 컨테이너를 조작**해야 하는 취약한 구조
- "이 클래스가 뭘 필요로 하는지" 생성자만 봐서는 알 수 없음

### 해결
- 모든 의존성을 **생성자에 명시**. 필요한 것이 한눈에 보이게
- DI 컨테이너는 **컴포지션 루트**(diconfig.ts)에서만 사용

### 프로젝트 참조
- `src/features/auth/auth.service.ts:27-37` — 모든 의존성이 생성자에 명시
- `src/features/auth/presentation/guards/auth.guard.ts:13` — 미들웨어에서 Service Locator 사용 (Express 미들웨어의 구조적 한계로 인한 **의도적 예외**)

### Service Locator가 허용되는 경우
| 상황 | 허용 여부 | 이유 |
|------|----------|------|
| 비즈니스 서비스 | ❌ | 생성자 주입 사용 |
| Express 미들웨어/가드 | ✅ | 프레임워크가 인스턴스 생성을 제어 |
| 앱 진입점 (app.ts) | ✅ | 컴포지션 루트 |
| Worker 프로세서 | ✅ | 별도 프로세스 진입점 |

---

## 3. Concrete Dependency (구현체 직접 의존)

인터페이스 없이 구현 클래스에 직접 의존하면 **교체가 어려움**.

### 왜 문제인가?
- `constructor(private mailer: SendGridMailer)` — SendGrid 전용 메서드까지 사용 가능
- 다른 메일러로 교체하려면 **의존하는 모든 클래스**를 수정해야 함
- 구현 세부 사항에 결합 → 변경의 파급 효과 증가

### 해결
- 필요한 행위만 **인터페이스로 정의** (DIP — 의존성 역전 원칙)
- DI 설정에서 환경에 따라 구현체를 교체

### 프로젝트 참조
- `src/features/notification/application/notification-provider.interface.ts` — INotificationProvider 인터페이스
- `src/shared/infra/di/diconfig.ts:58-69` — Factory 패턴으로 SendGrid/Nodemailer 전환

---

## 4. Hidden Dependency (숨겨진 의존성)

전역 변수, 환경 변수, 싱글톤을 메서드 안에서 **직접 접근**하는 패턴.

### 왜 문제인가?
- 생성자가 비어 있어서 의존성이 **없는 것처럼 보임**
- 실제로는 `globalConfig`, `process.env` 등에 의존
- 테스트에서 환경 변수를 조작해야 하는 취약한 구조
- 다른 설정으로 실행하려면 전역 상태를 변경해야 함

### 해결
- 환경 변수를 **ConfigService로 캡슐화**하고 생성자로 주입
- 전역 접근을 제거하면 테스트에서 원하는 설정을 자유롭게 주입 가능

### 프로젝트 참조
- `src/shared/infra/config/config.service.ts` — 환경 변수를 ConfigService로 캡슐화
- `src/features/auth/infrastructure/crypto/jwt-token-provider.ts:16` — ConfigService를 생성자로 주입

---

## 5. Constructor Over-injection (생성자 과다 주입)

의존성이 **7개 이상**이면 Single Responsibility Principle 위반 신호.

### 왜 문제인가?
- 의존성이 많다 = 이 클래스가 **너무 많은 책임**을 진다
- 테스트 시 7~8개를 모두 Mock해야 함
- 코드 변경 시 영향 범위가 넓음

### 해결
- 관련 책임끼리 **별도 서비스로 분리**
- 분리된 서비스를 조율하는 **Facade** 패턴 적용
- 각 서비스가 2~4개의 의존성만 가지도록

### 프로젝트 참조
- `src/features/user/user.service.ts:17-23` — 의존성 3개 (적절한 수준)
- `src/features/assessment/assessment.service.ts:15-21` — 의존성 3개
- `src/features/auth/auth.service.ts:27-37` — 의존성 7개 (인증의 본질적 복잡성으로 인한 예외. 인증은 토큰, 해시, 전략, 알림, 캐시 등이 모두 필요)

### 의존성 개수 가이드라인
| 의존성 수 | 판단 |
|----------|------|
| 1~3개 | 적절 |
| 4~5개 | 주의 — 책임 분리 검토 |
| 6개+ | 위험 — 거의 확실히 SRP 위반 |
| 7개 (Auth) | 예외적 허용 — 도메인 복잡성이 원인 |

---

## 6. Captive Dependency (생명주기 불일치)

**Singleton**이 **Transient** 객체를 생성자에서 한 번만 받아 **영원히 가두는** 문제.

### 왜 문제인가?
- 요청마다 새로 만들어야 할 객체(RequestContext, DB Connection)가 Singleton 안에 갇힘
- 첫 번째 요청의 컨텍스트가 **영원히 재사용** → 데이터 오염
- 디버깅이 매우 어려움 (간헐적으로 다른 유저의 데이터가 보이는 현상)

### 해결
- **Factory 함수**를 주입하여 필요할 때마다 새 인스턴스 생성
- tsyringe에서는 `useFactory`로 구현

### 프로젝트 참조
- `src/shared/infra/di/diconfig.ts:58-69` — `useFactory`로 런타임에 인스턴스 생성
- `src/shared/infra/di/diconfig.ts:79` — `registerInstance`로 DataSource 단일 인스턴스 등록 (Singleton이 맞는 경우)

---

## 7. Circular Dependency (순환 의존)

A → B → A. DI 컨테이너가 **"누구를 먼저 만들어야 하는지" 결정 불가**.

### 왜 문제인가?
- tsyringe: `"Cannot inject ... circular dependency detected"` 에러
- 강결합의 극단적 형태 — 하나를 수정하면 양쪽 모두 영향

### 해결 방법 3가지

| 방법 | 설명 | 결합도 | 권장 |
|------|------|--------|------|
| 이벤트 분리 | A가 이벤트 발행, B가 구독 | 없음 | 가장 추천 |
| 인터페이스 추출 | A가 인터페이스를 구현, B는 인터페이스에만 의존 | 낮음 | 추천 |
| 파라미터 전달 | B가 A를 주입받지 않고, 필요한 데이터만 파라미터로 받음 | 낮음 | 간단한 경우 |

### 프로젝트 참조
- `src/features/user/domain/user.entity.ts:186-195` — 이벤트 발행으로 결합 제거
- `src/shared/lib/events/event-dispatcher.ts:23-32` — 이벤트 핸들러 독립 등록
- `src/shared/infra/di/diconfig.ts:125-141` — 이벤트 핸들러를 수동 등록하여 순환 방지

---

## 8. 과도한 추상화 (Unnecessary Abstraction)

구현이 하나뿐인데 **인터페이스 + DI**를 적용하면 복잡성만 증가.

### 왜 문제인가?
- 파일 수가 2배 (인터페이스 + 구현)
- 코드 추적 시 F12를 누르면 **인터페이스만** 나옴 → 구현까지 한 번 더 이동
- YAGNI 위반 (You Aren't Gonna Need It)

### 인터페이스 판단 기준

| 상황 | 인터페이스 필요? | 이유 |
|------|-----------------|------|
| 구현 2개+ (SendGrid/Nodemailer) | ✅ 필요 | 런타임에 교체해야 함 |
| 외부 시스템 (DB, API, Redis) | ✅ 필요 | 테스트에서 Mock 필수 |
| 순수 비즈니스 로직 (검증, 계산) | ❌ 불필요 | 교체할 이유가 없음 |
| 구현이 하나, 교체 가능성 0% | ❌ 불필요 | 복잡성만 증가 |

### 프로젝트 참조
- `src/shared/infra/di/diconfig.ts:58-69` — INotificationProvider: 구현 2개 → 인터페이스 필요
- `src/features/user/user.repository.ts` — UserRepository: 외부 시스템(DB) → 인터페이스 가치 있음
- `src/features/user/domain/user.entity.ts` — Entity: 인터페이스 없이 직접 사용 (교체 불필요)

---

## 실제 프로젝트에서 찾아보기

| 안티패턴 | 올바른 구현 파일 | 핵심 패턴 |
|---------|-----------------|-----------|
| Control Freak | `diconfig.ts`, `user.service.ts` | 생성자 주입 |
| Service Locator | `auth.service.ts` vs `auth.guard.ts` | 서비스는 생성자 주입, 미들웨어는 예외 |
| Concrete Dependency | `notification-provider.interface.ts` | 인터페이스 기반 DI |
| Hidden Dependency | `config.service.ts`, `jwt-token-provider.ts` | 설정도 주입 |
| Over-injection | `user.service.ts` (3개) vs `auth.service.ts` (7개) | 적절한 수 vs 예외적 허용 |
| Captive Dependency | `diconfig.ts:58-69` | useFactory로 해결 |
| Circular Dependency | `event-dispatcher.ts`, `diconfig.ts:125-141` | 이벤트로 분리 |
| Unnecessary Abstraction | Entity (인터페이스 없음) vs Repository (있음) | YAGNI 판단 |

---

## diconfig.ts 설계 해부

이 프로젝트의 DI 설정(`src/shared/infra/di/diconfig.ts`)이 사용하는 패턴들:

```
[인터페이스 등록]  → 구현체 교체 가능 (안티패턴 3 방지)
container.register("IPasswordHasher", { useClass: BcryptPasswordHasher })
container.register("ITokenProvider", { useClass: JwtTokenProvider })

[Factory 등록]     → 런타임에 조건부 생성 (안티패턴 6 방지)
container.register("INotificationProvider", { useFactory: (c) => {
    return env === 'sendgrid' ? c.resolve(SendGrid) : c.resolve(Nodemailer)
}})

[Instance 등록]    → 외부에서 생성된 객체를 그대로 등록
container.registerInstance("DataSource", AppDataSource)

[이벤트 핸들러]    → 순환 의존 방지 (안티패턴 7 방지)
dispatcher.register("UserRegistered", handler)
```

---

## 학습 후 체크리스트

- [ ] 서비스 안에 `new`로 의존성을 생성하는 곳이 있으면 → 생성자 주입으로 변경
- [ ] `container.resolve()`가 비즈니스 로직에 있으면 → 생성자로 이동 (미들웨어 제외)
- [ ] 구현 클래스를 직접 타입으로 사용하고 있으면 → 교체 가능성 평가 후 인터페이스 도입 여부 결정
- [ ] 환경 변수나 전역 변수를 직접 참조하면 → ConfigService로 캡슐화
- [ ] 생성자 의존성이 6개 이상이면 → 책임 분리 검토
- [ ] Singleton이 요청별 객체를 주입받고 있으면 → Factory 주입으로 변경
- [ ] A → B → A 순환 의존이 있으면 → 이벤트 또는 인터페이스 추출로 해소
- [ ] 구현이 하나뿐인 인터페이스가 있으면 → YAGNI 원칙 적용 검토
