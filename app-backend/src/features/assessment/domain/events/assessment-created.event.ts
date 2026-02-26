import { BaseDomainEvent } from "@shared/core/domain-event"

/**
 * Assessment Created Event
 *
 * Assessment가 생성되었을 때 발행
 */
export class AssessmentCreatedEvent extends BaseDomainEvent {
    constructor(
        public readonly assessmentId: number,
        public readonly userId: number | null,
        public readonly audioUrl: string,
        public readonly duration: number
    ) {
        super(assessmentId)
    }
}
