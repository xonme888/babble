# 10. 도메인 이벤트 기반 아키텍처

## 왜 이벤트 기반인가?

### 문제: 직접 의존 (강결합)

"회원가입 시 환영 이메일 보내기"를 `AuthService`에 직접 넣으면:

```typescript
// ❌ 강결합
class AuthService {
    constructor(
        private emailService: EmailService,       // 직접 의존
        private analyticsService: AnalyticsService, // 직접 의존
        private slackService: SlackService          // 직접 의존
    ) {}

    async register(...) {
        await this.userRepo.save(user)
        await this.emailService.sendWelcome(user)        // 부수효과 1
        await this.analyticsService.track("signup", user) // 부수효과 2
        await this.slackService.notify("새 가입자!")       // 부수효과 3
        // 새 요구사항 추가 시 → AuthService 수정 필요!
    }
}
```

### 해결: 이벤트 (느슨한 결합)

```typescript
// ✅ 이벤트 기반
class AuthService {
    async register(...) {
        await this.userRepo.save(user)
        user.emitRegisteredEvent()  // 이벤트만 발행
        this.eventDispatcher.publishFromAggregate(user)
        // AuthService는 "무엇이 일어나야 하는지" 모름
    }
}

// 각 핸들러가 독립적으로 처리
class WelcomeEmailHandler { handle(event) { /* 이메일 발송 */ } }
class AnalyticsHandler { handle(event) { /* 분석 추적 */ } }
class SlackNotifyHandler { handle(event) { /* 슬랙 알림 */ } }
// 새 요구사항? 핸들러만 추가. AuthService 수정 불필요!
```

---

## 동기 dispatch vs 비동기 dispatchAsync

| | dispatch (동기) | dispatchAsync (비동기) |
|---|---|---|
| 핸들러 완료 대기 | ✅ 대기 | ❌ 즉시 반환 |
| 사용 시점 | 데이터 일관성 필요 시 | 부수효과 (이메일, 알림) |
| 에러 전파 | 호출자에게 전파 가능 | 호출자에게 전파 안 됨 |

```typescript
// src/shared/lib/events/event-dispatcher.ts
// 동기: 모든 핸들러 완료까지 대기
async dispatch(event: DomainEvent): Promise<void> {
    for (const handler of handlers) {
        await handler.handle(event)  // await → 완료 대기
    }
}

// 비동기: 즉시 반환, 백그라운드 실행
dispatchAsync(event: DomainEvent): void {
    setImmediate(async () => {
        for (const handler of handlers) {
            await handler.handle(event)  // 백그라운드에서 실행
        }
    })
}
```

---

## 왜 publishFromAggregate인가?

Entity 내부에 이벤트를 **축적**하고, DB 저장 **후** 한꺼번에 발행합니다.

```typescript
// 1. 도메인 로직 실행 → 이벤트 축적 (아직 발행 안 됨)
user.verifyEmail()  // → EmailVerifiedEvent 축적
                    //   (내부: this.domainEvents.push(new EmailVerifiedEvent(...)))

// 2. DB 저장
await this.userRepository.save(user)

// 3. DB 저장 성공 후 이벤트 발행
this.eventDispatcher.publishFromAggregate(user)
// → 축적된 모든 이벤트를 비동기 발행
// → 이벤트 목록 초기화
```

**왜 이 순서인가?** DB 저장이 **실패**하면 이벤트도 발행되지 않아야 합니다 (일관성).

---

## 실제 이벤트 흐름

### 흐름 1: UserRegistered
```
AuthService.register()
  → User.register() (Factory Method)
  → userRepo.save(user) (DB 저장)
  → user.emitRegisteredEvent() (이벤트 축적)
  → eventDispatcher.publishFromAggregate(user) (비동기 발행)
    → UserRegisteredEventHandler.handle() (로깅)
```

### 흐름 2: AssessmentCreated → AI 분석
```
AssessmentService.createAssessment()
  → Assessment.create() (Factory Method)
  → assessmentRepo.save(assessment)
  → assessment.emitCreatedEvent()
  → eventDispatcher.publishFromAggregate(assessment)
    → AssessmentCreatedEventHandler.handle()
      → assessment.startAnalysis() (상태: ANALYZING)
      → analysisService.analyzeAssessment() (BullMQ 큐 등록)
```

### 흐름 3: AssessmentCompleted
```
[Worker] AnalysisResultSubscriber
  → assessment.completeAnalysis(result) (상태: COMPLETED)
  → DB 저장
  → eventDispatcher.dispatchAll(assessment.getDomainEvents())
    → AssessmentCompletedEventHandler.handle() (알림)
```

---

## 실제 프로젝트에서 찾아보기

| 개념 | 파일 경로 |
|------|----------|
| DomainEvent 인터페이스 | `src/shared/core/domain-event.ts` |
| EventHandler 인터페이스 | `src/shared/lib/events/event-handler.interface.ts` |
| EventDispatcher 구현 | `src/shared/lib/events/event-dispatcher.ts` |
| 이벤트 축적 (User) | `src/features/user/domain/user.entity.ts:213` |
| 이벤트 축적 (Assessment) | `src/features/assessment/domain/assessment.entity.ts:115` |
| publishFromAggregate | `src/shared/lib/events/event-dispatcher.ts:110` |
| UserRegisteredEventHandler | `src/features/user/handlers/user-registered-event.handler.ts` |
| AssessmentCreatedEventHandler | `src/features/assessment/handlers/assessment-created.handler.ts` |
| AssessmentCompletedEventHandler | `src/features/assessment/handlers/assessment-completed.handler.ts` |
| 핸들러 등록 (DI) | `src/shared/infra/di/diconfig.ts:125-141` |
