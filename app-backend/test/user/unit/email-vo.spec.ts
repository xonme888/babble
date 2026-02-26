import "reflect-metadata"
import { Email } from "@features/user/domain/value-objects/email.vo"
import { ValidationException } from "@shared/core/exceptions/domain-exceptions"

describe("Email Value Object (단위 테스트)", () => {
    describe("create (생성)", () => {
        it("올바른 이메일로 생성하면 소문자로 정규화된 이메일을 반환해야 한다", () => {
            // Given
            const rawEmail = "Test@Example.COM"

            // When
            const email = Email.create(rawEmail)

            // Then
            expect(email.value).toBe("test@example.com")
        })

        it("앞뒤 공백이 있는 이메일은 트리밍 후 생성해야 한다", () => {
            // Given
            const rawEmail = "  user@example.com  "

            // When
            const email = Email.create(rawEmail)

            // Then
            expect(email.value).toBe("user@example.com")
        })

        it("빈 문자열이면 ValidationException을 던져야 한다", () => {
            // Given
            const rawEmail = ""

            // When & Then
            expect(() => Email.create(rawEmail)).toThrow(ValidationException)
            expect(() => Email.create(rawEmail)).toThrow("validation.email.empty")
        })

        it("null 또는 undefined이면 ValidationException을 던져야 한다", () => {
            // When & Then
            expect(() => Email.create(null as unknown as string)).toThrow(ValidationException)
            expect(() => Email.create(undefined as unknown as string)).toThrow(ValidationException)
        })

        it("@ 기호가 없는 문자열이면 ValidationException을 던져야 한다", () => {
            // Given
            const rawEmail = "invalid-email"

            // When & Then
            expect(() => Email.create(rawEmail)).toThrow(ValidationException)
            expect(() => Email.create(rawEmail)).toThrow("validation.email.invalid_format")
        })

        it("도메인 부분에 점이 없으면 ValidationException을 던져야 한다", () => {
            // Given
            const rawEmail = "user@domain"

            // When & Then
            expect(() => Email.create(rawEmail)).toThrow(ValidationException)
            expect(() => Email.create(rawEmail)).toThrow("validation.email.invalid_format")
        })

        it("로컬 파트가 비어있으면 ValidationException을 던져야 한다", () => {
            // Given
            const rawEmail = "@example.com"

            // When & Then
            expect(() => Email.create(rawEmail)).toThrow(ValidationException)
            expect(() => Email.create(rawEmail)).toThrow("validation.email.invalid_format")
        })

        it("도메인 파트가 비어있으면 ValidationException을 던져야 한다", () => {
            // Given
            const rawEmail = "user@"

            // When & Then
            expect(() => Email.create(rawEmail)).toThrow(ValidationException)
            expect(() => Email.create(rawEmail)).toThrow("validation.email.invalid_format")
        })

        it("공백이 포함된 이메일이면 ValidationException을 던져야 한다", () => {
            // Given
            const rawEmail = "us er@example.com"

            // When & Then
            expect(() => Email.create(rawEmail)).toThrow(ValidationException)
            expect(() => Email.create(rawEmail)).toThrow("validation.email.invalid_format")
        })

        it("254자를 초과하면 ValidationException을 던져야 한다", () => {
            // Given
            const localPart = "a".repeat(243)
            const rawEmail = `${localPart}@example.com` // 243 + 1 + 11 = 255자

            // When & Then
            expect(() => Email.create(rawEmail)).toThrow(ValidationException)
            expect(() => Email.create(rawEmail)).toThrow("validation.email.too_long")
        })

        it("정확히 254자인 이메일은 생성에 성공해야 한다", () => {
            // Given
            const localPart = "a".repeat(242)
            const rawEmail = `${localPart}@example.com` // 242 + 1 + 11 = 254자

            // When
            const email = Email.create(rawEmail)

            // Then
            expect(email.value).toBe(rawEmail.toLowerCase())
            expect(email.value.length).toBe(254)
        })
    })

    describe("value (값 접근)", () => {
        it("생성 시 전달한 이메일 값을 반환해야 한다", () => {
            // Given
            const rawEmail = "user@example.com"

            // When
            const email = Email.create(rawEmail)

            // Then
            expect(email.value).toBe("user@example.com")
        })
    })

    describe("equals (동등 비교)", () => {
        it("같은 값을 가진 두 Email은 동등해야 한다", () => {
            // Given
            const email1 = Email.create("user@example.com")
            const email2 = Email.create("user@example.com")

            // When
            const result = email1.equals(email2)

            // Then
            expect(result).toBe(true)
        })

        it("대소문자가 다른 같은 이메일은 동등해야 한다", () => {
            // Given
            const email1 = Email.create("User@Example.COM")
            const email2 = Email.create("user@example.com")

            // When
            const result = email1.equals(email2)

            // Then
            expect(result).toBe(true)
        })

        it("다른 값을 가진 두 Email은 동등하지 않아야 한다", () => {
            // Given
            const email1 = Email.create("user1@example.com")
            const email2 = Email.create("user2@example.com")

            // When
            const result = email1.equals(email2)

            // Then
            expect(result).toBe(false)
        })

        it("null이 전달되면 false를 반환해야 한다", () => {
            // Given
            const email = Email.create("user@example.com")

            // When
            const result = email.equals(null as unknown as Email)

            // Then
            expect(result).toBe(false)
        })

        it("undefined가 전달되면 false를 반환해야 한다", () => {
            // Given
            const email = Email.create("user@example.com")

            // When
            const result = email.equals(undefined as unknown as Email)

            // Then
            expect(result).toBe(false)
        })
    })

    describe("toString (문자열 변환)", () => {
        it("이메일 값을 문자열로 반환해야 한다", () => {
            // Given
            const email = Email.create("user@example.com")

            // When
            const result = email.toString()

            // Then
            expect(result).toBe("user@example.com")
        })

        it("value 게터와 동일한 값을 반환해야 한다", () => {
            // Given
            const email = Email.create("Test@Example.COM")

            // When & Then
            expect(email.toString()).toBe(email.value)
        })
    })

    describe("불변성 (Immutability)", () => {
        it("같은 입력으로 생성한 두 Email은 독립된 인스턴스여야 한다", () => {
            // Given
            const email1 = Email.create("user@example.com")
            const email2 = Email.create("user@example.com")

            // When & Then
            expect(email1).not.toBe(email2)
            expect(email1.equals(email2)).toBe(true)
        })
    })
})
