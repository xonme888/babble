# 00. 프로젝트 전체 구조 파악

## 이 프로젝트는 무엇인가?

**음성 발음 평가 서비스 (Speech Assessment Service)**

사용자가 대본을 읽고 녹음하면, AI가 발음을 분석하여 점수와 피드백을 제공하는 서비스의 **백엔드 API 서버**입니다.

```
┌──────────┐     ┌──────────────┐     ┌────────────┐     ┌──────────────┐
│  Client  │────▶│  Express API │────▶│ PostgreSQL │     │  AI Service  │
│ (Mobile) │◀────│  (이 프로젝트) │◀────│   (DB)     │     │  (Python)    │
└──────────┘     └──────┬───────┘     └────────────┘     └──────┬───────┘
                        │                                        │
                        │         ┌──────────┐                   │
                        └────────▶│  Redis   │◀──────────────────┘
                                  │(캐시/큐) │
                                  └──────────┘
```

### 핵심 흐름
1. 사용자가 대본을 선택하고 음성을 녹음하여 업로드
2. 백엔드가 녹음 파일을 저장하고, AI 분석 작업을 큐에 등록
3. Worker가 큐에서 작업을 꺼내 Python AI 서비스에 전달
4. AI가 발음을 분석하여 결과를 Redis Pub/Sub으로 전달
5. Worker가 결과를 받아 DB에 저장하고 사용자에게 알림

---

## 기술 스택 표

### 핵심 라이브러리

| 라이브러리 | 무엇인지 | 왜 사용하는지 | 사용 안 하면? | 대안 |
|-----------|---------|-------------|-------------|------|
| `express` 5 | Node.js 웹 프레임워크 | HTTP 라우팅, 미들웨어 파이프라인 | 순수 http 모듈로 모든 것을 직접 구현해야 함 | Fastify, Koa |
| `typescript` 5.9 | JavaScript + 정적 타입 | 컴파일 타임 에러 감지, IDE 자동완성, 리팩토링 안전성 | 런타임까지 가야 타입 에러 발견 | - |
| `typeorm` 0.3 | ORM (Object-Relational Mapper) | TypeScript 클래스로 DB 테이블 정의. SQL 직접 작성 불필요 | SQL injection 위험, DB 변경 시 전체 쿼리 수정 | Prisma, Sequelize |
| `tsyringe` | DI (Dependency Injection) 컨테이너 | 클래스 간 결합도 제거. 테스트 시 Mock 교체 가능 | 모든 의존성을 `new`로 직접 생성. 테스트 매우 어려움 | inversify, typedi |
| `bullmq` | Redis 기반 Job Queue | 재시도, 지연, 동시성 제한 내장. 백그라운드 작업 관리 | 이메일 발송/AI 분석이 HTTP 응답을 5초+ 지연 | agenda, bee-queue |
| `ioredis` | Redis 클라이언트 | 인메모리 DB로 캐시, 큐, Pub/Sub, Rate Limiting 처리 | 세션/캐시를 모두 DB에 저장 (느림) | redis, node-redis |
| `jsonwebtoken` | JWT 토큰 생성/검증 | 무상태(Stateless) 인증. 서버 확장(Scale-out)에 유리 | 세션 기반 인증 → 서버 증설 시 세션 공유 문제 | jose, passport-jwt |
| `bcryptjs` | 비밀번호 해싱 | 느린 해시로 무차별 대입 공격 방어 | 비밀번호 평문 저장 → DB 유출 시 모든 계정 노출 | argon2, scrypt |

### 검증/직렬화

| 라이브러리 | 무엇인지 | 왜 사용하는지 | 사용 안 하면? | 대안 |
|-----------|---------|-------------|-------------|------|
| `class-validator` | 데코레이터 기반 유효성 검사 | `@IsEmail()` 한 줄로 검증. if문 수십 줄 불필요 | 모든 필드를 if/else로 직접 검증 (코드 폭증) | zod, joi |
| `class-transformer` | JSON ↔ 클래스 인스턴스 변환 | 데코레이터가 동작하려면 인스턴스 변환 필수 | class-validator 데코레이터 미동작 | - |
| `reflect-metadata` | 런타임 메타데이터 리플렉션 | 데코레이터가 붙인 메타데이터를 런타임에 읽기 | tsyringe, TypeORM 데코레이터 모두 동작 안 함 | - |

### HTTP/보안

