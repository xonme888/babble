# 11-1. 테스트 안티패턴(Pitfalls)

> 테스트를 작성하면서 흔히 빠지는 8가지 함정과 해결법

## 왜 테스트 안티패턴을 알아야 하는가?

11-testing에서 Jest와 테스트 피라미드의 **올바른 사용법**을 배웠다. 하지만 테스트를 많이 작성한다고 코드 품질이 자동으로 올라가지는 않는다. **나쁜 테스트**는 없는 것보다 더 해롭다 — 리팩토링을 가로막고, 거짓 안정감을 주고, 개발 속도를 떨어뜨린다.

이 모듈은 순수 TypeScript로 8가지 테스트 안티패턴을 재현하고, 이 프로젝트의 테스트 코드가 왜 그런 구조인지 이해하는 것이 목표다.

## 실행 방법

```bash
npx ts-node test/learning/11-1-testing-pitfalls/examples.ts
```

## 8가지 안티패턴 요약

| # | 안티패턴 | 위험도 | 증상 | 해결 |
|---|---------|--------|------|------|
| 1 | 구현 의존 테스트 | 🔴 높음 | 리팩토링하면 테스트가 깨짐 | 결과(행위)만 검증 |
| 2 | 깨지기 쉬운 테스트 | 🔴 높음 | 에러 메시지 변경에 테스트 실패 | 핵심 행위만 느슨하게 검증 |
| 3 | Mock 과다 사용 | 🔴 높음 | Mock이 Mock을 테스트하는 순환 | 테스트 대상은 실제 객체 |
| 4 | 테스트 간 커플링 | 🔴 높음 | 실행 순서에 따라 결과가 달라짐 | beforeEach로 상태 초기화 |
| 5 | 거대한 테스트 | 🟡 중간 | 실패 시 원인 파악 불가 | 1 테스트 = 1 시나리오 |
| 6 | 마법의 값 | 🟡 중간 | 테스트 데이터의 의도 불명확 | Factory + 의미 있는 변수명 |
| 7 | 슬리핑 테스트 | 🟡 중간 | 고정 시간 대기로 느리거나 불안정 | Promise/이벤트 기반 대기 |
| 8 | 검증 없는 테스트 | 🔴 높음 | 실행만 하고 결과 미확인 | Given-When-Then + 명시적 assert |

---

## 1. 구현 의존 테스트 (Implementation-Coupled Test)

내부 구현이 바뀌면 **동작은 같은데 테스트가 깨지는** 패턴.

### 왜 문제인가?
- 내부 메서드 호출 순서, 호출 횟수, 로그 형식 등을 검증
- 리팩토링(내부 개선)이 목적인데, 리팩토링할 때마다 테스트를 고쳐야 함
- **테스트가 리팩토링을 가로막는** 역설적 상황

### 해결
- **"무엇을 하는가"**(결과)만 검증. **"어떻게 하는가"**(구현)는 검증하지 않음
- Mock의 호출 횟수/순서보다 **최종 상태와 반환값**에 집중

### 프로젝트 참조
- `test/user/unit/user-entity.spec.ts` — Entity 상태의 "결과"만 검증
- `test/assessment/unit/assessment-entity.spec.ts` — `status`, `retryCount` 같은 결과값

---

## 2. 깨지기 쉬운 테스트 (Fragile Test)

에러 메시지 한 글자만 바뀌어도 **의미상 정확한 테스트가 실패**하는 패턴.

### 왜 문제인가?
- `expect(error.message).toBe("비밀번호는 8자 이상이어야 합니다")` — 전체 문자열 비교
- 메시지가 "비밀번호는 최소 8자입니다"로 바뀌면? 검증 로직은 동일한데 테스트 실패
- 국제화(i18n) 적용하면 메시지가 키값으로 바뀌므로 **모든 테스트가 깨짐**

### 해결
- 예외 **타입**(클래스)을 검증: `toThrow(ValidationException)`
- 또는 핵심 속성만 검증: `result.valid === false`
- 메시지 내용은 검증하지 않거나, 포함 여부(`toContain`)로 느슨하게

### 프로젝트 참조
- `test/user/unit/user-entity.spec.ts:56` — `toThrow(ValidationException)` 타입만 검증
- `test/auth/unit/auth.service.spec.ts:163` — `rejects.toThrow()` 예외 발생 여부

