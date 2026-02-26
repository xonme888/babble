/**
 * EventDispatcher 호환용 re-export
 *
 * 정규 인터페이스는 `@shared/core/domain-event-dispatcher.interface`에 정의.
 * 이 파일은 EventDispatcher 구현체의 기존 import를 유지하기 위한 alias.
 */
export {
    IDomainEventHandler as IEventHandler,
    IDomainEventDispatcher as IEventDispatcher,
} from "@shared/core/domain-event-dispatcher.interface"
