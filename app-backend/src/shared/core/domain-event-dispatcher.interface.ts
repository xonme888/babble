import { DomainEvent } from "./domain-event"
import type { DomainEventType } from "./constants/domain-event-types"

/**
 * 도메인 이벤트 핸들러 인터페이스
 */
export interface IDomainEventHandler<T extends DomainEvent> {
    /**
     * 이벤트 처리
     */
    handle(event: T): Promise<void>

    /**
     * 이 핸들러가 처리할 이벤트 타입
     */
    eventType(): DomainEventType
}

/**
 * 도메인 이벤트 디스패처 인터페이스
 */
export interface IDomainEventDispatcher {
    /**
     * 이벤트 핸들러 등록
     */
    register<T extends DomainEvent>(eventType: string, handler: IDomainEventHandler<T>): void

    /**
     * 이벤트 발행
     */
    dispatch(event: DomainEvent): Promise<void>

    /**
     * 여러 이벤트를 한번에 발행
     */
    dispatchAll(events: readonly DomainEvent[]): Promise<void>

    /**
     * 이벤트 발행 (비동기 - 백그라운드)
     * 즉시 반환하고 백그라운드에서 핸들러 실행
     */
    dispatchAsync(event: DomainEvent): void

    /**
     * Aggregate에서 이벤트를 추출하여 비동기 발행
     */
    publishFromAggregate(aggregate: {
        getDomainEvents(): readonly DomainEvent[] | DomainEvent[]
        clearDomainEvents(): void
    }): void
}
