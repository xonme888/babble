# 04-1. DDD 안티패턴(Pitfalls)

> 도메인 모델 설계에서 흔히 저지르는 8가지 실수와 해결법

## 왜 DDD 안티패턴을 알아야 하는가?

04-ddd-patterns에서 Value Object, Domain Event, Aggregate Root, Factory Method의 **올바른 사용법**을 배웠다. 하지만 실무에서는 "알고 있는데도 잘못 쓰는" 경우가 더 많다. 이 모듈은 **자주 발생하는 설계 실수**를 직접 재현하고, 왜 문제인지 체감한 뒤 해결하는 방식으로 진행된다.

**03-1(TypeORM Pitfalls)과의 차이**: 03-1은 ORM/DB 레벨 문제(N+1, Transaction 등)였지만, 04-1은 **도메인 모델 설계** 레벨의 문제다. TypeORM이나 DB 없이 순수 TypeScript로 동작한다.

## 실행 방법

```bash
npx ts-node test/learning/04-1-ddd-pitfalls/examples.ts
```

## 8가지 안티패턴 요약

| # | 안티패턴 | 위험도 | 증상 | 해결 |
|---|---------|--------|------|------|
| 1 | Anemic Domain Model | 🔴 높음 | Entity가 데이터만, Service가 모든 로직 | 비즈니스 메서드를 Entity에 |
| 2 | Primitive Obsession | 🔴 높음 | email이 string, 검증이 곳곳에 중복 | Value Object로 감싸기 |
| 3 | Constructor 노출 | 🟡 중간 | `new Entity(잘못된값)` 가능 | private constructor + Factory |
| 4 | Mutable Value Object | 🟡 중간 | VO 필드 직접 수정 가능 | readonly + 새 객체 반환 |
| 5 | Domain Event 누락 | 🟡 중간 | 메서드에서 부수효과 직접 호출 | 이벤트 발행 + 핸들러 분리 |
| 6 | Aggregate Root 우회 | 🔴 높음 | 내부 컬렉션을 외부에서 직접 수정 | private + 복사본 반환 |
| 7 | 잘못된 동등성 비교 | 🟡 중간 | `===`로 비교하면 항상 false | equals() 메서드 구현 |
| 8 | 비즈니스 로직 위치 오류 | 🔴 높음 | Controller/Service에 규칙 중복 | Entity에 규칙 집중 |

---

## 1. Anemic Domain Model (빈약한 도메인 모델)

**가장 흔한 안티패턴**. Entity가 getter/setter만 가진 데이터 홀더이고, 모든 비즈니스 로직이 Service에 있는 구조.

### 왜 문제인가?
- Entity 필드가 public이면 **누구나 직접 변경** 가능 → Service의 검증 우회
- `user.weeklyGoal = -10` 같은 코드가 컴파일/런타임 에러 없이 통과
- Service가 아닌 경로(배치, 다른 모듈)에서 Entity를 수정하면 규칙이 적용되지 않음

### 해결
- Entity에 **private 필드 + 비즈니스 메서드** 배치
- `updateWeeklyGoal(goal)` 메서드 안에서 검증 수행
- 외부에서 필드 직접 접근 불가

### 프로젝트 참조
- `src/features/user/domain/user.entity.ts:145-150` — `updateWeeklyGoal()` 비즈니스 규칙 내장
- `src/features/assessment/domain/assessment.entity.ts:163` — `startAnalysis()` 상태 전이 규칙

---

## 2. Primitive Obsession (원시 타입 집착)

email을 `string`, money를 `number`로 표현하는 습관. 간단해 보이지만 **검증 누락과 중복**의 원인.

### 왜 문제인가?
- `createUser("not-an-email", -500)` — 에러 없이 생성됨
- 검증 로직이 Controller, Service, 유틸 등 **여러 곳에 중복**되거나 아예 누락
- "이메일 형식 검증 규칙"이 변경되면 모든 곳을 찾아서 수정해야 함

