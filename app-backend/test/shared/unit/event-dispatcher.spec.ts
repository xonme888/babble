import "reflect-metadata"
import { EventDispatcher } from "@shared/lib/events/event-dispatcher"
import type { DomainEvent } from "@shared/core/domain-event"
import { createMockLogger } from "../../utils/mock-factories"

export {}

function createTestEvent(data: string): DomainEvent {
    return { eventType: "TestEvent", occurredAt: new Date(), aggregateId: data }
}

function createOtherEvent(): DomainEvent {
    return { eventType: "OtherEvent", occurredAt: new Date() }
}

describe("EventDispatcher (이벤트 디스패처)", () => {
    let dispatcher: EventDispatcher

    beforeEach(() => {
        const logger = createMockLogger()
        dispatcher = new EventDispatcher(logger)
    })

    describe("register + dispatch", () => {
        it("등록된 핸들러에 이벤트를 전달한다", async () => {
            // Given
            const handler = { eventType: () => "TestEvent", handle: jest.fn() }
            dispatcher.register("TestEvent", handler)

            // When
            await dispatcher.dispatch(createTestEvent("hello"))

            // Then
            expect(handler.handle).toHaveBeenCalledWith(
                expect.objectContaining({ aggregateId: "hello", eventType: "TestEvent" })
            )
        })

        it("같은 이벤트에 여러 핸들러를 등록하면 모두 실행된다", async () => {
            // Given
            const handler1 = { eventType: () => "TestEvent", handle: jest.fn() }
            const handler2 = { eventType: () => "TestEvent", handle: jest.fn() }
            dispatcher.register("TestEvent", handler1)
            dispatcher.register("TestEvent", handler2)

            // When
            await dispatcher.dispatch(createTestEvent("data"))

            // Then
            expect(handler1.handle).toHaveBeenCalled()
            expect(handler2.handle).toHaveBeenCalled()
        })

        it("핸들러가 없는 이벤트를 dispatch하면 조용히 무시한다", async () => {
            // When & Then — 에러 없이 완료
            await expect(dispatcher.dispatch(createTestEvent("data"))).resolves.toBeUndefined()
        })

        it("핸들러 에러가 발생해도 다른 핸들러는 계속 실행된다", async () => {
            // Given
            const failHandler = {
                eventType: () => "TestEvent",
                handle: jest.fn().mockRejectedValue(new Error("fail")),
            }
            const successHandler = { eventType: () => "TestEvent", handle: jest.fn() }
            dispatcher.register("TestEvent", failHandler)
            dispatcher.register("TestEvent", successHandler)

            // When
            await dispatcher.dispatch(createTestEvent("data"))

            // Then
            expect(failHandler.handle).toHaveBeenCalled()
            expect(successHandler.handle).toHaveBeenCalled()
        })

        it("핸들러 실패 시 핸들러 이름을 포함한 에러 로그를 남긴다", async () => {
            // Given
            const logger = createMockLogger()
            const localDispatcher = new EventDispatcher(logger)

            class FailingTestHandler {
                eventType() { return "TestEvent" }
                handle = jest.fn().mockRejectedValue(new Error("fail"))
            }

            const failHandler = new FailingTestHandler()
            localDispatcher.register("TestEvent", failHandler)

            // When
            await localDispatcher.dispatch(createTestEvent("data"))

            // Then — 에러 로그에 핸들러 이름 포함
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("FailingTestHandler"),
                expect.any(Error)
            )
        })
    })

    describe("dispatchAll", () => {
        it("여러 이벤트를 순서대로 발행한다", async () => {
            // Given
            const handler = { eventType: () => "TestEvent", handle: jest.fn() }
            dispatcher.register("TestEvent", handler)

            // When
            await dispatcher.dispatchAll([createTestEvent("a"), createTestEvent("b")])

            // Then
            expect(handler.handle).toHaveBeenCalledTimes(2)
        })
    })

    describe("dispatchAsync", () => {
        it("백그라운드에서 핸들러를 실행한다", async () => {
            // Given
            const handler = { eventType: () => "TestEvent", handle: jest.fn() }
            dispatcher.register("TestEvent", handler)

            // When
            dispatcher.dispatchAsync(createTestEvent("async"))

            // Then — setImmediate 후 실행
            await new Promise((r) => setImmediate(r))
            expect(handler.handle).toHaveBeenCalled()
        })

        it("핸들러가 없는 이벤트는 조용히 무시한다", () => {
            // When & Then — 에러 없이 완료
            expect(() => dispatcher.dispatchAsync(createOtherEvent())).not.toThrow()
        })
    })

    describe("publishFromAggregate", () => {
        it("aggregate의 이벤트를 발행하고 clearDomainEvents를 호출한다", async () => {
            // Given
            const handler = { eventType: () => "TestEvent", handle: jest.fn() }
            dispatcher.register("TestEvent", handler)

            const aggregate = {
                getDomainEvents: jest.fn().mockReturnValue([createTestEvent("agg")]),
                clearDomainEvents: jest.fn(),
            }

            // When
            dispatcher.publishFromAggregate(aggregate)

            // Then
            expect(aggregate.clearDomainEvents).toHaveBeenCalled()
            await new Promise((r) => setImmediate(r))
            expect(handler.handle).toHaveBeenCalled()
        })
    })

    describe("executeWithTimeout (핸들러 타임아웃)", () => {
        it("30초 초과 시 타임아웃 에러를 발생시킨다", async () => {
            // Given
            jest.useFakeTimers()
            const logger = createMockLogger()
            const localDispatcher = new EventDispatcher(logger)

            const slowHandler = {
                eventType: () => "TestEvent",
                handle: jest.fn().mockImplementation(
                    () => new Promise(() => {/* 영원히 resolve되지 않음 */})
                ),
            }
            localDispatcher.register("TestEvent", slowHandler)

            // When
            const dispatchPromise = localDispatcher.dispatch(createTestEvent("timeout"))
            jest.advanceTimersByTime(30_000)
            await dispatchPromise

            // Then — 타임아웃 에러 로그
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("핸들러 실패"),
                expect.objectContaining({ message: expect.stringContaining("타임아웃") })
            )

            jest.useRealTimers()
        })
    })

    describe("getHandlerCount + clear", () => {
        it("등록된 핸들러 수를 반환한다", () => {
            dispatcher.register("TestEvent", { eventType: () => "TestEvent", handle: jest.fn() })
            dispatcher.register("TestEvent", { eventType: () => "TestEvent", handle: jest.fn() })

            expect(dispatcher.getHandlerCount("TestEvent")).toBe(2)
            expect(dispatcher.getHandlerCount("Unknown")).toBe(0)
        })

        it("clear()로 모든 핸들러를 제거한다", () => {
            dispatcher.register("TestEvent", { eventType: () => "TestEvent", handle: jest.fn() })
            dispatcher.clear()

            expect(dispatcher.getHandlerCount("TestEvent")).toBe(0)
        })
    })
})