---

## 3. Mock 과다 사용 (Mock Overuse)

테스트 대상 자체를 Mock하여 **아무것도 검증하지 못하는** 패턴.

### 왜 문제인가?
- Mock이 반환할 값을 직접 지정 → 실제 로직은 실행되지 않음
- **Mock이 Mock을 테스트하는** 순환 구조
- 커버리지는 높은데 실제 버그를 잡지 못함

### Mock 사용 기준

| 대상 | Mock 사용 | 이유 |
|------|----------|------|
| Entity/Value Object | ❌ | 순수 로직, 부작용 없음 |
| 비즈니스 계산/검증 | ❌ | 직접 실행해야 로직 검증 |
| Repository (DB) | ✅ | 외부 시스템 의존 제거 |
| 외부 API (이메일, AI) | ✅ | 네트워크 호출 제거 |
| Redis/Queue | ✅ | 인프라 의존 제거 |

### 프로젝트 참조
- `test/user/unit/user-entity.spec.ts` — Entity는 Mock 없이 직접 테스트
- `test/auth/unit/auth.service.spec.ts:30-64` — Repository만 Mock, Service는 실제 객체

---

## 4. 테스트 간 커플링 (Shared State Between Tests)

테스트끼리 상태를 공유하여 **실행 순서에 따라 결과가 달라지는** 패턴.

### 왜 문제인가?
- 테스트 A가 공유 배열에 데이터를 추가 → 테스트 B에서 예상치 못한 데이터 존재
- **개별 실행 시 통과, 전체 실행 시 실패** (또는 반대)
- Jest의 `--runInBand` vs 병렬 실행에서 다른 결과
- 가장 디버깅하기 어려운 테스트 버그

### 해결
- `beforeEach`에서 모든 상태를 **매번 새로 생성**
- 공유 변수 대신 **로컬 변수** 사용
- Factory 함수로 독립된 테스트 데이터 생성

### 프로젝트 참조
- `test/auth/unit/auth.service.spec.ts:29-91` — `beforeEach`에서 모든 Mock을 새로 생성
- `test/fixtures/test-data.fixture.ts:213-218` — `resetTestDataCounters()`로 카운터 초기화
- `test/fixtures/mock-services.fixture.ts:243-248` — `clearAll()`로 Mock 상태 초기화

---

## 5. 거대한 테스트 (Giant Test)

하나의 테스트에서 **여러 시나리오를 한 번에 검증**하는 패턴.

### 왜 문제인가?
- 실패 시 **어떤 시나리오가 문제인지** 알 수 없음
- 테스트 이름이 "유저 전체 기능"처럼 포괄적 → 의도 파악 어려움
- 앞부분이 실패하면 뒷부분은 실행조차 안 됨

### 해결
- **1 테스트 = 1 시나리오** (AAA 패턴: Arrange-Act-Assert)
- 테스트 이름으로 시나리오를 명확히: `test_빈_이름으로_등록_시_에러`
- `describe`로 관련 시나리오를 그룹화

### 프로젝트 참조
- `test/user/unit/user-entity.spec.ts` — 각 `it()`이 하나의 시나리오만 검증
- 테스트 이름: "weeklyGoal 1 미만이면 에러", "register() 정상 생성" 등

---

## 6. 마법의 숫자/문자열 (Magic Values)

테스트 데이터가 **왜 이 값인지** 알 수 없는 패턴.

### 왜 문제인가?
- `new Order(42, [{price: 15000}], 0.1)` — 42는? 15000은 경계값? 0.1은?
- 6개월 후 돌아오면 이 값들의 **의도를 알 수 없음**
- 경계값 테스트에서 특히 위험: "왜 7인가? 8이면 어떻게 되는가?"

### 해결
- **의미 있는 상수명**: `TEN_PERCENT_DISCOUNT = 0.1`
- **Factory 함수**: 기본값을 제공하고 필요한 것만 오버라이드
- **계산식 노출**: `expectedTotal = (15000 + 8000) * 0.9`

### 프로젝트 참조
- `test/fixtures/test-data.fixture.ts:50-65` — `createTestUser()` Factory (기본값 + 오버라이드)
- `test/fixtures/test-data.fixture.ts:98-116` — `createTestAssessment()` Factory

