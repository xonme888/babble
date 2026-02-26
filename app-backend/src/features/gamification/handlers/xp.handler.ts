import { injectable, inject } from "tsyringe"
import { IDomainEventHandler } from "@shared/core/domain-event-dispatcher.interface"
import { DOMAIN_EVENT_TYPES, DomainEventType } from "@shared/core/constants/domain-event-types"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { AssessmentCompletedEvent } from "@features/assessment/domain/events/assessment-completed.event"
import { DailyGoalAchievedEvent } from "@features/learning/domain/events/daily-goal-achieved.event"
import { XpService } from "../application/xp.service"
import { XpSource } from "../domain/xp-transaction.entity"
import { XP_DEFAULTS, calculateAssessmentXp } from "../domain/xp-rules"

/**
 * Assessment 완료 → XP 부여
 */
@injectable()
export class AssessmentXpHandler implements IDomainEventHandler<AssessmentCompletedEvent> {
    constructor(
        @inject(XpService) private xpService: XpService,
        @inject(DI_TOKENS.ILogger) private logger: ILogger
    ) {}

    eventType(): DomainEventType {
        return DOMAIN_EVENT_TYPES.AssessmentCompletedEvent
    }

    async handle(event: AssessmentCompletedEvent): Promise<void> {
        // 레거시 게스트 trial (userId=null) — XP 미부여
        if (event.userId == null) return

        try {
            const amount = calculateAssessmentXp(event.score)
            await this.xpService.awardXp({
                userId: event.userId,
                amount,
                source: XpSource.ASSESSMENT,
                referenceId: event.assessmentId,
                description: `발음 진단 완료 (점수: ${event.score})`,
            })
        } catch (error) {
            this.logger.error(`[XpHandler] Assessment XP 부여 실패: ${event.assessmentId}`, error)
        }
    }
}

/**
 * 일일 목표 달성 → XP 부여
 */
@injectable()
export class DailyGoalXpHandler implements IDomainEventHandler<DailyGoalAchievedEvent> {
    constructor(
        @inject(XpService) private xpService: XpService,
        @inject(DI_TOKENS.ILogger) private logger: ILogger
    ) {}

    eventType(): DomainEventType {
        return DOMAIN_EVENT_TYPES.DailyGoalAchievedEvent
    }

    async handle(event: DailyGoalAchievedEvent): Promise<void> {
        try {
            const dateAsInt = parseInt(event.date.replace(/-/g, ""), 10)
            await this.xpService.awardXp({
                userId: event.userId,
                amount: XP_DEFAULTS.DAILY_GOAL_ACHIEVED,
                source: XpSource.DAILY_GOAL,
                referenceId: dateAsInt,
                description: `일일 목표 달성 (${event.date})`,
            })
        } catch (error) {
            this.logger.error(`[XpHandler] 일일 목표 XP 부여 실패: User ${event.userId}`, error)
        }
    }
}
