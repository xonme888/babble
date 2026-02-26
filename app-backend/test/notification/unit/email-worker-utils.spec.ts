import "reflect-metadata"

/**
 * email.worker.ts 내 순수 함수 테스트
 *
 * createEmailWorker()는 BullMQ Worker를 생성하여 Redis 연결이 필요하므로,
 * 모듈 스코프에서 분리 가능한 순수 함수만 테스트한다.
 * isFatalSmtpError, decryptJobData는 모듈 내 비공개 함수이므로
 * 동일한 로직을 재현하여 테스트한다.
 */

/** SMTP 치명적 에러 판별 — email.worker.ts L25-27 동일 로직 */
const FATAL_SMTP_PATTERNS = [
    "Invalid login",
    "BadCredentials",
    "Username and Password not accepted",
    "535-5.7.8",
] as const

function isFatalSmtpError(message: string): boolean {
    return FATAL_SMTP_PATTERNS.some((pattern) => message.includes(pattern))
}

describe("isFatalSmtpError (SMTP 치명적 에러 판별)", () => {
    it.each([
        ["Invalid login: credentials rejected", true],
        ["BadCredentials: authentication failed", true],
        ["Username and Password not accepted - try again", true],
        ["535-5.7.8 authentication failed", true],
    ])("'%s' → %s", (message, expected) => {
        expect(isFatalSmtpError(message)).toBe(expected)
    })

    it.each([
        ["Connection timeout", false],
        ["ECONNREFUSED", false],
        ["Temporary failure in name resolution", false],
        ["Rate limit exceeded", false],
    ])("'%s' → %s (재시도 가능한 에러)", (message, expected) => {
        expect(isFatalSmtpError(message)).toBe(expected)
    })
})

/** 조건부 복호화 — email.worker.ts L30-44 동일 로직 */
describe("decryptJobData (조건부 복호화)", () => {
    function decryptJobData(jobData: {
        to: string
        subject: string
        content: string
        encrypted?: boolean
    }): { to: string; subject: string; content: string } {
        if (!jobData.encrypted) {
            return { to: jobData.to, subject: jobData.subject, content: jobData.content }
        }
        // 실제 QueueCrypto.decrypt는 암호문을 복호화하지만,
        // 여기서는 비암호화 경로만 테스트 (QueueCrypto는 별도 테스트 존재)
        return { to: jobData.to, subject: jobData.subject, content: jobData.content }
    }

    it("encrypted 플래그가 없으면 원본 데이터를 그대로 반환해야 한다", () => {
        // Given
        const data = { to: "a@b.com", subject: "Hi", content: "<p>Hello</p>" }

        // When
        const result = decryptJobData(data)

        // Then
        expect(result).toEqual({ to: "a@b.com", subject: "Hi", content: "<p>Hello</p>" })
    })

    it("encrypted=false이면 원본 데이터를 그대로 반환해야 한다", () => {
        // Given
        const data = { to: "a@b.com", subject: "Hi", content: "<p>Hello</p>", encrypted: false }

        // When
        const result = decryptJobData(data)

        // Then
        expect(result).toEqual({ to: "a@b.com", subject: "Hi", content: "<p>Hello</p>" })
    })
})

export {}
