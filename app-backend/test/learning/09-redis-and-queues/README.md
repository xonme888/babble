# 09. Redis 캐시/큐 + BullMQ 백그라운드 작업

## 왜 Redis인가?

Redis는 **인메모리 데이터베이스**입니다. 모든 데이터를 RAM에 저장하여 초고속입니다.

이 프로젝트에서 Redis를 **5가지 용도**로 사용합니다:

| 용도 | 키 패턴 | 왜? | 없으면? |
|------|---------|-----|--------|
| 인증 코드 | `verify:{email}` | TTL로 자동 만료 (10분) | DB에 저장 + 크론으로 만료 관리 필요 |
| Token Blacklist | `blacklist:{token}` | 빠른 조회 (O(1)) | JWT 로그아웃 무효화 불가 |
| Rate Limiting | `ratelimit:{action}:{ip}` | 원자적 INCR + TTL | 무차별 대입 공격 방어 불가 |
| Job Queue (BullMQ) | `bull:email-queue:*` | 안정적인 작업 큐 | 이메일/분석이 HTTP 응답을 5초+ 지연 |
| 결과 큐 | `ai:results:completed` | RPUSH/BLPOP 기반 안정적 메시징 | AI 결과 수신을 위한 폴링 필요 |

---

## 왜 BullMQ인가?

BullMQ는 Redis 기반 **Job Queue** 라이브러리입니다.

**직접 구현하면?** 재시도, 동시성 제한, 실패 관리, 지연 실행을 수백 줄로 직접 구현해야 합니다.

BullMQ가 제공하는 기능:
- **자동 재시도**: 실패 시 3회까지 재시도 (backoff 설정 가능)
- **동시성 제한**: `concurrency: 2` → 동시에 2개만 처리
- **Job 상태 관리**: waiting → active → completed/failed
- **Dead Letter Queue**: 영구 실패한 작업 별도 관리
- **Bull Board**: 웹 UI로 큐 상태 모니터링

---

## 왜 Worker를 별도 프로세스로 분리하는가?

```
// ❌ API 서버에서 직접 처리
POST /register → 사용자 저장 → 이메일 발송(5초) → 응답(5초 후)
// 사용자가 5초 기다려야 함!

// ✅ Worker 분리
POST /register → 사용자 저장 → 큐에 작업 등록 → 즉시 응답(0.1초)
[Worker] 큐에서 작업 꺼내 → 이메일 발송(5초) → 완료
// 사용자는 즉시 응답 받음!
```

이 프로젝트: `src/worker.ts`가 별도 프로세스로 실행됩니다.
```bash
# API 서버
npm run dev          # src/index.ts

# Worker (별도 터미널)
npm run worker:email  # src/worker.ts
```

---

## 왜 QueueCrypto인가?

Redis에 이메일/비밀번호가 **평문 저장**되면 보안 위험입니다.

```typescript
// ❌ 평문 저장
await emailQueue.add("email-queue", {
    to: "user@example.com",    // Redis에 평문으로 저장됨!
    content: "인증 코드: 123456"
})

// ✅ 암호화 후 저장
await emailQueue.add("email-queue", {
    to: QueueCrypto.encrypt("user@example.com"),
    content: QueueCrypto.encrypt("인증 코드: 123456"),
    encrypted: true
})
```

Worker가 작업을 처리할 때 복호화합니다:
```typescript
const to = encrypted ? QueueCrypto.decrypt(rawTo) : rawTo
```

---

## 왜 DB 0과 DB 1을 분리하는가?

Redis는 논리적으로 **16개의 DB(0~15)**를 제공합니다.

| DB | 용도 | 왜 분리? |
|----|------|---------|
| DB 0 | 캐시 (인증 코드, Token, Rate Limit) | 캐시 flush 시 큐 데이터 보호 |
| DB 1 | AI 분석 큐 (BullMQ) | 큐 데이터는 작업이 완료될 때까지 보존 필수 |

```typescript
// src/features/assessment/worker/analysis.worker.ts:75
connection: {
    host: config.redis.host,
    port: config.redis.port,
    db: 1  // AI 분석 큐는 DB 1 사용
}
```

---

## 왜 Graceful Shutdown인가?

Worker가 작업 **처리 중** 강제 종료되면 작업이 유실됩니다.

```typescript
// src/worker.ts:37-44
process.on('SIGTERM', async () => {
    logger.info('SIGTERM: closing queues')
    clearInterval(cleanerInterval)
    await emailWorker.close()      // 현재 작업 완료 대기
    await analysisWorker.close()   // 현재 작업 완료 대기
    await resultSubscriber.close() // 구독 해제
    process.exit(0)
})
```

---

## 실제 프로젝트에서 찾아보기

| 개념 | 파일 경로 |
|------|----------|
| Redis 서비스 | `src/shared/infra/persistence/redis/redis-service.ts` |
| Redis 인터페이스 | `src/shared/infra/persistence/redis/redis-service.interface.ts` |
| 이메일 큐 정의 | `src/shared/infra/queue/email.queue.ts` |
| 분석 큐 정의 | `src/shared/infra/queue/analysis.queue.ts` |
| 이메일 Worker | `src/features/notification/worker/email.worker.ts` |
| 분석 Worker | `src/features/assessment/worker/analysis.worker.ts` |
| AI 결과 Subscriber | `src/features/assessment/worker/analysis-result.subscriber.ts` |
| NotificationService (큐 등록) | `src/features/notification/application/notification.service.ts` |
| QueueCrypto | `src/shared/utils/queue-crypto.utils.ts` |
| Worker 진입점 | `src/worker.ts` |
| Graceful Shutdown | `src/worker.ts:37-44` |
| Rate Limiting (Redis) | `src/shared/core/rate-limit.service.ts` |
| 인증 코드 저장 (Redis) | `src/features/auth/auth.service.ts:56` |
| Token Blacklist (Redis) | `src/features/auth/auth.service.ts:284` |
