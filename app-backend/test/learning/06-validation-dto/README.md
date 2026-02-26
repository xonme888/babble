# 06. class-validator DTO 유효성 검사

## 왜 DTO(Data Transfer Object)인가?

HTTP 요청의 body는 **`any` 타입**입니다. 어떤 데이터가 올지 보장할 수 없습니다.

```typescript
// 클라이언트가 이런 데이터를 보낼 수도 있음:
{ "email": "not-an-email", "password": 123, "name": "" }
// 또는:
{ "hacked": true, "__proto__": { "admin": true } }
```

**DTO**로 변환하면 **타입 안전 + 검증**이 됩니다:
```typescript
class RegisterDto {
    @IsEmail()
    email!: string      // 반드시 이메일 형식

    @MinLength(8)
    password!: string   // 반드시 8자 이상

    @IsString()
    @MinLength(2)
    firstName!: string  // 반드시 2자 이상 문자열
}
```

**사용 안 하면?** 잘못된 입력이 비즈니스 로직까지 도달하여 예측 불가능한 에러가 발생합니다.

---

## 왜 class-validator인가?

### if문으로 직접 검증 (❌)
```typescript
app.post("/register", (req, res) => {
    if (!req.body.email) return res.status(400).json({ error: "이메일 필수" })
    if (!req.body.email.includes("@")) return res.status(400).json({ error: "이메일 형식" })
    if (!req.body.password) return res.status(400).json({ error: "비밀번호 필수" })
    if (req.body.password.length < 8) return res.status(400).json({ error: "비밀번호 길이" })
    if (!req.body.firstName) return res.status(400).json({ error: "이름 필수" })
    // ... 필드가 20개면 if문이 50줄+
})
```

### class-validator (✅)
```typescript
class RegisterDto {
    @IsEmail({}, { message: "validation.email.invalid_format" })
    email!: string

    @MinLength(8, { message: "validation.password.length" })
    password!: string

    @IsString()
    @MinLength(2)
    firstName!: string
}
// 검증 코드 3줄. 필드가 20개여도 깔끔
```

---

## 왜 class-transformer인가?

`class-validator`의 데코레이터가 동작하려면 **클래스 인스턴스**여야 합니다.

```typescript
// req.body는 순수 JSON 객체 (클래스 인스턴스가 아님)
{ "email": "a@b.com", "password": "12345678" }

// class-transformer가 인스턴스로 변환
import { plainToInstance } from "class-transformer"
const dto = plainToInstance(RegisterDto, req.body)
// 이제 dto는 RegisterDto 인스턴스 → 데코레이터 동작!
```

---

## validateDto 미들웨어

**왜 미들웨어로 만드는가?** 모든 라우트에서 **재사용** 가능. 컨트롤러는 검증 걱정 없이 비즈니스 로직만 처리합니다.

```typescript
// src/shared/presentation/middlewares/validation.middleware.ts
export function validateDto(type: any) {
    return async (req, res, next) => {
        const dto = plainToInstance(type, req.body)  // JSON → 인스턴스
        const errors = await validate(dto)           // 데코레이터 기반 검증

        if (errors.length > 0) {
            return next(new ValidationException(errorMessages))
        }

        req.body = dto  // 검증된 객체로 교체
        next()          // 다음 미들웨어(컨트롤러)로 이동
    }
}

// 사용: 라우트에서 미들웨어로 삽입
router.post("/register", validateDto(RegisterDto), controller.register)
router.post("/login", validateDto(LoginDto), controller.login)
```

---

## 실제 프로젝트 DTO 사례

### RegisterDto
```typescript
// src/features/auth/dtos/auth.dto.ts
export class RegisterDto {
    @IsEmail({}, { message: "validation.email.invalid_format" })
    email!: string

    @IsString()
    @MinLength(8, { message: "validation.password.length" })
    password!: string

    @IsString()
    @MinLength(2)
    @MaxLength(50)
    firstName!: string

    @IsOptional()      // 선택 필드
    @IsString()
    lastName?: string
}
```

### LoginDto
```typescript
export class LoginDto {
    @IsEmail({}, { message: "validation.email.invalid_format" })
    email!: string

    @IsString()
    password!: string

    @IsOptional()
    @IsString()
    strategy?: string = 'email'  // 기본값: 이메일 로그인
}
```

---

## 실제 프로젝트에서 찾아보기

| 개념 | 파일 경로 |
|------|----------|
| validateDto 미들웨어 | `src/shared/presentation/middlewares/validation.middleware.ts` |
| Auth DTO들 | `src/features/auth/dtos/auth.dto.ts` |
| User DTO들 | `src/features/user/dtos/update-user.dto.ts` |
| 라우트에서 사용 | `src/features/auth/auth.routes.ts:29` |
| ValidationException | `src/shared/core/exceptions/domain-exceptions.ts:23` |
