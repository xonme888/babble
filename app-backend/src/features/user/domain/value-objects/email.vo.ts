import { ValidationException } from "@shared/core/exceptions/domain-exceptions"

/**
 * Email Value Object (DDD)
 *
 * 도메인 규칙:
 * - 올바른 이메일 형식
 * - 소문자로 정규화
 * - 불변성(immutable)
 * - 최대 254자 (RFC 5321)
 */
export class Email {
    /** RFC 5321 최대 이메일 길이 */
    private static readonly MAX_LENGTH = 254

    private readonly _value: string

    private constructor(value: string) {
        this._value = value
    }

    /**
     * 이메일 생성 (도메인 규칙 검증)
     */
    static create(email: string): Email {
        if (!email) {
            throw new ValidationException("validation.email.empty")
        }

        const trimmedEmail = email.trim()

        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(trimmedEmail)) {
            throw new ValidationException("validation.email.invalid_format")
        }

        // 이메일 길이 검증 (RFC 5321)
        if (trimmedEmail.length > Email.MAX_LENGTH) {
            throw new ValidationException("validation.email.too_long")
        }

        return new Email(trimmedEmail.toLowerCase())
    }

    /**
     * 이메일 값 반환 (읽기 전용)
     */
    get value(): string {
        return this._value
    }

    /**
     * 두 이메일이 동일한지 비교
     */
    equals(other: Email): boolean {
        if (!other) {
            return false
        }
        return this._value === other._value
    }

    /**
     * 문자열 표현
     */
    toString(): string {
        return this._value
    }
}
