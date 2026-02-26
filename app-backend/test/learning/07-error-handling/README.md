# 07. 계층화된 예외 처리 시스템

## 왜 커스텀 예외 클래스인가?

### 문제: 기본 Error만 사용
```typescript
// ❌ 기본 Error만 사용
throw new Error("User not found")
// HTTP 상태 코드는? → 항상 500 (Internal Server Error)
// 에러 코드는? → 없음
// 클라이언트가 어떤 에러인지 구별 방법? → 문자열 파싱 (취약!)
```

### 해결: 커스텀 예외
```typescript
// ✅ 커스텀 예외
throw new NotFoundException("auth.user_not_found", "USER_NOT_FOUND")
// HTTP 상태 코드: 404 (자동)
// 에러 코드: USER_NOT_FOUND (프로그래밍적 구별 가능)
// i18n: "auth.user_not_found" 키로 다국어 번역
```

---

## 예외 클래스 계층

```
Error (JavaScript 기본)
 └── DomainException (추상 클래스, isDomainException: true)
      ├── ValidationException (400 Bad Request)
      ├── UnauthorizedException (401 Unauthorized)
      ├── ForbiddenException (403 Forbidden)
      │    ├── EmailNotVerifiedException
      │    ├── AccountSuspendedException
      │    └── AccountLockedException
      ├── NotFoundException (404 Not Found)
      ├── ResourceNotFoundException (404)
      └── ConflictException (409 Conflict)

 └── ServiceUnavailableException (isInfrastructureException: true, 503)
```

---

## 왜 DomainException과 InfrastructureException을 분리하는가?

| | DomainException | InfrastructureException |
|---|---|---|
| 원인 | 비즈니스 규칙 위반 (잘못된 입력, 권한 부족) | 인프라 장애 (Redis 다운, DB 연결 실패) |
| HTTP 코드 | 400, 401, 403, 404, 409 | 503 |
| 사용자 메시지 | 구체적 (무엇이 잘못됐는지) | 일반적 ("잠시 후 다시 시도") |
| 로그 레벨 | warn (예상된 에러) | error (예상 못 한 에러) |

---

## 왜 `isDomainException` 플래그인가?

```typescript
// 프로덕션 빌드 시 코드 압축(minification)으로 클래스 이름이 바뀜
// DomainException → a, ValidationException → b
// instanceof만으로는 불안정!

// 그래서 플래그를 함께 사용
function isDomainError(error: any): error is DomainException {
    return error instanceof DomainException || error?.isDomainException === true
}
```

---

## globalErrorHandler

**왜 반드시 마지막인가?** 모든 라우트에서 throw된 에러가 여기로 모입니다.

```typescript
// src/shared/presentation/middlewares/error.handler.ts
export function globalErrorHandler(error, req, res, next) {
    // 1. 인프라 예외 → 503
    if (isServiceUnavailableError(error)) {
        return res.status(503).json({
            success: false,
            message: "Service temporarily unavailable"
        })
    }

    // 2. 도메인 예외 → 해당 statusCode (400, 401, 404, ...)
    if (isDomainError(error)) {
        const message = req.t(error.message)  // i18n 번역
        return res.status(error.statusCode).json({
            success: false,
            message,
            errorCode: error.errorCode,
            errorKey: error.message,
            ...(error.metadata && { metadata: error.metadata })
        })
    }

    // 3. 알 수 없는 에러 → 500
    return res.status(500).json({
        success: false,
        message: "Internal Server Error"
    })
}
```

### 에러 응답 형태
```json
{
    "success": false,
    "message": "이메일 형식이 올바르지 않습니다",
    "errorCode": "VALIDATION_ERROR",
    "errorKey": "validation.email.invalid_format",
    "metadata": { "field": "email" }
}
```

---

## 실제 프로젝트에서 찾아보기

| 개념 | 파일 경로 |
|------|----------|
| DomainException 계층 | `src/shared/core/exceptions/domain-exceptions.ts` |
| InfrastructureException | `src/shared/core/exceptions/infrastructure-exceptions.ts` |
| globalErrorHandler | `src/shared/presentation/middlewares/error.handler.ts` |
| 사용 예시 (NotFoundException) | `src/features/auth/auth.service.ts:125` |
| 사용 예시 (ConflictException) | `src/features/auth/auth.service.ts:91` |
| 사용 예시 (ValidationException) | `src/features/assessment/domain/assessment.entity.ts:170` |
| 에러 핸들러 등록 | `src/app.ts:206` |
