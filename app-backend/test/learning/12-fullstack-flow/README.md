# 12. 전체 흐름 End-to-End 추적

이전 단계에서 각 기술을 개별로 배웠습니다. 이제 **모든 것이 어떻게 연결되는지** 추적합니다.

---

## 흐름 1: 회원가입 → 이메일 인증

### 시퀀스 다이어그램

```
Client (Mobile App)
  │
  │  POST /api/v1/auth/register
  │  { email, password, firstName }
  │
  ▼
[auth.routes.ts]  ─── rateLimitMiddleware('registration')
  │                      └── Redis INCR ratelimit:registration:{ip}
  │                      └── 10분에 3회 초과 시 429 응답
  │
  ├── validateDto(RegisterDto)
  │      └── plainToInstance(RegisterDto, req.body)
  │      └── @IsEmail, @MinLength(8) 검증
  │      └── 실패 시 ValidationException → globalErrorHandler → 400 응답
  │
  ▼
[AuthController.register]
  │  req.body에서 email, password, firstName 추출
  │
  ▼
[AuthService.register]  ← DI로 주입된 의존성들
  │
  ├── [1] saveUserInTransaction()  ← @Transactional() 데코레이터
  │     ├── userRepo.findByEmail(email)  ← TypeORM SELECT
  │     ├── Email.create(email)          ← Value Object 유효성 검증
  │     ├── Password.create(password)    ← Value Object 규칙 검증 + bcrypt 해싱
  │     ├── User.register(emailVO, passwordVO, firstName)  ← Factory Method
  │     └── userRepo.save(user)          ← TypeORM INSERT
  │         └── UNIQUE constraint 충돌 시 ConflictException
  │
  ├── [2] Redis에 인증 코드 저장
  │     └── redis.set("verify:{email}", "123456", 600)  ← TTL 10분
  │
  ├── [3] NotificationService.send()
  │     ├── NotificationLog 생성 (DB 저장, status: PENDING)
  │     ├── QueueCrypto.encrypt(to, subject, content)  ← 민감 데이터 암호화
  │     └── emailQueue.add("email-queue", { encrypted data, logId })
  │         └── BullMQ → Redis에 Job 등록
  │
  └── [4] Domain Event 발행
        ├── user.emitRegisteredEvent()  ← 이벤트 축적
        └── eventDispatcher.publishFromAggregate(user)  ← 비동기 발행
            └── UserRegisteredEventHandler.handle()  ← 로깅
```

### 백그라운드 (Worker 프로세스)

```
[worker.ts]  ← 별도 프로세스

[EmailWorker]  ← BullMQ Worker
  │  emailQueue에서 Job 수신
  │
  ├── QueueCrypto.decrypt(to, subject, content)  ← 복호화
  ├── INotificationProvider.send(to, subject, content)
  │     ├── 개발: NodemailerMailProvider → SMTP
  │     └── 운영: SendGridMailProvider → SendGrid API
  │
  ├── 성공 시:
  │     └── NotificationLog 업데이트 (status: SENT, sentAt: now)
  │
  └── 실패 시:
        ├── NotificationLog 업데이트 (status: FAILED, errorMessage)
        ├── Fatal 에러 (잘못된 인증): 재시도 중단
        └── 일시적 에러 (네트워크): BullMQ 자동 재시도
```

### 관련 파일

| 단계 | 파일 경로 |
|------|----------|
| 라우트 | `src/features/auth/auth.routes.ts:29` |
| Rate Limit | `src/shared/core/rate-limit.service.ts` |
| DTO 검증 | `src/features/auth/dtos/auth.dto.ts:22-38` |
| validateDto 미들웨어 | `src/shared/presentation/middlewares/validation.middleware.ts` |
| AuthController | `src/features/auth/auth.controller.ts` |
| AuthService.register | `src/features/auth/auth.service.ts:45-68` |
| @Transactional | `src/features/auth/auth.service.ts:75` |
| Email Value Object | `src/features/user/domain/value-objects/email.vo.ts` |
| Password Value Object | `src/features/user/domain/value-objects/password.vo.ts` |
| User.register (Factory) | `src/features/user/domain/user.entity.ts:82` |
| Redis 인증코드 저장 | `src/features/auth/auth.service.ts:56` |
| NotificationService | `src/features/notification/application/notification.service.ts` |
| QueueCrypto | `src/shared/utils/queue-crypto.utils.ts` |
| Email Queue 정의 | `src/shared/infra/queue/email.queue.ts` |
| Email Worker | `src/features/notification/worker/email.worker.ts` |
| UserRegisteredEventHandler | `src/features/user/handlers/user-registered-event.handler.ts` |
| globalErrorHandler | `src/shared/presentation/middlewares/error.handler.ts` |

---

## 흐름 2: 평가 생성 → AI 분석 완료

### 시퀀스 다이어그램