| 라이브러리 | 무엇인지 | 왜 사용하는지 | 사용 안 하면? | 대안 |
|-----------|---------|-------------|-------------|------|
| `helmet` | HTTP 보안 헤더 자동 설정 | XSS, Clickjacking 등 웹 공격 방지 | 보안 헤더 없이 노출. 브라우저 보안 기능 미동작 | 직접 헤더 설정 |
| `cors` | Cross-Origin Resource Sharing | 프론트엔드-백엔드 도메인이 다를 때 요청 허용 | 브라우저가 API 요청 차단 (Same-Origin Policy) | 직접 헤더 설정 |
| `cookie-parser` | HTTP 쿠키 파싱 | Refresh Token을 HttpOnly 쿠키로 전달하므로 파싱 필요 | req.cookies가 undefined | - |
| `multer` 2 | multipart/form-data 파일 업로드 | 오디오 녹음 파일 업로드 처리 | 파일 업로드 직접 파싱 (매우 복잡) | busboy, formidable |

### 로깅/모니터링

| 라이브러리 | 무엇인지 | 왜 사용하는지 | 사용 안 하면? | 대안 |
|-----------|---------|-------------|-------------|------|
| `pino` | 구조화 JSON 로깅 | JSON 형태 로그 → Loki/ELK에서 검색 가능 | console.log → 운영 시 로그 추적 불가 | winston |
| `pino-http` | Express HTTP 요청 자동 로깅 | 모든 요청/응답을 자동으로 구조화 로깅 | 디버깅 시 어떤 요청이 왔는지 모름 | morgan |
| `prom-client` | Prometheus 메트릭 수집 | CPU, 메모리, 요청 수 등 모니터링 | 서버 상태 파악 불가. 장애 감지 지연 | - |

### 국제화/알림

| 라이브러리 | 무엇인지 | 왜 사용하는지 | 사용 안 하면? | 대안 |
|-----------|---------|-------------|-------------|------|
| `i18next` | 국제화 (i18n) 프레임워크 | 한국어/영어 에러 메시지 자동 번역 | 모든 메시지를 하드코딩 (다국어 불가) | - |
| `@sendgrid/mail` | SendGrid 이메일 API | 대량 이메일 발송 (운영 환경) | 직접 SMTP 서버 구축 필요 | nodemailer |
| `nodemailer` | SMTP 이메일 발송 | 개발 환경에서 이메일 테스트 | SendGrid 없이 이메일 발송 불가 | - |

### 개발 도구

| 라이브러리 | 무엇인지 | 왜 사용하는지 | 사용 안 하면? | 대안 |
|-----------|---------|-------------|-------------|------|
| `jest` 30 | 테스트 프레임워크 | 내장 Mock, 커버리지, 병렬 실행 | 수동 테스트만 가능. 리팩토링 시 기존 기능 깨짐 감지 불가 | vitest, mocha |
| `supertest` | HTTP 통합 테스트 | 실제 HTTP 요청 시뮬레이션 (E2E 테스트) | 브라우저 없이 API 테스트 불가 | - |
| `ts-jest` | Jest + TypeScript | TypeScript 파일을 Jest에서 직접 실행 | .ts 파일을 매번 컴파일 후 테스트 | - |
| `swagger-jsdoc/ui` | API 문서 자동 생성 | JSDoc 주석 → Swagger UI 자동 변환 | API 문서 수동 작성/관리 | - |

---

## src/ 폴더 구조

