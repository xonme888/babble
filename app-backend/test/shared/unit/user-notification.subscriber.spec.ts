import { EventEmitter } from "events"
import { createMockLogger, createMockRedisService } from "../../utils/mock-factories"

/**
 * UserNotificationSubscriber 단위 테스트
 *
 * Redis Pub/Sub 메시지를 파싱하여 IRealtimeNotifier.notifyUser에 전달하는 로직 검증
 */

// DI 컨테이너 모킹
const mockLogger = createMockLogger()
const mockRedisService = createMockRedisService()
const mockNotifier = {
    addClient: jest.fn(),
    notifyUser: jest.fn(),
    notifyAll: jest.fn(),
    clientCount: 0,
}

// 가짜 subscribe 클라이언트 (EventEmitter 기반)
const fakeSubClient = new EventEmitter()
Object.assign(fakeSubClient, {
    subscribe: jest.fn((_channel: string, cb?: (err: Error | null) => void) => {
        cb?.(null)
    }),
    unsubscribe: jest.fn(),
    quit: jest.fn(),
})
mockRedisService.getDuplicateClient.mockReturnValue(fakeSubClient)

jest.mock("tsyringe", () => ({
    container: {
        resolve: jest.fn((token: string) => {
            switch (token) {
                case "ILogger":
                    return mockLogger
                case "IRedisService":
                    return mockRedisService
                case "IRealtimeNotifier":
                    return mockNotifier
                default:
                    throw new Error(`Unknown token: ${token}`)
            }
        }),
    },
}))

// SSE_ASSESSMENT_UPDATED_CHANNEL 모킹
jest.mock("@features/assessment/worker/analysis-result.subscriber", () => ({
    SSE_ASSESSMENT_UPDATED_CHANNEL: "sse:assessment:updated",
}))

import { createUserNotificationSubscriber } from "@shared/infra/notifications/user-notification.subscriber"

describe("UserNotificationSubscriber", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        fakeSubClient.removeAllListeners()
        mockRedisService.getDuplicateClient.mockReturnValue(fakeSubClient)
    })

    it("sse:assessment:updated 채널을 구독한다", () => {
        createUserNotificationSubscriber()
        expect(fakeSubClient.subscribe).toHaveBeenCalledWith(
            "sse:assessment:updated",
            expect.any(Function)
        )
    })

    it("유효한 메시지 수신 시 notifyUser를 호출한다", () => {
        createUserNotificationSubscriber()

        const message = JSON.stringify({
            userId: 42,
            assessmentId: 100,
            status: "COMPLETED",
        })
        fakeSubClient.emit("message", "sse:assessment:updated", message)

        expect(mockNotifier.notifyUser).toHaveBeenCalledWith(42, "assessment_updated", {
            assessmentId: 100,
            status: "COMPLETED",
        })
    })

    it("다른 채널의 메시지는 무시한다", () => {
        createUserNotificationSubscriber()

        fakeSubClient.emit("message", "other:channel", JSON.stringify({ userId: 1 }))

        expect(mockNotifier.notifyUser).not.toHaveBeenCalled()
    })

    it("userId 누락 메시지는 warn 로그 후 무시한다", () => {
        createUserNotificationSubscriber()

        const message = JSON.stringify({ assessmentId: 100, status: "COMPLETED" })
        fakeSubClient.emit("message", "sse:assessment:updated", message)

        expect(mockNotifier.notifyUser).not.toHaveBeenCalled()
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("userId 누락"))
    })

    it("잘못된 JSON 메시지는 error 로그 후 무시한다", () => {
        createUserNotificationSubscriber()

        fakeSubClient.emit("message", "sse:assessment:updated", "invalid-json{")

        expect(mockNotifier.notifyUser).not.toHaveBeenCalled()
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("파싱 실패"))
    })

    it("close() 호출 시 구독 해제 및 클라이언트 종료", async () => {
        const subscriber = createUserNotificationSubscriber()
        await subscriber.close()

        expect(fakeSubClient.unsubscribe).toHaveBeenCalledWith("sse:assessment:updated")
        expect(fakeSubClient.quit).toHaveBeenCalled()
    })
})
