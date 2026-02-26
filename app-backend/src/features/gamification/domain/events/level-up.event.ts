import { BaseDomainEvent } from "@shared/core/domain-event"

/**
 * 레벨업 이벤트
 */
export class LevelUpEvent extends BaseDomainEvent {
    constructor(
        public readonly userId: number,
        public readonly newLevel: number,
        public readonly totalXp: number
    ) {
        super(userId)
    }
}
