import { BaseDomainEvent } from "@shared/core/domain-event"

/**
 * Assessment Failed Event
 *
 * AI 분석이 실패했을 때 발행
 * → 재시도 로직, 에러 알림 등에 활용
 */
export class AssessmentFailedEvent extends BaseDomainEvent {
    constructor(
        public readonly assessmentId: number,
        public readonly userId: number | null,
        public readonly error: string,
        public readonly attemptNumber: number,
        public readonly maxRetryExceeded: boolean
    ) {
        super(assessmentId)
    }
}
