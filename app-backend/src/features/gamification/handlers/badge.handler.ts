import { injectable, inject } from "tsyringe"
import { IDomainEventHandler } from "@shared/core/domain-event-dispatcher.interface"
import { DOMAIN_EVENT_TYPES, DomainEventType } from "@shared/core/constants/domain-event-types"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { AssessmentCompletedEvent } from "@features/assessment/domain/events/assessment-completed.event"
import { GameSessionCompletedEvent } from "@features/game/domain/events/game-session-completed.event"
import { LevelUpEvent } from "../domain/events/level-up.event"
import { BadgeService } from "../application/badge.service"

/**
 * Assessment 완료 → 뱃지 체크
 */
@injectable()
export class AssessmentBadgeHandler implements IDomainEventHandler<AssessmentCompletedEvent> {
    constructor(
        @inject(BadgeService) private badgeService: BadgeService,
        @inject(DI_TOKENS.ILogger) private logger: ILogger
    ) {}

    eventType(): DomainEventType {
        return DOMAIN_EVENT_TYPES.AssessmentCompletedEvent
    }

    async handle(event: AssessmentCompletedEvent): Promise<void> {
        // 레거시 게스트 trial (userId=null) — 뱃지 미체크
        if (event.userId == null) return

        try {
            await this.badgeService.evaluateAndUnlock(event.userId)
        } catch (error) {
            this.logger.error(
                `[BadgeHandler] Assessment 뱃지 체크 실패: ${event.assessmentId}`,
                error
            )
        }
    }
}

/**
 * 게임 세션 완료 → 뱃지 체크
 */
@injectable()
export class GameSessionBadgeHandler implements IDomainEventHandler<GameSessionCompletedEvent> {
    constructor(
        @inject(BadgeService) private badgeService: BadgeService,
        @inject(DI_TOKENS.ILogger) private logger: ILogger
    ) {}

    eventType(): DomainEventType {
        return DOMAIN_EVENT_TYPES.GameSessionCompletedEvent
    }

    async handle(event: GameSessionCompletedEvent): Promise<void> {
        try {
            await this.badgeService.evaluateAndUnlock(event.userId)
        } catch (error) {
            this.logger.error(`[BadgeHandler] Game 뱃지 체크 실패: ${event.gameSessionId}`, error)
        }
    }
}

/**
 * 레벨업 → 뱃지 체크
 */
@injectable()
export class LevelUpBadgeHandler implements IDomainEventHandler<LevelUpEvent> {
    constructor(
        @inject(BadgeService) private badgeService: BadgeService,
        @inject(DI_TOKENS.ILogger) private logger: ILogger
    ) {}

    eventType(): DomainEventType {
        return DOMAIN_EVENT_TYPES.LevelUpEvent
    }

    async handle(event: LevelUpEvent): Promise<void> {
        try {
            await this.badgeService.evaluateAndUnlock(event.userId)
        } catch (error) {
            this.logger.error(`[BadgeHandler] LevelUp 뱃지 체크 실패: User ${event.userId}`, error)
        }
    }
}
