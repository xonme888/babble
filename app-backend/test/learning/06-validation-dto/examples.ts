export {}

/**
 * 06. class-validator DTO 유효성 검사 예제
 *
 * 실행: npx ts-node test/learning/06-validation-dto/examples.ts
 */
import "reflect-metadata"
import {
    IsEmail,
    IsString,
    MinLength,
    MaxLength,
    IsOptional,
    IsInt,
    Min,
    Max,
    validate,
    ValidationError,
} from "class-validator"
import { plainToInstance } from "class-transformer"

// ============================================================
// 1. DTO 정의 - 데코레이터로 검증 규칙 선언
// ============================================================

/**
 * 회원가입 DTO
 * 이 프로젝트의 RegisterDto와 유사 (src/features/auth/dtos/auth.dto.ts)
 */
class CreateUserDto {
    @IsEmail({}, { message: "올바른 이메일 형식이 아닙니다" })
    email!: string

    @IsString({ message: "비밀번호는 문자열이어야 합니다" })
    @MinLength(8, { message: "비밀번호는 최소 8자 이상이어야 합니다" })
    @MaxLength(20, { message: "비밀번호는 최대 20자 이하여야 합니다" })
    password!: string

    @IsString()
    @MinLength(2, { message: "이름은 최소 2자 이상이어야 합니다" })
    @MaxLength(50)
    firstName!: string

    @IsOptional() // 선택 필드 - 없어도 검증 통과
    @IsString()
    lastName?: string

    @IsOptional()
    @IsInt({ message: "나이는 정수여야 합니다" })
    @Min(1, { message: "나이는 1 이상이어야 합니다" })
    @Max(150, { message: "나이는 150 이하여야 합니다" })
    age?: number
}

// ============================================================
// 2. validateDto 함수 (미들웨어의 핵심 로직)
// ============================================================

/**
 * DTO 검증 함수
 * 이 프로젝트: src/shared/presentation/middlewares/validation.middleware.ts
 *
 * 1. plainToInstance: JSON → 클래스 인스턴스 변환
 * 2. validate: 데코레이터 기반 검증
 * 3. 에러 메시지 추출
 */
async function validateDto<T extends object>(
    DtoClass: new () => T,
    data: unknown
): Promise<{ valid: boolean; errors: string[]; dto: T }> {
    // JSON 객체를 클래스 인스턴스로 변환
    // 왜? class-validator 데코레이터는 인스턴스에서만 동작
    const dto = plainToInstance(DtoClass, data)

    // 데코레이터 기반 검증 실행
    const errors: ValidationError[] = await validate(dto as object)

    if (errors.length > 0) {
        // 에러 메시지 추출
        const messages = errors.map((error) => Object.values(error.constraints || {})).flat()

        return { valid: false, errors: messages, dto }
    }

    return { valid: true, errors: [], dto }
}

// ============================================================
// 3. 테스트 실행
// ============================================================

async function main() {
    console.log("=== DTO 유효성 검사 예제 ===\n")

    // --- 유효한 입력 ---
    console.log("--- 1. 유효한 입력 ---")
    const validData = {
        email: "hong@example.com",
        password: "SecureP@ss1",
        firstName: "길동",
        lastName: "홍",
        age: 25,
    }

    const result1 = await validateDto(CreateUserDto, validData)
    console.log(`  검증 결과: ${result1.valid ? "✅ 통과" : "❌ 실패"}`)
    console.log(`  DTO: ${JSON.stringify(result1.dto)}\n`)

    // --- 무효한 이메일 ---
    console.log("--- 2. 무효한 이메일 ---")
    const invalidEmail = {
        email: "not-an-email",
        password: "SecureP@ss1",
        firstName: "길동",
    }

    const result2 = await validateDto(CreateUserDto, invalidEmail)
    console.log(`  검증 결과: ${result2.valid ? "✅ 통과" : "❌ 실패"}`)
    console.log(`  에러: ${result2.errors.join(", ")}\n`)

    // --- 짧은 비밀번호 ---
    console.log("--- 3. 짧은 비밀번호 ---")
    const shortPassword = {
        email: "kim@example.com",
        password: "123",
        firstName: "철수",
    }

    const result3 = await validateDto(CreateUserDto, shortPassword)
    console.log(`  검증 결과: ${result3.valid ? "✅ 통과" : "❌ 실패"}`)
    console.log(`  에러: ${result3.errors.join(", ")}\n`)

    // --- 여러 필드 동시 실패 ---
    console.log("--- 4. 여러 필드 동시 실패 ---")
    const multipleErrors = {
        email: "",
        password: "",
        firstName: "",
    }

    const result4 = await validateDto(CreateUserDto, multipleErrors)
    console.log(`  검증 결과: ${result4.valid ? "✅ 통과" : "❌ 실패"}`)
    console.log(`  에러 ${result4.errors.length}개:`)
    result4.errors.forEach((err) => console.log(`    - ${err}`))

    // --- 선택 필드 없음 (통과해야 함) ---
    console.log("\n--- 5. 선택 필드 생략 (@IsOptional) ---")
    const minimalData = {
        email: "lee@example.com",
        password: "StrongP@ss1",
        firstName: "영희",
        // lastName, age 생략
    }

    const result5 = await validateDto(CreateUserDto, minimalData)
    console.log(`  검증 결과: ${result5.valid ? "✅ 통과" : "❌ 실패"}`)
    console.log(`  lastName: ${result5.dto.lastName ?? "(미입력)"}`)
    console.log(`  age: ${result5.dto.age ?? "(미입력)"}`)

    // --- 잘못된 타입 ---
    console.log("\n--- 6. 잘못된 타입 (age에 문자열) ---")
    const wrongType = {
        email: "park@example.com",
        password: "StrongP@ss1",
        firstName: "민수",
        age: "스물다섯", // 정수여야 하는데 문자열
    }

    const result6 = await validateDto(CreateUserDto, wrongType)
    console.log(`  검증 결과: ${result6.valid ? "✅ 통과" : "❌ 실패"}`)
    if (!result6.valid) {
        console.log(`  에러: ${result6.errors.join(", ")}`)
    }

    console.log("\n✅ DTO 유효성 검사 예제 완료!")
}

main().catch(console.error)
