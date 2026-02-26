import "reflect-metadata"
import { Password } from "@features/user/domain/value-objects/password.vo"
import { ValidationException } from "@shared/core/exceptions/domain-exceptions"
import { createMockPasswordHasher } from "../../utils/mock-factories"

describe("Password Value Object (단위 테스트)", () => {
    describe("validate (비밀번호 검증)", () => {
        it("유효한 비밀번호는 예외 없이 통과해야 한다", () => {
            // Given
            const validPassword = "Password1!"

            // When & Then
            expect(() => Password.validate(validPassword)).not.toThrow()
        })

        it("빈 비밀번호 시 ValidationException을 던져야 한다", () => {
            // Given
            const emptyPassword = ""

            // When & Then
            expect(() => Password.validate(emptyPassword)).toThrow(ValidationException)
            expect(() => Password.validate(emptyPassword)).toThrow("validation.password.empty")
        })

        it("null/undefined 비밀번호 시 ValidationException을 던져야 한다", () => {
            // Given
            const nullPassword = null as unknown as string
            const undefinedPassword = undefined as unknown as string

            // When & Then
            expect(() => Password.validate(nullPassword)).toThrow(ValidationException)
            expect(() => Password.validate(undefinedPassword)).toThrow(ValidationException)
        })

        it("8자 미만 비밀번호 시 ValidationException을 던져야 한다", () => {
            // Given
            const shortPassword = "Pass1!a"

            // When & Then
            expect(() => Password.validate(shortPassword)).toThrow(ValidationException)
            expect(() => Password.validate(shortPassword)).toThrow("validation.password.length")
        })

        it("20자 초과 비밀번호 시 ValidationException을 던져야 한다", () => {
            // Given
            const longPassword = "Abcdefghijk1!abcdefgh"

            // When & Then
            expect(() => Password.validate(longPassword)).toThrow(ValidationException)
            expect(() => Password.validate(longPassword)).toThrow("validation.password.length")
        })

        it("대문자가 없는 비밀번호 시 ValidationException을 던져야 한다", () => {
            // Given
            const noUppercase = "password1!"

            // When & Then
            expect(() => Password.validate(noUppercase)).toThrow(ValidationException)
            expect(() => Password.validate(noUppercase)).toThrow("validation.password.uppercase")
        })

        it("소문자가 없는 비밀번호 시 ValidationException을 던져야 한다", () => {
            // Given
            const noLowercase = "PASSWORD1!"

            // When & Then
            expect(() => Password.validate(noLowercase)).toThrow(ValidationException)
            expect(() => Password.validate(noLowercase)).toThrow("validation.password.lowercase")
        })

        it("숫자가 없는 비밀번호 시 ValidationException을 던져야 한다", () => {
            // Given
            const noDigit = "Password!!"

            // When & Then
            expect(() => Password.validate(noDigit)).toThrow(ValidationException)
            expect(() => Password.validate(noDigit)).toThrow("validation.password.digit")
        })

        it("특수문자가 없는 비밀번호 시 ValidationException을 던져야 한다", () => {
            // Given
            const noSpecial = "Password12"

            // When & Then
            expect(() => Password.validate(noSpecial)).toThrow(ValidationException)
            expect(() => Password.validate(noSpecial)).toThrow("validation.password.special")
        })

        it("정확히 8자인 유효한 비밀번호는 통과해야 한다", () => {
            // Given
            const minLength = "Pass1!ab"

            // When & Then
            expect(() => Password.validate(minLength)).not.toThrow()
        })

        it("정확히 20자인 유효한 비밀번호는 통과해야 한다", () => {
            // Given
            const maxLength = "Abcdefghijk1!abcdefg"

            // When & Then
            expect(() => Password.validate(maxLength)).not.toThrow()
        })
    })

    describe("fromHash (해시값으로 생성)", () => {
        it("유효한 해시값으로 Password 객체를 생성해야 한다", () => {
            // Given
            const hashedValue = "$2b$10$someHashedPasswordValue1234567890"

            // When
            const password = Password.fromHash(hashedValue)

            // Then
            expect(password).toBeInstanceOf(Password)
            expect(password.value).toBe(hashedValue)
        })

        it("빈 해시값 시 ValidationException을 던져야 한다", () => {
            // Given
            const emptyHash = ""

            // When & Then
            expect(() => Password.fromHash(emptyHash)).toThrow(ValidationException)
            expect(() => Password.fromHash(emptyHash)).toThrow("validation.password.empty_hash")
        })

        it("null 해시값 시 ValidationException을 던져야 한다", () => {
            // Given
            const nullHash = null as unknown as string

            // When & Then
            expect(() => Password.fromHash(nullHash)).toThrow(ValidationException)
        })

        it("undefined 해시값 시 ValidationException을 던져야 한다", () => {
            // Given
            const undefinedHash = undefined as unknown as string

            // When & Then
            expect(() => Password.fromHash(undefinedHash)).toThrow(ValidationException)
        })
    })

    describe("createHashed (검증 + 해시 팩토리)", () => {
        it("유효한 비밀번호를 해시하여 Password를 반환한다", async () => {
            // Given
            const hasher = createMockPasswordHasher()
            hasher.hash.mockResolvedValue("$2a$10$hashed")

            // When
            const pw = await Password.createHashed("Password1!", hasher)

            // Then
            expect(pw).toBeInstanceOf(Password)
            expect(pw.value).toBe("$2a$10$hashed")
        })

        it("짧은 비밀번호면 ValidationException을 던진다", async () => {
            // Given
            const hasher = createMockPasswordHasher()

            // When & Then
            await expect(Password.createHashed("Sh1!", hasher)).rejects.toThrow(ValidationException)
            expect(hasher.hash).not.toHaveBeenCalled()
        })

        it("hasher.hash가 호출되는지 검증한다", async () => {
            // Given
            const hasher = createMockPasswordHasher()

            // When
            await Password.createHashed("Password1!", hasher)

            // Then
            expect(hasher.hash).toHaveBeenCalledWith("Password1!")
        })
    })

    describe("value (해시값 접근자)", () => {
        it("저장된 해시값을 반환해야 한다", () => {
            // Given
            const hashedValue = "$2b$10$anotherHashedValue"
            const password = Password.fromHash(hashedValue)

            // When
            const result = password.value

            // Then
            expect(result).toBe(hashedValue)
        })
    })

    describe("toString (문자열 변환)", () => {
        it("[PROTECTED]를 반환하여 해시값이 노출되지 않아야 한다", () => {
            // Given
            const password = Password.fromHash("$2b$10$secretHash")

            // When
            const result = password.toString()

            // Then
            expect(result).toBe("[PROTECTED]")
        })

        it("템플릿 리터럴에서도 [PROTECTED]를 반환해야 한다", () => {
            // Given
            const password = Password.fromHash("$2b$10$secretHash")

            // When
            const result = `${password}`

            // Then
            expect(result).toBe("[PROTECTED]")
        })
    })
})
