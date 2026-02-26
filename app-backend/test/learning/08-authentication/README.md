# 08. JWT 인증 + 권한 시스템

## 왜 JWT인가?

### 세션 기반 인증의 문제
```
서버 A에서 로그인 → 세션 ID를 서버 A 메모리에 저장
서버 B로 요청 → 세션 ID가 서버 B에 없음 → 인증 실패!
```
서버를 여러 대로 늘릴(Scale-out) 때 **세션 공유 문제**가 발생합니다.

### JWT (JSON Web Token) 방식
```
서버 A에서 로그인 → JWT 토큰 발급 (서버에 저장 안 함)
서버 B로 요청 → JWT를 검증만 하면 됨 (비밀 키만 공유)
```
JWT는 **토큰 자체에 정보**가 포함되어 있어, 어떤 서버든 비밀 키만 있으면 검증 가능합니다.

**사용 안 하면?** 서버 증설 시 Redis/DB에 세션을 공유하는 복잡한 구조가 필요합니다.

---

## 왜 Access Token + Refresh Token 이중 구조인가?

### Access Token만 사용하면?
- 유효 기간이 길면(30일): 탈취 시 30일간 무방비
- 유효 기간이 짧으면(15분): 15분마다 재로그인 → UX 최악

### 이중 구조로 해결
| 토큰 | 유효 기간 | 저장 위치 | 용도 |
|------|----------|----------|------|
| Access Token | 15분 | Authorization 헤더 | API 요청 인증 |
| Refresh Token | 7일 | HttpOnly 쿠키 | Access Token 갱신 |

```
1. 로그인 → Access Token(15분) + Refresh Token(7일) 발급
2. API 요청 → Access Token으로 인증
3. Access Token 만료 → Refresh Token으로 새 Access Token 발급
4. Refresh Token 만료 → 재로그인 필요
```

---

## 왜 bcryptjs인가?

비밀번호를 **평문 저장하면** DB 유출 시 모든 계정이 노출됩니다.

```typescript
// ❌ 평문 저장
await db.save({ password: "MySecret123" })
// DB 유출 → 모든 사용자 비밀번호 노출!

// ✅ bcrypt 해싱
const hashed = await bcrypt.hash("MySecret123", 10)
// "$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu..."
// DB 유출 → 해시만 노출. 원래 비밀번호 복원 불가
```

**왜 bcrypt가 특별한가?** 일반 해시(SHA-256)는 초당 수십억 회 계산 가능. bcrypt는 **의도적으로 느림** → 무차별 대입 공격 방어.

---

## 왜 authGuard 미들웨어인가?

**모든 보호 라우트에 인증 로직 중복 대신**, 미들웨어로 한 번 검증합니다.

```typescript
// ❌ 모든 컨트롤러에서 인증 검증 중복
class UserController {
    async getProfile(req, res) {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) return res.status(401).json(...)
        const payload = jwt.verify(token, secret)
        if (!payload) return res.status(401).json(...)
        // 이 코드가 모든 보호 라우트에 반복!
    }
}

// ✅ authGuard 미들웨어
router.get("/profile", authGuard, controller.getProfile)
// authGuard가 검증 → req.user에 사용자 정보 주입
// controller는 인증 걱정 없이 비즈니스 로직만 처리
```

---

## 왜 Token Blacklist(Redis)인가?

JWT는 서버에서 **무효화할 수 없습니다** (Stateless). 로그아웃해도 토큰이 만료될 때까지 유효합니다.

**해결**: Redis에 로그아웃된 토큰을 등록합니다.
```typescript
// 로그아웃 시
await redis.set(`blacklist:${accessToken}`, '1', ttl)

// 인증 시 (authGuard)
const isBlacklisted = await redis.exists(`blacklist:${token}`)
if (isBlacklisted) throw new UnauthorizedException("토큰 무효화됨")
```

---

## 왜 Rate Limiting인가?

로그인 시도 무제한이면 **무차별 대입 공격**(Brute Force) 가능합니다.

```typescript
// Redis 카운터로 시도 횟수 제한
const policy = {
    'login-attempt': { maxAttempts: 5, windowSeconds: 900 },  // 15분에 5회
    'registration': { maxAttempts: 3, windowSeconds: 600 },    // 10분에 3회
}
```

---

## Strategy 패턴

**왜?** 현재는 이메일 로그인만 있지만, OAuth/소셜 로그인 추가 시 기존 코드 수정 없이 **전략만 추가**합니다.

```typescript
interface ILoginStrategy {
    getName(): string
    login(credentials: any): Promise<User>
}

class EmailLoginStrategy implements ILoginStrategy { ... }
// 추가 시:
class GoogleOAuthStrategy implements ILoginStrategy { ... }
class KakaoLoginStrategy implements ILoginStrategy { ... }

// AuthService는 변경 없음!
const strategy = this.loginStrategyFactory.getStrategy(strategyName)
const user = await strategy.login(credentials)
```

---

## 실제 프로젝트에서 찾아보기

| 개념 | 파일 경로 |
|------|----------|
| JWT 토큰 생성/검증 | `src/features/auth/infrastructure/crypto/jwt-token-provider.ts` |
| bcrypt 비밀번호 해싱 | `src/features/auth/infrastructure/crypto/bcrypt-password-hasher.ts` |
| Password VO (규칙 검증) | `src/features/user/domain/value-objects/password.vo.ts` |
| authGuard | `src/features/auth/presentation/guards/auth.guard.ts` |
| adminGuard | `src/features/auth/presentation/guards/admin.guard.ts` |
| Token Blacklist (로그아웃) | `src/features/auth/auth.service.ts:281-285` |
| Rate Limiting | `src/shared/core/rate-limit.service.ts` |
| Strategy 인터페이스 | `src/features/auth/strategies/login-strategy.interface.ts` |
| Email 전략 | `src/features/auth/strategies/email-login.strategy.ts` |
| Strategy Factory | `src/features/auth/strategies/login-strategy.factory.ts` |
| AuthService | `src/features/auth/auth.service.ts` |
| Auth 라우트 | `src/features/auth/auth.routes.ts` |
