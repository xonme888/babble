import { ValidationException } from "@shared/core/exceptions/domain-exceptions"
import type { IPasswordHasher } from "@shared/core/password-hasher.interface"

/**
 * Password Value Object (DDD)
 *
 * 도메인 규칙:
 * - 8-20자 길이
 * - 대문자 포함
 * - 소문자 포함
 * - 숫자 포함
 * - 특수문자 포함
 * - 항상 해시된 상태로 저장
 * - 불변성(immutable)
 *
 * 해싱은 Application Service에서 IPasswordHasher를 통해 수행
 */
export class Password {
    /** 비밀번호 최소 길이 */
    private static readonly MIN_LENGTH = 8
    /** 비밀번호 최대 길이 */
    private static readonly MAX_LENGTH = 20

    private readonly hashedValue: string

    private constructor(hashedValue: string) {
        this.hashedValue = hashedValue
    }

    /**
     * 평문 비밀번호의 도메인 규칙 검증 (해싱 없이 검증만 수행)
     */
    static validate(password: string): void {
        if (!password) {
            throw new ValidationException("validation.password.empty")
        }

        if (password.length < Password.MIN_LENGTH || password.length > Password.MAX_LENGTH) {
            throw new ValidationException("validation.password.length")
        }

        if (!/[A-Z]/.test(password)) {
            throw new ValidationException("validation.password.uppercase")
        }

        if (!/[a-z]/.test(password)) {
            throw new ValidationException("validation.password.lowercase")
        }

        if (!/[0-9]/.test(password)) {
            throw new ValidationException("validation.password.digit")
        }

        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            throw new ValidationException("validation.password.special")
        }
    }

    /**
     * 평문 비밀번호를 검증 + 해시하여 Password 객체 생성
     */
    static async createHashed(raw: string, hasher: IPasswordHasher): Promise<Password> {
        Password.validate(raw)
        const hashed = await hasher.hash(raw)
        return Password.fromHash(hashed)
    }

    /**
     * DB에서 로드된 해시값으로 Password 객체 생성
     * (이미 해시된 값이므로 검증 불필요)
     */
    static fromHash(hashedValue: string): Password {
        if (!hashedValue) {
            throw new ValidationException("validation.password.empty_hash")
        }
        return new Password(hashedValue)
    }

    /**
     * 해시된 값 반환 (DB 저장용)
     */
    get value(): string {
        return this.hashedValue
    }

    /**
     * 문자열로 변환 시에도 해시값만 노출 (보안)
     */
    toString(): string {
        return "[PROTECTED]"
    }
}
