import { BaseDomainEvent } from "@shared/core/domain-event"

/**
 * 이메일 인증됨 이벤트 (Domain Event)
 *
 * 사용자가 이메일 인증을 완료했을 때 발행
 *
 * 이벤트 핸들러:
 * - 환영 이메일 발송
 * - 사용자 통계 업데이트
 * - 로깅
 */
export class EmailVerifiedEvent extends BaseDomainEvent {
    constructor(
        public readonly userId: number,
        public readonly email: string
    ) {
        super(userId)
    }
}
