# 🔐 인증 시스템 구현 완료!

> **🏗️ 시스템 아키텍처 가이드**: 전체 프로젝트(Flutter, Next.js, LLM)의 구성도는 [docs/architecture.md](./docs/architecture.md)를 참고하세요.

## ✅ 구현된 기능

### 1. **SendGrid 이메일 전송**
- ✅ HTML 이메일 템플릿 (반응형 디자인)
- ✅ Fallback: SendGrid 미설정 시 컨솔 로그
- ✅ 에러 핸들링 (실패해도 앱이 멈추지 않음)

### 2. **Redis 기반 인증 코드 저장**
- ✅ 인증 코드를 Redis에 저장 (10분 TTL)
- ✅ DB Fallback: Redis 미연결 시 자동으로 DB 저장
- ✅ DB Fallback: Redis 미연결 시 자동으로 DB 저장
- ✅ 빠른 조회 및 자동 만료

### 3. **비밀번호 재설정**
- ✅ 이메일 인증 코드 발송
- ✅ 보안 확인 후 비밀번호 변경
- ✅ Redis 활용한 인증 코드 관리 (30분 유효)

### 4. **Rate Limiting**
- ✅ 회원가입: 10분에 3회
- ✅ 이메일 재전송: 5분에 3회
- ✅ 로그인: 15분에 5회
- ✅ 사용자 친화적 에러 메시지 (남은 시간 표시)

---

## 📦 설치 및 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정 ⚠️ **필수**

> [!CAUTION]
> **운영 환경에서는 반드시 환경 변수를 설정하세요!**

모든 설정은 `.env` 파일을 통해 관리됩니다. 상세한 설정 가이드와 환경별 관리 방법은 **[`docs/env-guide.md`](./docs/env-guide.md)**를 참조하세요.

**빠른 설정**:
```bash
# 1. 설정 파일 생성
cp .env.example .env

# 2. 필수 값 수정 (JWT Secret, DB 등)
vim .env
```

**주요 환경 변수**:
- `NODE_ENV`: 실행 환경 (development, production, test)
- `JWT_SECRET`: JWT 토큰 비밀키 (필수)
- `DATABASE_TYPE`: postgres

### 3. Redis 실행 (선택사항)
```bash
# macOS (Homebrew)
brew install redis
brew services start redis

# Docker
docker run -d -p 6379:6379 redis:alpine

# Redis 미설치 시: DB fallback 자동 적용
```

### 4. SendGrid 설정 (선택사항)

SendGrid를 설정하지 않으면 이메일이 콘솔에 출력됩니다 (개발용).

1. https://SendGrid.com 가입
2. API Key 발급
3. `.env` 파일에 API Key 입력:
   ```bash
   SENDGRID_APIKEY=your-actual-api-key-here
   SENDGRID_FROMEMAIL=noreply@yourapp.com
   ```
4. SendGrid 대시보드에서 발신자 이메일 인증

---

## 🚀 실행

### 개발 환경

```bash
# 앱 시작
npm start

# 또는
npm run dev
```

### Docker 환경

```bash
# Docker Compose로 전체 스택 실행 (앱 + PostgreSQL + Redis)
docker-compose up -d

# 로그 확인
docker-compose logs -f app

# 중지
docker-compose down
```

### 테스트

```bash
# 전체 테스트
npm test
```

---

## 💡 사용 예시

### 회원가입 + 이메일 인증
```typescript
// 1. 회원가입
const user = await authService.register(
    "user@example.com", 
    "SecurePass@123", 
    "홍길동"
)

// 2. 이메일 발송 (콘솔에서 코드 확인)
// Verification Code: 123456

// 3. 이메일 인증
const result = await authService.verifyEmail("user@example.com", "123456")

// 4. 로그인
const tokens = await authService.login("email", {
    email: "user@example.com",
    password: "SecurePass@123"
})
// { accessToken: "...", refreshToken: "..." }
```

### Rate Limiting 동작
```typescript
// 연속 3회 회원가입 시도 후
await authService.register("test@test.com", "Test@123", "Test")
// Error: Too many registration attempts. Please try again in 9 minutes.

// 연속 3회 인증 코드 재전송 후
await authService.resendVerificationCode("test@test.com")
// Error: Too many resend attempts. Please try again in 4 minutes.
```