```
Client (Mobile App)
  │
  │  POST /api/v1/assessments
  │  Content-Type: multipart/form-data
  │  { audioFile, scriptId, duration }
  │  Authorization: Bearer {accessToken}
  │
  ▼
[assessment.routes.ts]
  │
  ├── authGuard
  │     ├── Authorization 헤더에서 토큰 추출
  │     ├── Redis에서 블랙리스트 확인
  │     ├── jwt.verify(token, secret)
  │     └── req.user = { id: userId }
  │
  ├── multer (파일 업로드)
  │     └── 오디오 파일 → /uploads/{filename}
  │
  ▼
[AssessmentController.createAssessment]
  │
  ▼
[AssessmentService.createAssessment]
  │
  ├── Assessment.create(userId, audioUrl, duration, scriptId)  ← Factory Method
  │     └── status: PENDING
  │
  ├── assessmentRepo.save(assessment)  ← TypeORM INSERT
  │
  ├── assessment.emitCreatedEvent()  ← 이벤트 축적
  │
  └── eventDispatcher.publishFromAggregate(assessment)  ← 비동기 발행
        │
        ▼
      [AssessmentCreatedEventHandler.handle]
        │
        ├── assessment.startAnalysis()  ← 상태: PENDING → ANALYZING
        │     └── retryCount++
        │
        ├── assessmentRepo.save(assessment)  ← DB 업데이트
        │
        └── analysisService.analyzeAssessment(assessmentId)
              │
              └── assessmentAnalysisQueue.add("analysis", { assessmentId, audioUrl, ... })
                    └── BullMQ → Redis에 Job 등록
```

### 백그라운드 (Worker 프로세스)

```
[AnalysisWorker]  ← BullMQ Worker (concurrency: 2)
  │
  ├── assessment 조회 → startAnalysis()
  │
  └── Redis RPUSH "ai:tasks" { assessmentId, audioUrl, script }
        └── Python AI 서비스가 이 리스트를 polling
```

### Python AI 서비스 (외부)

```
[Python AI Service]
  │
  ├── Redis BLPOP "ai:tasks"  ← 작업 수신
  │
  ├── 오디오 분석 (발음 평가)
  │     ├── Transcription (음성 → 텍스트)
  │     ├── Pronunciation Score (0~100)
  │     ├── Pitch Analysis
  │     └── Speaking Rate
  │
  └── Redis RPUSH "ai:results:completed" { assessmentId, score, ... }
        └── 결과 큐에 추가 (소비자가 꺼낼 때까지 보관)
```

### 결과 수신 (Worker 프로세스)

```
[AnalysisResultSubscriber]  ← Redis BLPOP 결과 큐
  │  키: "ai:results:completed"
  │
  ├── 메시지 수신 → JSON 파싱
  │
  ├── assessment 조회
  │
  ├── 성공 시:
  │     ├── assessment.completeAnalysis({ score, transcribedText, feedback, ... })
  │     │     └── 상태: ANALYZING → COMPLETED
  │     ├── AssessmentAnalysisLog 생성 (status: SUCCESS)
  │     └── DB 트랜잭션으로 원자적 저장
  │
  ├── 실패 시:
  │     ├── assessment.failAnalysis(errorMessage)
  │     │     ├── retryCount < 3 → 상태: FAILED (재시도 가능)
  │     │     └── retryCount >= 3 → 상태: MAX_RETRY_EXCEEDED
  │     └── AssessmentAnalysisLog 생성 (status: FAIL)
  │
  └── eventDispatcher.dispatchAll(assessment.getDomainEvents())
        ├── AssessmentCompletedEventHandler → 알림
        └── AssessmentFailedEventHandler → 에러 처리
```

### 관련 파일

| 단계 | 파일 경로 |
|------|----------|
| 라우트 | `src/features/assessment/assessment.routes.ts` |
| authGuard | `src/features/auth/presentation/guards/auth.guard.ts` |
| AssessmentController | `src/features/assessment/assessment.controller.ts` |
| AssessmentService | `src/features/assessment/assessment.service.ts` |
| Assessment.create (Factory) | `src/features/assessment/domain/assessment.entity.ts:124` |
| 상태 전이 (startAnalysis) | `src/features/assessment/domain/assessment.entity.ts:163` |
| 상태 전이 (completeAnalysis) | `src/features/assessment/domain/assessment.entity.ts:195` |
| AssessmentCreatedEventHandler | `src/features/assessment/handlers/assessment-created.handler.ts` |
| AssessmentAnalysisService | `src/features/assessment/handlers/assessment-analysis.service.ts` |
| Analysis Queue | `src/shared/infra/queue/analysis.queue.ts` |
| Analysis Worker | `src/features/assessment/worker/analysis.worker.ts` |
| Analysis Result Subscriber | `src/features/assessment/worker/analysis-result.subscriber.ts` |
| AssessmentCompletedEventHandler | `src/features/assessment/handlers/assessment-completed.handler.ts` |
| StuckAssessmentCleaner | `src/features/assessment/cron/stuck-assessment-cleaner.ts` |

