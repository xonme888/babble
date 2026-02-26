/**
 * 도메인 이벤트 기본 인터페이스
 *
 * 모든 도메인 이벤트는 이 인터페이스를 구현해야 함
 */
export interface DomainEvent {
    /**
     * 이벤트 발생 시각
     */
    readonly occurredAt: Date

    /**
     * 이벤트 타입 (클래스명으로 식별)
     */
    readonly eventType: string

    /**
     * 이벤트와 관련된 Aggregate ID (선택)
     */
    readonly aggregateId?: string | number
}

/**
 * 도메인 이벤트 기본 구현
 */
export abstract class BaseDomainEvent implements DomainEvent {
    public readonly occurredAt: Date
    public readonly eventType: string

    constructor(public readonly aggregateId?: string | number) {
        this.occurredAt = new Date()
        this.eventType = this.constructor.name
    }
}
