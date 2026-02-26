import { QueueCrypto } from "@shared/utils/queue-crypto.utils"

describe("QueueCrypto (큐 데이터 암호화)", () => {
    beforeAll(() => {
        QueueCrypto.initialize(undefined, "test-secret-key")
    })

    describe("encrypt → decrypt 라운드트립", () => {
        it("암호화 후 복호화하면 원본 문자열을 반환한다", () => {
            const plaintext = "test@example.com"
            const encrypted = QueueCrypto.encrypt(plaintext)
            const decrypted = QueueCrypto.decrypt(encrypted)

            expect(decrypted).toBe(plaintext)
        })

        it("빈 문자열도 라운드트립이 가능하다", () => {
            const encrypted = QueueCrypto.encrypt("")
            const decrypted = QueueCrypto.decrypt(encrypted)
            expect(decrypted).toBe("")
        })

        it("한국어 문자열을 올바르게 처리한다", () => {
            const plaintext = "인증 코드: 123456"
            const encrypted = QueueCrypto.encrypt(plaintext)
            const decrypted = QueueCrypto.decrypt(encrypted)
            expect(decrypted).toBe(plaintext)
        })

        it("긴 HTML 콘텐츠를 올바르게 처리한다", () => {
            const html = "<h1>이메일 제목</h1><p>본문 내용이 여기에 들어갑니다.</p>".repeat(10)
            const encrypted = QueueCrypto.encrypt(html)
            const decrypted = QueueCrypto.decrypt(encrypted)
            expect(decrypted).toBe(html)
        })
    })

    describe("encrypt (암호화)", () => {
        it("iv:authTag:ciphertext 형식을 반환한다", () => {
            const encrypted = QueueCrypto.encrypt("test")
            const parts = encrypted.split(":")
            expect(parts).toHaveLength(3)
        })

        it("같은 평문을 암호화해도 매번 다른 결과를 생성한다 (랜덤 IV)", () => {
            const plaintext = "same-text"
            const encrypted1 = QueueCrypto.encrypt(plaintext)
            const encrypted2 = QueueCrypto.encrypt(plaintext)
            expect(encrypted1).not.toBe(encrypted2)
        })
    })

    describe("initialize (초기화 검증)", () => {
        it("encryptionKey와 jwtSecret 모두 빈 문자열이면 에러를 던진다", () => {
            expect(() => QueueCrypto.initialize("", "")).toThrow(
                "QUEUE_ENCRYPTION_KEY 또는 JWT_SECRET이 필요합니다",
            )
        })

        it("encryptionKey가 없어도 jwtSecret이 있으면 초기화된다", () => {
            expect(() => QueueCrypto.initialize(undefined, "fallback-secret")).not.toThrow()
        })
    })

    describe("decrypt (복호화)", () => {
        it("잘못된 형식이면 ValidationException을 던진다", () => {
            expect(() => QueueCrypto.decrypt("invalid-data")).toThrow()
        })

        it("콜론이 2개 미만이면 ValidationException을 던진다", () => {
            expect(() => QueueCrypto.decrypt("part1:part2")).toThrow()
        })
    })
})