---

## 🔍 시스템 아키텍처

### Clean Architecture 계층
```
src/
├── common/
│   ├── adapters/           # 외부 시스템 어댑터
│   │   ├── EmailNotificationService.ts  (SendGrid)
│   │   ├── RedisService.ts              (ioredis)
│   │   ├── BcryptPasswordHasher.ts
│   │   └── JwtTokenProvider.ts
│   └── services/
│       └── RateLimitService.ts  # Rate Limiting 정책
│
├── modules/auth/
│   ├── domain/             # 엔티티
│   ├── application/        # 비즈니스 로직 (AuthService)
│   ├── infrastructure/     # 저장소
│   └── interface/          # 컨트롤러
│
└── diconfig.ts             # DI 컨테이너 설정
```

### 설계 패턴
- ✅ **Adapter Pattern**: 외부 서비스 추상화
- ✅ **Strategy Pattern**: 다양한 로그인 방식 지원
- ✅ **Repository Pattern**: 데이터 계층 분리
- ✅ **Dependency Injection**: tsyringe

---

## 📊 테스트 현황

```
Unit Tests:        ✓ 7 passed
Integration Tests: ✓ 4 passed (Email Verification Flow)
E2E Tests:         ✓ 1 passed
Total:             ✓ 12 tests passed
```

---

## 🎯 핵심 기능 하이라이트

### 1. 이중 저장 시스템 (Redis + DB)
```typescript
// Redis 우선, 실패 시 DB fallback
try {
    await redisService.set(`verification:${email}`, code, 600)
    console.log('✓ Redis에 저장')
} catch (error) {
    await verificationCodeRepository.save(codeEntity)
    console.log('✓ DB에 저장 (Redis fallback)')
}
```

### 2. 아름다운 HTML 이메일 템플릿
- 그라디언트 헤더
- 큰 글씨 인증 코드
- 반응형 디자인
- 한글 폰트 지원

### 3. 스마트 Rate Limiting
```typescript
{
    'verification-resend': { maxAttempts: 3, windowSeconds: 300 },  // 5분에 3회
    'login-attempt': { maxAttempts: 5, windowSeconds: 900 },        // 15분에 5회
    'registration': { maxAttempts: 3, windowSeconds: 600 }          // 10분에 3회
}
```

---

## 🔧 트러블슈팅

### Q: SendGrid 이메일이 안 가요
**A**: `.env` 파일에 API Key가 올바른지 확인하고, SendGrid 대시보드에서 발신자 이메일이 인증되었는지 확인하세요.

### Q: Redis 연결 에러가 나요
**A**: Redis가 설치되지 않았거나 실행 중이 아닙니다. 자동으로 DB fallback이 작동하므로 문제없습니다. Redis 설치 원할 경우 `brew install redis`.

### Q: Rate Limiting을 조정하고 싶어요
**A**: `src/common/services/RateLimitService.ts`의 `policies` 객체를 수정하세요.

---

## 📝 TODO

- [ ] OAuth 로그인 (카카오, 네이버) 추가
- [ ] 2FA (Two-Factor Authentication)
- [ ] Admin 대시보드 (Rate Limit 모니터링)

---

## 🚀 운영 배포

운영 환경에 배포하기 전에 **반드시** 아래 문서를 확인하세요:

📖 **[docs/deployment.md](./docs/deployment.md)** - 상세 배포 가이드
- 환경 변수 설정
- PostgreSQL 마이그레이션
- Docker 배포
- AWS/클라우드 배포
- CI/CD 파이프라인

> [!WARNING]
> 기본 설정값(config/default.yml)은 개발용입니다. 운영 환경에서는 반드시 환경 변수를 사용하세요!

---

## 🙏 기술 스택

- TypeScript
- TypeORM (PostgreSQL)
- tsyringe (DI)
- SendGrid (Email)
- ioredis (Redis)
- bcryptjs (Password Hashing)
- jsonwebtoken (JWT)
- Jest (Testing)
- Docker & Docker Compose

---

## 📧 Support

문제가 있거나 질문이 있으면 이슈를 생성해주세요!
