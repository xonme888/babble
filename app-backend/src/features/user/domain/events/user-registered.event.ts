import { BaseDomainEvent } from "@shared/core/domain-event"

/**
 * 사용자 등록됨 이벤트 (Domain Event)
 *
 * 사용자가 성공적으로 등록되었을 때 발행
 *
 * 이벤트 핸들러:
 * - 환영 이메일 발송
 * - 사용자 통계 초기화
 * - 로깅
 */
export class UserRegisteredEvent extends BaseDomainEvent {
    constructor(
        public readonly userId: number,
        public readonly email: string,
        public readonly firstName: string,
        public readonly lastName: string | null
    ) {
        super(userId)
    }
}
