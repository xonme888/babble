import { injectable, inject } from "tsyringe"
import { Counter } from "prom-client"
import { DomainEvent } from "@shared/core/domain-event"
import { IDomainEventDispatcher, IDomainEventHandler } from "@shared/core/domain-event-dispatcher.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { ILogger } from "@shared/core/logger.interface"

const eventHandlerFailures = new Counter({
    name: "domain_event_handler_failures_total",
    help: "도메인 이벤트 핸들러 실패 횟수",
    labelNames: ["event_type", "handler_name", "mode"] as const,
})

/**
 * Event Dispatcher Implementation
 *
 * 이벤트를 핸들러에게 전달하는 중앙 디스패처
 * - 동기/비동기 이벤트 발행 지원
 * - 여러 핸들러 등록 가능
 * - 에러 핸들링 포함
 */
@injectable()
export class EventDispatcher implements IDomainEventDispatcher {
    private handlers: Map<string, IDomainEventHandler<DomainEvent>[]> = new Map()

    constructor(@inject(DI_TOKENS.ILogger) private logger: ILogger) {}

    /**
     * 이벤트 핸들러 등록
     */
    register<T extends DomainEvent>(eventType: string, handler: IDomainEventHandler<T>): void {
        const existingHandlers = this.handlers.get(eventType) || []
        existingHandlers.push(handler as IDomainEventHandler<DomainEvent>)
        this.handlers.set(eventType, existingHandlers)

        this.logger.debug(`Registered handler for ${eventType}`)
    }

    /**
     * 이벤트 발행 (동기)
     *
     * 모든 핸들러가 완료될 때까지 대기
     */
    async dispatch(event: DomainEvent): Promise<void> {
        const eventType = event.eventType
        const handlers = this.handlers.get(eventType) || []

        if (handlers.length === 0) {
            this.logger.warn(`No handlers registered for ${eventType}`)
            return
        }

        this.logger.debug(`Dispatching ${eventType} to ${handlers.length} handler(s)`)

        for (const handler of handlers) {
            const handlerName = handler.constructor?.name ?? "unknown"
            try {
                await this.executeWithTimeout(handler, event)
            } catch (error) {
                eventHandlerFailures.inc({ event_type: eventType, handler_name: handlerName, mode: "sync" })
                this.logger.error(`[EventDispatcher] ${eventType} 핸들러 실패: ${handlerName}`, error)
            }
        }
    }

    /**
     * 이벤트 발행 (비동기 - 백그라운드)
     *
     * 즉시 반환하고 백그라운드에서 핸들러 실행
     */
    dispatchAsync(event: DomainEvent): void {
        const eventType = event.eventType
        const handlers = this.handlers.get(eventType) || []

        if (handlers.length === 0) {
            this.logger.warn(`No handlers registered for ${eventType}`)
            return
        }

        this.logger.debug(`Dispatching ${eventType} async to ${handlers.length} handler(s)`)

        setImmediate(async () => {
            for (const handler of handlers) {
                const handlerName = handler.constructor?.name ?? "unknown"
                try {
                    await this.executeWithTimeout(handler, event)
                } catch (error) {
                    eventHandlerFailures.inc({ event_type: eventType, handler_name: handlerName, mode: "async" })
                    this.logger.error(`[EventDispatcher] ${eventType} 핸들러 실패: ${handlerName}`, error)
                }
            }
        })
    }

    /**
     * 여러 이벤트 일괄 발행
     */
    async dispatchAll(events: readonly DomainEvent[]): Promise<void> {
        for (const event of events) {
            await this.dispatch(event)
        }
    }

    /**
     * 여러 이벤트 일괄 발행 (비동기)
     */
    dispatchAllAsync(events: DomainEvent[]): void {
        for (const event of events) {
            this.dispatchAsync(event)
        }
    }

    /**
     * Aggregate에서 이벤트를 추출하여 비동기 발행
     */
    publishFromAggregate(aggregate: {
        getDomainEvents(): readonly DomainEvent[] | DomainEvent[]
        clearDomainEvents(): void
    }): void {
        const events = aggregate.getDomainEvents()
        events.forEach((event) => {
            this.dispatchAsync(event)
        })
        aggregate.clearDomainEvents()
    }

    /** 핸들러 타임아웃 보호 — 30초 초과 시 에러 */
    private static readonly HANDLER_TIMEOUT_MS = 30_000

    private async executeWithTimeout(
        handler: IDomainEventHandler<DomainEvent>,
        event: DomainEvent
    ): Promise<void> {
        return Promise.race([
            handler.handle(event),
            new Promise<never>((_, reject) =>
                setTimeout(
                    () => reject(new Error(`핸들러 타임아웃: ${handler.constructor?.name} (${EventDispatcher.HANDLER_TIMEOUT_MS}ms)`)),
                    EventDispatcher.HANDLER_TIMEOUT_MS
                )
            ),
        ])
    }

    /**
     * 등록된 핸들러 수 조회 (테스트용)
     */
    getHandlerCount(eventType: string): number {
        return this.handlers.get(eventType)?.length || 0
    }

    /**
     * 모든 핸들러 제거 (테스트용)
     */
    clear(): void {
        this.handlers.clear()
    }
}