---

## 7. 슬리핑 테스트 (Sleeping Test)

비동기 동작을 **고정 시간 대기**(`setTimeout`, `sleep`)로 검증하는 패턴.

### 왜 문제인가?
- 느린 환경(CI 서버)에서는 시간 부족 → **불안정한 실패**
- 빠른 환경에서는 불필요한 대기 → **테스트 스위트 전체가 느려짐**
- 100개 테스트 × 2초 대기 = **3분+** 낭비

### 해결

| 상황 | 방법 |
|------|------|
| 함수가 Promise 반환 | `await` 사용 — 즉시 완료 시 즉시 진행 |
| 상태 변화 대기 | 폴링 + 타임아웃 (`waitFor` 패턴) |
| 타이머 의존 코드 | Jest `fakeTimers` — 시간을 직접 제어 |
| 이벤트 기반 | 이벤트 리스너로 완료 감지 |

### 프로젝트 참조
- `test/assessment/integration/assessment-flow.test.ts` — 이벤트 기반 흐름 테스트

---

## 8. 검증 없는 테스트 (Missing Assertion)

코드를 **실행만 하고 결과를 확인하지 않는** 패턴.

### 왜 문제인가?
- "에러 없이 실행되면 통과" — 잘못된 결과여도 에러만 안 나면 통과
- **커버리지는 100%**인데 실제로 아무것도 검증하지 않음
- "false confidence" — 테스트가 있다는 **거짓 안심감**

### 해결
- **Given-When-Then** 구조로 모든 테스트를 작성
- **Then** 단계에서 반드시 `expect()`/`assert()` 호출
- Mock 사용 시 호출 여부도 검증: `toHaveBeenCalledWith()`

### 프로젝트 참조
- `test/user/unit/user-entity.spec.ts:11-26` — Given-When-Then 주석 + `expect()`
- `test/auth/unit/auth.service.spec.ts:118-120` — Mock 호출 여부까지 검증

---

## 좋은 테스트의 특성 (FIRST)

| 특성 | 의미 | 위반하는 안티패턴 |
|------|------|-----------------|
| **F**ast | 빠르게 실행 | 7. 슬리핑 테스트 |
| **I**ndependent | 다른 테스트와 독립 | 4. 테스트 간 커플링 |
| **R**epeatable | 어디서든 같은 결과 | 4, 7 |
| **S**elf-validating | 스스로 성공/실패 판단 | 8. 검증 없는 테스트 |
| **T**imely | 적시에 작성 (TDD) | - |

---

## 실제 프로젝트에서 찾아보기

| 안티패턴 | 올바른 구현 파일 | 핵심 패턴 |
|---------|-----------------|-----------|
| 구현 의존 | `user-entity.spec.ts` | 결과(상태)만 검증 |
| 깨지기 쉬운 | `user-entity.spec.ts:56` | `toThrow(타입)` |
| Mock 과다 | `auth.service.spec.ts:30-64` | 의존성만 Mock |
| 테스트 간 커플링 | `auth.service.spec.ts:29-91` | `beforeEach` 초기화 |
| 거대한 테스트 | `user-entity.spec.ts` | 1 `it()` = 1 시나리오 |
| 마법의 값 | `test-data.fixture.ts:50-65` | Factory 함수 |
| 슬리핑 테스트 | `assessment-flow.test.ts` | 이벤트/Promise 기반 |
| 검증 없는 | `auth.service.spec.ts:118-120` | Given-When-Then |

---

## 학습 후 체크리스트

- [ ] 테스트가 "어떻게"가 아닌 "무엇을"을 검증하고 있는가?
- [ ] 에러 메시지 전체가 아닌 예외 타입으로 검증하고 있는가?
- [ ] 테스트 대상은 실제 객체이고, 의존성만 Mock하고 있는가?
- [ ] 각 테스트가 독립적인 상태를 가지고 있는가? (`beforeEach`)
- [ ] 하나의 테스트가 하나의 시나리오만 검증하는가?
- [ ] 테스트 데이터의 의도가 변수명이나 Factory로 명확한가?
- [ ] `sleep()`/`setTimeout()` 대신 `await`/이벤트를 사용하는가?
- [ ] 모든 테스트에 명시적인 `assert`/`expect`가 있는가?