### 해결
- **Value Object**로 감싸고, `create()` Factory에서 **생성 시점에 한 번** 검증
- Email: 정규식 검증 + 소문자 정규화
- Money: 음수 방지 + 통화 불일치 방지
- 생성 후에는 **항상 유효**한 상태가 보장됨

### 프로젝트 참조
- `src/features/user/domain/value-objects/email.vo.ts:22-41` — `Email.create()` + 정규식 + RFC 5321
- `src/features/user/domain/value-objects/password.vo.ts` — `Password.create()` + bcrypt + 길이/문자 규칙

---

## 3. Constructor 노출 (불변식 우회)

`new Entity(...)` 를 직접 호출할 수 있으면, **생성 시 비즈니스 규칙을 우회**할 수 있다.

### 왜 문제인가?
- `new ExBadProduct("", -100, -5)` — 이름 빈 문자열, 가격 음수, 재고 음수 모두 허용
- 유효하지 않은 상태의 객체가 시스템에 존재하게 됨

### 해결
- **private constructor** + **static create()** Factory Method
- 모든 필드 검증 후에만 인스턴스 생성
- TypeScript의 `private constructor`로 외부 `new` 차단

### 프로젝트 참조
- `src/features/user/domain/user.entity.ts:82-99` — `User.register()` Factory Method
- `src/features/assessment/domain/assessment.entity.ts:124-141` — `Assessment.create()` Factory Method

---

## 4. Mutable Value Object (변경 가능한 값 객체)

Value Object의 핵심은 **불변성**인데, 필드가 public이면 깨진다.

### 왜 문제인가?
- 두 변수가 같은 VO를 참조할 때, 한쪽 변경이 다른 쪽에 영향
- `price.amount = 500` → cart와 receipt 양쪽 다 변경됨
- 디버깅이 매우 어려운 "공유 참조" 버그 발생

### 해결
- **readonly 필드** — 컴파일 타임에 변경 차단
- `add()`, `subtract()` 등은 **새 객체를 반환** (원본 불변)
- 원본 객체는 절대 변경되지 않음

### 프로젝트 참조
- `src/features/user/domain/value-objects/email.vo.ts:13` — `private readonly _value`
- `src/features/user/domain/value-objects/password.vo.ts` — `readonly hashedValue`

---

## 5. Missing Domain Events (도메인 이벤트 누락)

메서드 안에서 email, inventory, analytics 서비스를 **직접 호출**하는 패턴.

### 왜 문제인가?
- `pay()` 메서드가 3개 서비스에 직접 의존 → **강결합**
- 새 기능(쿠폰 적용, 알림 전송 등) 추가 시마다 `pay()` 수정 필요 → **OCP 위반**
- 테스트 시 모든 의존 서비스를 Mock해야 함

### 해결
- Entity가 **Domain Event를 발행**만 하고, 핸들러가 독립적으로 반응
- 새 기능 = 새 핸들러 추가 (기존 코드 수정 불필요)
- 테스트 시 이벤트 발행 여부만 확인하면 됨

### 프로젝트 참조
- `src/features/user/domain/user.entity.ts:186-195` — `emitRegisteredEvent()` 이벤트 발행
- `src/features/assessment/domain/assessment.entity.ts:146-156` — `emitCreatedEvent()`
- `src/shared/lib/events/event-dispatcher.ts` — 핸들러 등록 및 디스패치

---

## 6. Aggregate Root 우회

내부 컬렉션(배열 등)이 public이면, **Root의 검증을 우회**하여 직접 수정 가능.

### 왜 문제인가?
- `cart.items[0].quantity = -10` → Root가 모르게 음수 수량 설정
- `cart.items.push(...)` → 검증 없이 아이템 추가
- Aggregate의 **일관성 규칙이 무력화**됨

