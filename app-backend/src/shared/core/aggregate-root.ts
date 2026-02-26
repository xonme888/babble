import { DomainEvent } from "./domain-event"
import { BaseAuditEntity } from "./entity/base-audit-entity"

/**
 * Aggregate Root 추상 클래스
 *
 * BaseAuditEntity(id + createdAt + updatedAt) + 도메인 이벤트 수집/조회/초기화.
 * TypeORM은 미장식(un-decorated) 필드를 무시하므로 _domainEvents는 DB에 저장되지 않는다.
 */
export abstract class AggregateRoot extends BaseAuditEntity {
    private _domainEvents: DomainEvent[] = []

    protected addDomainEvent(event: DomainEvent): void {
        this._domainEvents.push(event)
    }

    getDomainEvents(): ReadonlyArray<DomainEvent> {
        return [...this._domainEvents]
    }

    clearDomainEvents(): void {
        this._domainEvents = []
    }
}
