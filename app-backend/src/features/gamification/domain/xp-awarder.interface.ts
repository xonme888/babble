import type { XpSource } from "./xp-transaction.entity"

/**
 * IXpAwarder — cross-feature 소비자용 Port
 *
 * XpService의 XP 부여 메서드만 노출한다.
 */
export interface IXpAwarder {
    awardXp(params: {
        userId: number
        amount: number
        source: XpSource
        referenceId?: number
        description?: string
    }): Promise<void>
}
