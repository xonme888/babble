import { BaseDomainEvent } from "@shared/core/domain-event"

/**
 * Assessment Analyzing Event
 *
 * AI 분석이 시작되었을 때 발행
 * → 로깅, 모니터링 등에 활용
 */
export class AssessmentAnalyzingEvent extends BaseDomainEvent {
    constructor(
        public readonly assessmentId: number,
        public readonly userId: number | null,
        public readonly audioUrl: string,
        public readonly attemptNumber: number
    ) {
        super(assessmentId)
    }
}
