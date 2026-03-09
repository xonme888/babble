import {
    Entity,
    Column,
    Index,
    ManyToOne,
    JoinColumn,
} from "typeorm"
import { BaseCreatedEntity } from "@shared/core/entity"
import type { User } from "@features/user/domain/user.entity"

/**
 * XP 소스 유형
 */
export enum XpSource {
    ASSESSMENT = "ASSESSMENT",
    GAME = "GAME",
    DAILY_GOAL = "DAILY_GOAL",
    STREAK_BONUS = "STREAK_BONUS",
    CHALLENGE = "CHALLENGE",
    SCENARIO = "SCENARIO",
    PHONEME_DRILL = "PHONEME_DRILL",
    SRS_REVIEW = "SRS_REVIEW",
    VOICE_DIARY = "VOICE_DIARY",
}

/**
 * XpTransaction Entity
 * XP 획득 이력 추적
 */
@Entity("gmf_xp_transactions")
@Index(["userId"])
@Index(["userId", "createdAt"])
@Index(["userId", "source", "referenceId"], { unique: true, where: '"reference_id" IS NOT NULL' })
export class XpTransaction extends BaseCreatedEntity {
    @Column()
    userId: number

    @ManyToOne("User", { onDelete: "CASCADE" })
    @JoinColumn()
    user: User

    // XP 양 (양수)
    @Column({ type: "int" })
    amount: number

    // XP 소스
    @Column({ type: "simple-enum", enum: XpSource })
    source: XpSource

    // 관련 엔티티 ID (assessmentId, gameSessionId 등)
    @Column({ type: "int", nullable: true })
    referenceId: number | null

    // 설명
    @Column({ type: "text", nullable: true })
    description: string | null

    // ==================== Factory ====================

    static create(params: {
        userId: number
        amount: number
        source: XpSource
        referenceId?: number
        description?: string
    }): XpTransaction {
        const xpTransaction = new XpTransaction()
        xpTransaction.userId = params.userId
        xpTransaction.amount = params.amount
        xpTransaction.source = params.source
        xpTransaction.referenceId = params.referenceId ?? null
        xpTransaction.description = params.description ?? null
        return xpTransaction
    }
}