---

## 흐름 3: 로그인 → 토큰 갱신 → 로그아웃

### 로그인

```
Client
  │  POST /api/v1/auth/login
  │  { email, password, strategy: "email" }
  │
  ▼
[auth.routes.ts] → rateLimitMiddleware('login-attempt') → validateDto(LoginDto)
  │
  ▼
[AuthService.login]
  │
  ├── loginStrategyFactory.getStrategy("email")  ← Strategy 패턴
  │     └── EmailLoginStrategy.login({ email, password })
  │           ├── userRepo.findByEmail(email)  ← SELECT with password
  │           ├── user.canLogin()  ← 도메인 규칙: isActive && isVerified
  │           ├── user.validatePassword(password)  ← bcrypt.compare()
  │           └── return user
  │
  ├── tokenProvider.generateAccessToken(userId)   ← JWT 서명 (15분)
  ├── tokenProvider.generateRefreshToken(userId)  ← JWT 서명 (7일, 별도 시크릿)
  │
  ├── redis.set("refresh:{userId}", refreshToken, 7일)  ← Refresh Token 저장
  │
  ├── user.emitLoggedInEvent("email")
  └── eventDispatcher.publishFromAggregate(user)
        └── UserLoggedInEventHandler → 로깅

응답:
  Body: { accessToken }
  Cookie: refreshToken (HttpOnly, Secure, SameSite)
```

### 토큰 갱신

```
Client
  │  POST /api/v1/auth/refresh
  │  Cookie: refreshToken=...
  │
  ▼
[AuthService.refreshToken]
  │
  ├── tokenProvider.verifyToken(token, 'refresh')  ← Refresh 시크릿으로 검증
  │
  ├── redis.get("refresh:{userId}")  ← 저장된 토큰과 비교
  │     └── 불일치 시 TOKEN_REVOKED (다른 기기에서 갱신됨)
  │
  ├── 새 Access Token + 새 Refresh Token 생성 (Token Rotation)
  │
  └── redis.set("refresh:{userId}", newRefreshToken)  ← 이전 토큰 무효화

응답:
  Body: { accessToken: 새 토큰 }
  Cookie: refreshToken=새 토큰
```

### 로그아웃

```
Client
  │  POST /api/v1/auth/logout
  │  Authorization: Bearer {accessToken}
  │
  ▼
[AuthService.logout]
  │
  ├── tokenProvider.verifyToken(accessToken)  ← userId 추출
  │
  ├── redis.del("refresh:{userId}")  ← Refresh Token 삭제
  │
  └── redis.set("blacklist:{accessToken}", "1", remainingTTL)
        └── Access Token 만료까지만 블랙리스트 유지

이후 요청 시:
  authGuard → redis.exists("blacklist:{token}") → true → 401 Unauthorized
```

### 관련 파일

| 단계 | 파일 경로 |
|------|----------|
| AuthService.login | `src/features/auth/auth.service.ts:172-192` |
| Strategy 인터페이스 | `src/features/auth/strategies/login-strategy.interface.ts` |
| EmailLoginStrategy | `src/features/auth/strategies/email-login.strategy.ts` |
| LoginStrategyFactory | `src/features/auth/strategies/login-strategy.factory.ts` |
| JwtTokenProvider | `src/features/auth/infrastructure/crypto/jwt-token-provider.ts` |
| AuthService.refreshToken | `src/features/auth/auth.service.ts:245-266` |
| AuthService.logout | `src/features/auth/auth.service.ts:271-286` |
| authGuard (블랙리스트 체크) | `src/features/auth/presentation/guards/auth.guard.ts:27-37` |

---

## 전체 아키텍처 요약

```
                         ┌─────────────────────────────────┐
                         │         Express API Server       │
                         │                                   │
  Client ──── HTTP ────▶ │  [Middleware Pipeline]            │
                         │    helmet → cors → json →         │
                         │    cookieParser → pinoHttp →      │
                         │    authGuard → validateDto →      │
                         │    Controller → Service →         │
                         │    Domain Entity → Repository     │
                         │    → EventDispatcher              │
                         │    → globalErrorHandler           │
                         │                                   │
                         └──────┬────────────┬──────────────┘
                                │            │
                      TypeORM   │            │  ioredis
                                │            │
                         ┌──────▼──┐   ┌─────▼──────┐
                         │PostgreSQL│   │   Redis     │
                         │ (영속성) │   │ (캐시/큐)  │
                         └─────────┘   └──────┬──────┘
                                              │
                                    BullMQ    │  Pub/Sub
                                              │
                         ┌────────────────────▼──────────────┐
                         │         Worker Process             │
                         │                                    │
                         │  EmailWorker ← emailQueue          │
                         │  AnalysisWorker ← analysisQueue    │
                         │  AnalysisResultSubscriber ← PubSub │
                         │  StuckAssessmentCleaner ← Cron     │
                         │                                    │
                         └────────────────────────────────────┘
```
