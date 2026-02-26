# 02. Express 5 + 미들웨어 패턴

## 왜 Express인가?

Express는 Node.js 웹 프레임워크입니다. **미들웨어 패턴**으로 HTTP 요청 처리 파이프라인을 구성합니다.

**사용 안 하면?** 순수 `http` 모듈로 모든 것을 직접 구현해야 합니다:
```typescript
// Express 없이... (절대 이렇게 하지 마세요)
import http from "http"
http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/users") {
        let body = ""
        req.on("data", chunk => body += chunk)  // 직접 파싱
        req.on("end", () => {
            const data = JSON.parse(body)       // 직접 변환
            // CORS 헤더 직접 설정
            // 보안 헤더 직접 설정
            // 인증 검증 직접 구현
            // 에러 처리 직접 구현
            res.writeHead(200, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ success: true }))
        })
    }
})
```

---

## 미들웨어란?

요청(Request)이 들어오면 여러 함수를 **순서대로** 통과합니다.

```
Client 요청
    │
    ▼
[helmet]          ← 보안 헤더 설정
    │
    ▼
[cors]            ← CORS 허용 여부 검사
    │
    ▼
[express.json()]  ← JSON body 파싱
    │
    ▼
[cookieParser]    ← 쿠키 파싱
    │
    ▼
[pinoHttp]        ← 요청 로깅
    │
    ▼
[authGuard]       ← JWT 인증 (보호된 라우트만)
    │
    ▼
[validateDto]     ← 입력 유효성 검사
    │
    ▼
[Controller]      ← 비즈니스 로직 처리
    │
    ▼
[errorHandler]    ← 에러 발생 시 처리 (반드시 마지막)
    │
    ▼
Client 응답
```

### 왜 순서가 중요한가?

1. `express.json()` 전에 라우트를 설정하면 `req.body`가 `undefined`
2. `authGuard` 전에 `cookieParser`가 없으면 쿠키 토큰을 읽지 못함
3. `errorHandler`가 라우트 앞에 있으면 에러를 잡지 못함

---

## 각 미들웨어가 왜 필요한지

### `helmet` - HTTP 보안 헤더
**왜?** 브라우저 보안 기능을 활성화하는 HTTP 헤더를 자동으로 설정합니다.

| 헤더 | 효과 | 없으면? |
|------|------|--------|
| X-Content-Type-Options | MIME 스니핑 방지 | 악성 파일이 스크립트로 실행될 수 있음 |
| Content-Security-Policy | 허용된 리소스만 로드 | XSS 공격에 취약 |
| X-Frame-Options | iframe 삽입 방지 | Clickjacking 공격에 취약 |

### `cors` - Cross-Origin Resource Sharing
**왜?** 브라우저의 **Same-Origin Policy** 때문입니다.
- 프론트엔드: `https://app.example.com`
- 백엔드: `https://api.example.com`
- 도메인이 다르면 브라우저가 API 요청을 **차단**합니다.
- `cors` 미들웨어가 `Access-Control-Allow-Origin` 헤더를 설정하여 허용합니다.

**사용 안 하면?** 프론트엔드에서 API 호출 시 "CORS policy" 에러가 발생합니다.

### `cookie-parser` - 쿠키 파싱
**왜?** Refresh Token을 **HttpOnly 쿠키**로 전달하기 때문입니다.
- HttpOnly 쿠키: JavaScript에서 접근 불가 → XSS 공격으로 토큰 탈취 방지
- `cookie-parser` 없으면 `req.cookies`가 `undefined`

### `express.json()` - JSON body 파싱
**왜?** Express는 기본적으로 HTTP body를 파싱하지 않습니다.
```typescript
// express.json() 없이:
app.post("/api/users", (req, res) => {
    console.log(req.body)  // undefined!
})

// express.json() 있으면:
app.post("/api/users", (req, res) => {
    console.log(req.body)  // { email: "a@b.com", password: "..." }
})
```

### `pino-http` - 구조화 로깅
**왜?** 모든 HTTP 요청/응답을 자동으로 JSON 로그로 기록합니다.
```json
{"level":"info","time":1707123456789,"req":{"method":"POST","url":"/api/auth/login"},"res":{"statusCode":200},"responseTime":45}
```
**사용 안 하면?** 운영 환경에서 "어떤 요청이 언제 왔는지" 추적이 불가능합니다.

---

## 라우터 분리 패턴

**왜?** 모든 라우트를 `app.ts`에 넣으면 수천 줄이 됩니다. 기능별로 분리합니다.

```typescript
// src/app.ts - 라우터 마운트만 담당
app.use("/api/v1/auth", getAuthRouter())
app.use("/api/v1/user", getUserRouter())
app.use("/api/v1/assessments", getAssessmentRouter())
app.use("/api/v1/scripts", getScriptRouter())
```

각 라우터 파일에서 해당 기능의 엔드포인트만 정의:
```typescript
// src/features/auth/auth.routes.ts
const router = Router()
router.post("/register", validateDto(RegisterDto), (req, res) => controller.register(req, res))
router.post("/login", validateDto(LoginDto), (req, res) => controller.login(req, res))
```

---

## 에러 핸들링 미들웨어

**왜 반드시 마지막인가?** Express는 에러가 발생하면 `next(error)`로 다음 미들웨어에 전달합니다. **4개의 파라미터**를 가진 미들웨어가 에러 핸들러입니다.

```typescript
// 일반 미들웨어: 3개 파라미터
app.use((req, res, next) => { ... })

// 에러 핸들링 미들웨어: 4개 파라미터 (반드시 4개 모두 선언해야 Express가 인식)
app.use((error, req, res, next) => {
    // 모든 라우트에서 throw된 에러가 여기로 모임
    res.status(500).json({ message: error.message })
})
```

이 프로젝트에서는 `globalErrorHandler`가 이 역할을 합니다 (`src/shared/presentation/middlewares/error.handler.ts`).

---

## 실제 프로젝트에서 찾아보기

| 개념 | 파일 경로 |
|------|----------|
| Express 앱 설정 | `src/app.ts` |
| helmet 설정 | `src/app.ts:53-65` |
| cors 설정 | `src/app.ts:70-84` |
| JSON 파싱 | `src/app.ts:87` |
| pino-http 로깅 | `src/app.ts:96-115` |
| 라우터 마운트 | `src/app.ts:118-121` |
| globalErrorHandler | `src/app.ts:206`, `src/shared/presentation/middlewares/error.handler.ts` |
| Auth 라우터 | `src/features/auth/auth.routes.ts` |
| validateDto 미들웨어 | `src/shared/presentation/middlewares/validation.middleware.ts` |
| rateLimitMiddleware | `src/shared/presentation/middlewares/rate-limit.middleware.ts` |
