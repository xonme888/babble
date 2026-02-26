import { BaseDomainEvent } from "@shared/core/domain-event"

/**
 * Assessment Completed Event
 *
 * AI 분석이 완료되었을 때 발행
 * → 사용자 알림, 통계 업데이트 등에 활용
 */
export class AssessmentCompletedEvent extends BaseDomainEvent {
    constructor(
        public readonly assessmentId: number,
        public readonly userId: number | null,
        public readonly score: number,
        public readonly transcribedText: string
    ) {
        super(assessmentId)
    }
}
