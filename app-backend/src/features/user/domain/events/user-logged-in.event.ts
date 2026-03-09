import { BaseDomainEvent } from "@shared/core/domain-event"

/**
 * 사용자 로그인됨 이벤트 (Domain Event)
 *
 * 사용자가 성공적으로 로그인했을 때 발행
 *
 * 이벤트 핸들러:
 * - 로그인 이력 기록
 * - 보안 로깅
 * - 통계 업데이트
 */
export class UserLoggedInEvent extends BaseDomainEvent {
    constructor(
        public readonly userId: number,
        public readonly email: string,
        public readonly loginMethod: string,
        public readonly ipAddress?: string
    ) {
        super(userId)
    }
}
