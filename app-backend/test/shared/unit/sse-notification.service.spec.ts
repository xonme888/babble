import "reflect-metadata"
import { SSENotificationService } from "@shared/infra/notifications/sse-notification.service"
import { createMockLogger } from "../../utils/mock-factories"
import { EventEmitter } from "events"
import type { Response } from "express"

/**
 * SSENotificationService 단위 테스트
 *
 * userId 기반 클라이언트 관리, notifyUser/notifyAll, 연결 제한, heartbeat 검증
 */

/** 가짜 Response 생성 — EventEmitter 기반 */
function createMockResponse(overrides?: Partial<Response>): jest.Mocked<Response> {
    const emitter = new EventEmitter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = {
        write: jest.fn().mockReturnValue(true),
        end: jest.fn(),
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        setTimeout: jest.fn(),
        writableEnded: false,
        destroyed: false,
        on: jest.fn((event: string, cb: (...args: unknown[]) => void): any => {
            emitter.on(event, cb)
            return res
        }),
        // close 이벤트 트리거 헬퍼
        _emitClose: () => emitter.emit("close"),
        ...overrides,
    }
    return res as unknown as jest.Mocked<Response>
}

describe("SSENotificationService", () => {
    let service: SSENotificationService
    let mockLogger: ReturnType<typeof createMockLogger>

    beforeEach(() => {
        mockLogger = createMockLogger()
        service = new (class extends SSENotificationService {
            constructor() {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                super(mockLogger as any)
            }
        })()
    })

    describe("addClient", () => {
        it("userId로 클라이언트를 등록한다", () => {
            const res = createMockResponse()
            service.addClient(1, res)
            expect(service.clientCount).toBe(1)
        })

        it("동일 userId로 여러 연결을 등록한다", () => {
            const res1 = createMockResponse()
            const res2 = createMockResponse()
            service.addClient(1, res1)
            service.addClient(1, res2)
            expect(service.clientCount).toBe(2)
        })

        it("사용자당 최대 2개 연결을 초과하면 오래된 연결을 제거한다", () => {
            const res1 = createMockResponse()
            const res2 = createMockResponse()
            const res3 = createMockResponse()

            service.addClient(1, res1)
            service.addClient(1, res2)
            service.addClient(1, res3)

            // res1이 제거되고 res2, res3만 남음
            expect(res1.end).toHaveBeenCalled()
            expect(service.clientCount).toBe(2)
        })

        it("연결 종료(close) 시 클라이언트를 자동 제거한다", () => {
            const res = createMockResponse()
            service.addClient(1, res)
            expect(service.clientCount).toBe(1)

            // close 이벤트 트리거
            ;(res as unknown)._emitClose()
            expect(service.clientCount).toBe(0)
        })
    })

    describe("notifyUser", () => {
        it("특정 userId의 클라이언트에만 이벤트를 전송한다", () => {
            const res1 = createMockResponse()
            const res2 = createMockResponse()
            service.addClient(1, res1)
            service.addClient(2, res2)

            service.notifyUser(1, "assessment_updated", { assessmentId: 10 })

            expect(res1.write).toHaveBeenCalledWith(expect.stringContaining("assessment_updated"))
            // 초기 연결 메시지 외에는 호출 없음
            expect(res2.write).not.toHaveBeenCalledWith(
                expect.stringContaining("assessment_updated")
            )
        })

        it("존재하지 않는 userId에 대해 에러 없이 무시한다", () => {
            expect(() => {
                service.notifyUser(999, "test", { data: "value" })
            }).not.toThrow()
        })

        it("죽은 클라이언트(writableEnded)를 자동 제거한다", () => {
            const res = createMockResponse({ writableEnded: true })
            service.addClient(1, res)

            service.notifyUser(1, "test", {})

            // writableEnded 클라이언트는 write 호출 없이 제거
            expect(res.write).not.toHaveBeenCalledWith(expect.stringContaining("test"))
        })
    })

    describe("notifyAll", () => {
        it("모든 사용자 클라이언트에 이벤트를 전송한다", () => {
            const res1 = createMockResponse()
            const res2 = createMockResponse()
            service.addClient(1, res1)
            service.addClient(2, res2)

            service.notifyAll("broadcast_event", { message: "hello" })

            expect(res1.write).toHaveBeenCalledWith(expect.stringContaining("broadcast_event"))
            expect(res2.write).toHaveBeenCalledWith(expect.stringContaining("broadcast_event"))
        })

        it("admin 클라이언트에도 이벤트를 전송한다", () => {
            const adminRes = createMockResponse()
            service.addAdminClient(adminRes)

            service.notifyAll("admin_event", { count: 5 })

            expect(adminRes.write).toHaveBeenCalledWith(expect.stringContaining("admin_event"))
        })
    })

    describe("addAdminClient", () => {
        it("admin 클라이언트를 별도 관리한다", () => {
            const adminRes = createMockResponse()
            service.addAdminClient(adminRes)

            // admin은 clientCount에 포함
            expect(service.clientCount).toBe(1)
        })

        it("close 시 admin 클라이언트를 제거한다", () => {
            const adminRes = createMockResponse()
            service.addAdminClient(adminRes)
            ;(adminRes as unknown)._emitClose()
            expect(service.clientCount).toBe(0)
        })
    })

    describe("clientCount", () => {
        it("사용자 + admin 연결 수의 합산을 반환한다", () => {
            const userRes = createMockResponse()
            const adminRes = createMockResponse()

            service.addClient(1, userRes)
            service.addAdminClient(adminRes)

            expect(service.clientCount).toBe(2)
        })
    })
})
