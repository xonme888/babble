import { randomInt } from "crypto"

/**
 * VerificationCode (Domain Value Object)
 * 6자리 인증 코드 생성 규칙
 */
export class VerificationCode {
    private static readonly DIGITS = 6
    private static readonly MIN = 10 ** (VerificationCode.DIGITS - 1)
    private static readonly MAX = 10 ** VerificationCode.DIGITS - 1

    /** 6자리 랜덤 숫자 코드 생성 */
    static generate(): string {
        return randomInt(VerificationCode.MIN, VerificationCode.MAX).toString()
    }
}