```
src/
├── index.ts                          # 앱 진입점 (bootstrap)
├── app.ts                            # Express 앱 설정 (미들웨어, 라우터)
├── worker.ts                         # 백그라운드 워커 (이메일, AI 분석)
│
├── features/                         # 기능별 모듈 (Feature-based)
│   ├── auth/                         # 인증 기능
│   │   ├── auth.routes.ts            # 라우터 정의
│   │   ├── auth.controller.ts        # 요청 처리 (HTTP ↔ Service)
│   │   ├── auth.service.ts           # 비즈니스 유스케이스
│   │   ├── dtos/                     # 요청 DTO (유효성 검사)
│   │   ├── infrastructure/crypto/    # JWT, bcrypt 구현체
│   │   ├── presentation/guards/      # authGuard, adminGuard 미들웨어
│   │   └── strategies/               # 로그인 전략 패턴
│   │
│   ├── user/                         # 사용자 관리
│   │   ├── domain/                   # 도메인 레이어
│   │   │   ├── user.entity.ts        # User Aggregate Root
│   │   │   ├── value-objects/        # Email VO, Password VO
│   │   │   └── events/               # UserRegistered, EmailVerified 등
│   │   ├── handlers/                 # 이벤트 핸들러
│   │   ├── user.service.ts           # Application Service
│   │   └── user.repository.ts        # DB 접근
│   │
│   ├── assessment/                   # 음성 평가
│   │   ├── domain/                   # Assessment Entity + Events
│   │   ├── handlers/                 # 이벤트 핸들러 + 분석 서비스
│   │   ├── worker/                   # BullMQ Worker + Redis Subscriber
│   │   ├── infrastructure/ai/        # AI 서비스 클라이언트
│   │   └── cron/                     # 멈춘 작업 정리 크론
│   │
│   ├── notification/                 # 알림 (이메일)
│   │   ├── application/              # NotificationService
│   │   ├── domain/                   # NotificationLog Entity
│   │   ├── infrastructure/mail/      # SendGrid, Nodemailer 구현체
│   │   └── worker/                   # 이메일 발송 Worker
│   │
│   └── script/                       # 대본 관리
│       ├── domain/                   # Script, Chapter Entity
│       └── dtos/                     # 요청 DTO
│
├── shared/                           # 공통 모듈
│   ├── core/                         # 핵심 추상화
│   │   ├── domain-event.ts           # 도메인 이벤트 인터페이스
│   │   ├── exceptions/               # 커스텀 예외 클래스
│   │   ├── rate-limit.service.ts     # Rate Limiting 서비스
│   │   └── decorators/               # 커스텀 데코레이터
│   │
│   ├── infra/                        # 인프라스트럭처
│   │   ├── config/                   # 환경 설정 (ConfigService)
│   │   ├── di/diconfig.ts            # 의존성 주입 설정
│   │   ├── logging/                  # Pino 로거
│   │   ├── persistence/              # DataSource, Redis
│   │   ├── queue/                    # BullMQ 큐 정의
│   │   └── notifications/            # SSE 실시간 알림
│   │
│   ├── lib/                          # 라이브러리 래퍼
│   │   ├── events/                   # EventDispatcher
│   │   └── i18n/                     # i18next 설정
│   │
│   ├── presentation/                 # HTTP 미들웨어
│   │   └── middlewares/              # error.handler, validation, rate-limit
│   │
│   └── utils/                        # 유틸리티
│       └── queue-crypto.utils.ts     # 큐 데이터 암호화
│
└── types/                            # TypeScript 타입 선언
```

---

## Docker 구성

이 프로젝트는 4개의 컨테이너로 구성됩니다:

| 컨테이너 | 역할 | 왜 별도 컨테이너인가? |
|----------|------|---------------------|
| **app** | Express API 서버 | HTTP 요청 처리에 집중. 무거운 작업은 Worker에게 위임 |
| **worker** | 이메일 발송 + AI 분석 Worker | 백그라운드 작업이 API 응답 속도에 영향 주지 않도록 분리 |
| **postgres** | PostgreSQL DB | 데이터 영속성. 컨테이너 재시작해도 데이터 유지 (Volume) |
| **redis** | Redis (캐시/큐/Pub-Sub) | 인메모리 처리로 초고속. 캐시/큐/메시징 전담 |

```
# 컨테이너 간 통신
app ──────▶ postgres (TypeORM)
app ──────▶ redis (캐시, Rate Limit, Token)
app ──────▶ redis (BullMQ Queue에 작업 등록)
worker ◀──── redis (BullMQ Queue에서 작업 수신)
worker ──────▶ postgres (결과 저장)
worker ◀──── redis Pub/Sub (AI 결과 수신)
```

---

## 의존 방향 (Dependency Direction)

```
          Domain (Pure)
             ▲
             │ 의존
             │
      Application (Use Cases)
             ▲
             │ 의존
             │
    Infrastructure (Implementation)
             ▲
             │ 의존
             │
         API (Interface)
```

- **Domain**: 비즈니스 로직만 포함. 외부 라이브러리 의존 없음 (TypeORM 데코레이터 제외)
- **Application**: 유스케이스 조율. Domain을 호출하여 비즈니스 흐름 관리
- **Infrastructure**: DB, Redis, 이메일 등 외부 시스템 구현체
- **API**: HTTP 요청/응답 처리. 라우터, 컨트롤러, 미들웨어

---

## 실제 프로젝트에서 찾아보기

- 앱 진입점: `src/index.ts`
- Express 설정: `src/app.ts`
- Worker 진입점: `src/worker.ts`
- DI 설정: `src/shared/infra/di/diconfig.ts`
- DB 설정: `src/shared/infra/persistence/data-source.ts`
- 환경 변수: `.env.example`
- Docker: `Dockerfile`
- 패키지 목록: `package.json`
