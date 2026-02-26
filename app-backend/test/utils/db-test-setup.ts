/**
 * Integration/E2E 테스트 공통 jest.mock 설정
 *
 * jest.config.js의 setupFilesAfterEnv에 등록되어, 테스트 파일 로드 전에 실행된다.
 * 3가지 외부 의존성(Notification, Redis, BullMQ)을 모킹하여
 * 실제 연결 없이 테스트를 실행할 수 있게 한다.
 */

export const mockSendNotification = jest.fn()

// 1. NotificationService — 실제 이메일 발송 방지
jest.mock("@features/notification/application/notification.service", () => ({
    NotificationService: jest.fn().mockImplementation(() => ({
        send: mockSendNotification,
    })),
}))

// 2. RedisService — setupDI() 중 실제 Redis 연결 방지
jest.mock("@shared/infra/persistence/redis/redis-service", () => ({
    RedisService: jest.fn().mockImplementation(() => ({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue(false),
        ttl: jest.fn().mockResolvedValue(-1),
        increment: jest.fn().mockResolvedValue(1),
        rpush: jest.fn().mockResolvedValue(1),
        lpop: jest.fn().mockResolvedValue(null),
        blpop: jest.fn().mockResolvedValue(null),
        llen: jest.fn().mockResolvedValue(0),
        publish: jest.fn().mockResolvedValue(0),
        getDuplicateClient: jest.fn().mockReturnValue({ subscribe: jest.fn(), on: jest.fn() }),
        setRequired: jest.fn().mockResolvedValue(undefined),
        getRequired: jest.fn().mockResolvedValue(null),
        deleteRequired: jest.fn().mockResolvedValue(undefined),
        getAndDeleteRequired: jest.fn().mockResolvedValue(null),
        incrementRequired: jest.fn().mockResolvedValue(1),
        incrWithExpire: jest.fn().mockResolvedValue(1),
        existsRequired: jest.fn().mockResolvedValue(false),
        acquireLock: jest.fn().mockResolvedValue(jest.fn()),
        isAvailable: jest.fn().mockReturnValue(true),
        ping: jest.fn().mockResolvedValue("PONG"),
    })),
}))

// 3. BullMQ — 모듈 레벨 Queue 인스턴스의 실제 Redis 연결 방지
jest.mock("bullmq", () => ({
    Queue: jest.fn().mockImplementation(() => ({
        add: jest.fn().mockResolvedValue({ id: "job-mock" }),
        on: jest.fn(),
        close: jest.fn(),
    })),
    Worker: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        close: jest.fn(),
    })),
}))

/**
 * mockSendNotification에서 인증 코드를 추출한다.
 * 가장 마지막으로 발송된 알림의 본문에서 6자리 코드를 파싱한다.
 *
 * @param mockFn mockSendNotification (기본값: 모듈 레벨 mockSendNotification)
 * @returns 6자리 인증 코드 문자열
 * @throws 코드가 없거나 호출 이력이 없으면 에러
 */
export function extractVerificationCode(mockFn: jest.Mock = mockSendNotification): string {
    if (mockFn.mock.calls.length === 0) {
        throw new Error("mockSendNotification 호출 이력이 없습니다")
    }
    const content = mockFn.mock.calls[mockFn.mock.calls.length - 1][2]
    const match = content.match(/인증 코드: (\d+)/)
    if (!match) {
        throw new Error("인증 코드를 추출할 수 없습니다")
    }
    return match[1]
}
