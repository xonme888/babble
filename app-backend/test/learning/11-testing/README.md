# 11. Jest 테스트 (단위/통합/E2E)

## 왜 테스트를 작성하는가?

### 수동 테스트의 문제
- **느림**: Postman으로 API를 하나씩 호출 → 20개 API면 30분+
- **실수 가능**: "이 API는 확인했나?" 빠뜨리기 쉬움
- **반복 불가**: 매번 같은 순서로 같은 데이터를 넣어야 함
- **리팩토링 공포**: "코드 바꿨는데 다른 기능 깨진 건 아닐까?"

### 자동 테스트
```bash
npm test  # 2초만에 100개 테스트 자동 실행
# ✅ 62 passed, 0 failed
# 리팩토링 후 → npm test → 안심!
```

---

## 왜 테스트 피라미드인가?

```
         /  E2E  \        10% - 느리고 깨지기 쉬움
        / (실제 HTTP) \
       /──────────────\
      /  통합 테스트    \    20% - DB 포함, 중간 속도
     / (여러 클래스 연동) \
    /──────────────────\
   /    단위 테스트       \  70% - 빠르고 안정적
  / (한 클래스, Mock 사용)  \
 /──────────────────────────\
```

| 레벨 | 범위 | 속도 | 안정성 | 비율 |
|------|------|------|--------|------|
| Unit | 한 클래스/함수 | 매우 빠름 (1ms) | 매우 안정 | 70% |
| Integration | 여러 클래스 + DB | 보통 (100ms) | 보통 | 20% |
| E2E | 실제 HTTP 요청 | 느림 (1s+) | 깨지기 쉬움 | 10% |

---

## 왜 Jest인가?

| 기능 | Jest | Mocha | Vitest |
|------|------|-------|--------|
| TypeScript 지원 (ts-jest) | ✅ | △ | ✅ |
| 내장 Mock (jest.fn()) | ✅ | ❌ (sinon 필요) | ✅ |
| 커버리지 리포트 | ✅ 내장 | ❌ (istanbul 필요) | ✅ |
| 병렬 실행 | ✅ | ❌ | ✅ |

---

## Given-When-Then 구조

**왜?** 테스트 가독성. 누구나 "이 상황에서, 이렇게 하면, 이런 결과" 파악 가능.

```typescript
describe('User Entity', () => {
    it('주간 목표가 1 미만이면 ValidationException', () => {
        // Given: 사용자가 존재
        const user = createTestUser()

        // When & Then: 0으로 설정하면 에러
        expect(() => user.updateWeeklyGoal(0))
            .toThrow(ValidationException)
    })
})
```

---

## Mock이란?

**왜?** 단위 테스트에서 **DB/Redis 없이** 테스트하기 위해.

```typescript
// 실제 DB 없이 AuthService 테스트
const mockUserRepo = {
    findByEmail: jest.fn().mockResolvedValue(null),  // DB 조회 시뮬레이션
    save: jest.fn().mockResolvedValue({ id: 1 }),     // DB 저장 시뮬레이션
}

const mockRedis = {
    set: jest.fn(),           // Redis SET 시뮬레이션
    get: jest.fn(),           // Redis GET 시뮬레이션
}

// Mock을 주입하여 테스트
const authService = new AuthService(mockUserRepo, mockRedis, ...)
await authService.register("test@example.com", "Password1!")

// 검증: save가 호출되었는가?
expect(mockUserRepo.save).toHaveBeenCalledTimes(1)
```

---

## 프로젝트 테스트 구조

```
test/
├── utils/
│   ├── preload.js          # 테스트 환경 설정 (환경변수 로드)
│   └── e2e-helper.ts       # E2E 테스트 헬퍼
│
├── fixtures/               # 테스트 데이터/Mock
│   ├── auth.fixture.ts     # 인증 테스트 데이터
│   ├── database.fixture.ts # DB 설정
│   ├── mock-services.fixture.ts  # Mock 서비스
│   └── test-data.fixture.ts
│
├── auth/
│   ├── unit/
│   │   └── auth.service.spec.ts    # AuthService 단위 테스트
│   └── e2e/
│       └── auth.e2e-spec.ts        # 인증 E2E 테스트
│
├── user/
│   ├── unit/
│   │   ├── user-entity.spec.ts     # User 엔티티 단위 테스트
│   │   └── user.service.spec.ts    # UserService 단위 테스트
│   └── integration/
│       └── user-flow.test.ts       # 사용자 흐름 통합 테스트
│
├── assessment/
│   ├── unit/
│   │   └── assessment-entity.spec.ts  # Assessment 엔티티 단위 테스트
│   ├── integration/
│   │   └── assessment-flow.test.ts    # 평가 흐름 통합 테스트
│   └── e2e/
│       └── assessment.e2e-spec.ts     # 평가 E2E 테스트
```

---

## 테스트 실행 방법

```bash
# 전체 테스트
npm test

# 단위 테스트만
npm run test:unit

# 통합 테스트만
npm run test:int

# E2E 테스트만
npm run test:e2e

# 커버리지 리포트
npm run test:coverage
```

---

## 실제 프로젝트에서 찾아보기

| 개념 | 파일 경로 |
|------|----------|
| Jest 설정 | `jest.config.js` |
| 테스트 환경 설정 | `test/utils/preload.js` |
| E2E 헬퍼 | `test/utils/e2e-helper.ts` |
| Mock 서비스 | `test/fixtures/mock-services.fixture.ts` |
| User 엔티티 단위 테스트 | `test/user/unit/user-entity.spec.ts` |
| AuthService 단위 테스트 | `test/auth/unit/auth.service.spec.ts` |
| Assessment 엔티티 단위 테스트 | `test/assessment/unit/assessment-entity.spec.ts` |
| 인증 E2E 테스트 | `test/auth/e2e/auth.e2e-spec.ts` |
