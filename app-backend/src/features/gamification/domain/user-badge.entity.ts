import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
} from "typeorm"
import type { Badge } from "./badge.entity"
import type { User } from "@features/user/domain/user.entity"

/**
 * UserBadge Entity
 * 사용자의 뱃지 해금 기록
 */
@Entity("gmf_user_badges")
@Index(["userId", "badgeId"], { unique: true })
// BaseCreatedEntity 미상속: alias 날짜 컬럼(unlockedAt) 사용
export class UserBadge {
    @PrimaryGeneratedColumn()
    id: number

    @CreateDateColumn()
    unlockedAt: Date

    @Column({ type: "timestamp", nullable: true })
    seenAt: Date | null

    @Column()
    userId: number

    @ManyToOne("User", { onDelete: "CASCADE" })
    @JoinColumn()
    user: User

    @Column()
    badgeId: number

    @ManyToOne("Badge", { onDelete: "RESTRICT" })
    @JoinColumn()
    badge: Badge

    /** 사용자 뱃지 해금 생성 팩토리 */
    static create(params: { userId: number; badgeId: number }): UserBadge {
        const ub = new UserBadge()
        ub.userId = params.userId
        ub.badgeId = params.badgeId
        return ub
    }
}
