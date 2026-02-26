import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "crypto"
import { ValidationException } from "@shared/core/exceptions/domain-exceptions"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const _AUTH_TAG_LENGTH = 16

/**
 * 큐 데이터 암호화/복호화 유틸리티
 * 이메일 본문 등 민감 데이터를 Redis 큐에 저장할 때 사용
 *
 * 키 우선순위: QUEUE_ENCRYPTION_KEY → JWT_SECRET (폴백)
 * 프로덕션에서는 반드시 별도 QUEUE_ENCRYPTION_KEY를 설정하여 JWT 키와 분리한다.
 */
export class QueueCrypto {
    private static secret: string | null = null

    /** DI 부트스트랩 시 호출하여 암호화 키를 설정한다 */
    static initialize(encryptionKey: string | undefined, jwtSecret: string): void {
        const key = encryptionKey || jwtSecret
        if (!key) {
            throw new Error(
                "[QueueCrypto] QUEUE_ENCRYPTION_KEY 또는 JWT_SECRET이 필요합니다 — 빈 키로 초기화 금지",
            )
        }
        this.secret = key
    }

    /** 키에서 파생된 salt — 고정 문자열 대신 키 기반 해시 사용 */
    private static deriveSalt(): string {
        if (!this.secret) {
            throw new Error("[QueueCrypto] 초기화되지 않음 — initialize()를 먼저 호출하세요")
        }
        return createHash("sha256").update(`queue-salt:${this.secret}`).digest("hex").slice(0, 16)
    }

    private static getKey(): Buffer {
        if (!this.secret) {
            throw new Error("[QueueCrypto] 초기화되지 않음 — initialize()를 먼저 호출하세요")
        }
        return scryptSync(this.secret, this.deriveSalt(), 32)
    }

    /**
     * 평문을 AES-256-GCM으로 암호화
     * @returns base64 인코딩된 암호문 (iv:authTag:ciphertext)
     */
    static encrypt(plaintext: string): string {
        const key = this.getKey()
        const iv = randomBytes(IV_LENGTH)
        const cipher = createCipheriv(ALGORITHM, key, iv)

        let encrypted = cipher.update(plaintext, "utf8", "base64")
        encrypted += cipher.final("base64")
        const authTag = cipher.getAuthTag()

        // iv:authTag:ciphertext 형식으로 결합
        return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`
    }

    /**
     * 암호문을 복호화
     * @param encryptedData base64 인코딩된 암호문 (iv:authTag:ciphertext)
     */
    static decrypt(encryptedData: string): string {
        const key = this.getKey()
        const parts = encryptedData.split(":")
        if (parts.length !== 3) {
            throw new ValidationException("queue.invalid_encrypted_data")
        }

        const iv = Buffer.from(parts[0], "base64")
        const authTag = Buffer.from(parts[1], "base64")
        const ciphertext = parts[2]

        const decipher = createDecipheriv(ALGORITHM, key, iv)
        decipher.setAuthTag(authTag)

        let decrypted = decipher.update(ciphertext, "base64", "utf8")
        decrypted += decipher.final("utf8")
        return decrypted
    }
}
