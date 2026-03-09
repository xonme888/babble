import {
    Entity,
    Column,
    ManyToOne,
    JoinColumn,
} from "typeorm"
import { BaseCreatedEntity } from "@shared/core/entity"
import type { User } from "./user.entity"

/**
 * UserGoalLog Entity
 *
 * 사용자의 주간 목표 변경 이력을 기록
 */
@Entity("usr_goal_logs")
export class UserGoalLog extends BaseCreatedEntity {
    @Column()
    userId: number

    @Column({ type: "int", nullable: true })
    previousGoal: number

    @Column({ type: "int", nullable: true })
    newGoal: number

    @ManyToOne("User", { onDelete: "CASCADE" })
    @JoinColumn()
    user: User

    /** 주간 목표 변경 로그 생성 팩토리 */
    static create(params: {
        userId: number
        previousGoal: number
        newGoal: number
    }): UserGoalLog {
        const log = new UserGoalLog()
        log.userId = params.userId
        log.previousGoal = params.previousGoal
        log.newGoal = params.newGoal
        return log
    }
}