### 해결
- **private 컬렉션** + `addItem()`, `updateQuantity()` 등 Root 메서드만 노출
- `getItems()` 는 **배열 복사본** 반환 (원본 수정 불가)
- 모든 변경은 Root 메서드를 통해서만 가능

### 프로젝트 참조
- `src/features/user/domain/user.entity.ts:145-150` — Root 메서드를 통한 상태 변경
- `src/features/assessment/domain/assessment.entity.ts:163-190` — 상태 전이는 Root만 가능

---

## 7. 잘못된 동등성 비교

JavaScript에서 `===` 는 **참조 비교**. 같은 ID의 Entity, 같은 값의 VO도 `false`.

### 왜 문제인가?
- Entity: 같은 ID인데 `===` 비교하면 `false`
- Value Object: 같은 값인데 `===` 비교하면 `false`
- 배열에서 `includes()`, `indexOf()`, Set 중복 제거 시 버그 발생

### 해결
- Entity: **`equals()` 메서드로 ID 기반 비교**
- Value Object: **`equals()` 메서드로 값 기반 비교**
- 배열에서 찾을 때 `some(e => e.equals(target))` 사용

### 프로젝트 참조
- `src/features/user/domain/value-objects/email.vo.ts:53-58` — `equals()` 값 기반 비교

---

## 8. 비즈니스 로직 위치 오류

같은 검증 규칙이 Controller와 Service에 **중복**되어 있는 패턴.

### 왜 문제인가?
- Controller는 `1~100` 범위 체크, Service는 `1~` 만 체크 → **규칙 불일치**
- CLI, 배치, 다른 API에서 같은 로직 필요하면 복붙 → 중복 증가
- 규칙 변경 시 여러 곳을 찾아서 수정해야 함

### 해결
- 도메인 규칙은 **Entity 한 곳에만** 배치 (Single Source of Truth)
- Controller → Service → Entity 순으로 **호출만 위임**
- 규칙 변경 시 Entity 한 곳만 수정

### 프로젝트 참조
- `src/features/user/domain/user.entity.ts:145-150` — 도메인 규칙은 Entity에
- `src/features/user/user.service.ts:270-277` — Service는 Entity에 위임

---

## 실제 프로젝트에서 찾아보기

| 안티패턴 | 올바른 구현 파일 | 핵심 패턴 |
|---------|-----------------|-----------|
| Anemic Model | `user.entity.ts` | 비즈니스 메서드 내장 |
| Primitive Obsession | `email.vo.ts`, `password.vo.ts` | Value Object + Factory |
| Constructor 노출 | `user.entity.ts`, `assessment.entity.ts` | private constructor + Factory |
| Mutable VO | `email.vo.ts` | `private readonly` 필드 |
| Event 누락 | `user.entity.ts`, `event-dispatcher.ts` | Domain Event 발행 |
| Root 우회 | `assessment.entity.ts` | Root 메서드를 통한 상태 전이 |
| 동등성 비교 | `email.vo.ts` | `equals()` 메서드 |
| 로직 위치 오류 | `user.entity.ts`, `user.service.ts` | Entity에 규칙, Service는 위임 |

---

## 학습 후 체크리스트

- [ ] Entity에 public 필드가 있으면 → private + 메서드로 변경
- [ ] string, number로 도메인 개념을 표현하고 있으면 → Value Object 고려
- [ ] `new Entity(...)` 를 직접 호출하고 있으면 → Factory Method 패턴 적용
- [ ] Value Object의 필드를 변경할 수 있으면 → readonly + 새 객체 반환
- [ ] 메서드 안에서 다른 서비스를 직접 호출하면 → Domain Event 도입 고려
- [ ] 내부 배열/컬렉션이 외부에서 수정 가능하면 → 복사본 반환
- [ ] `===` 로 Entity/VO를 비교하고 있으면 → `equals()` 메서드 구현
- [ ] 같은 비즈니스 규칙이 여러 레이어에 있으면 → Entity에 집중
