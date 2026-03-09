import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm"

/**
 * GameConfigHistory Entity
 * GameConfig 변경 이력 추적
 */
@Entity("gmf_config_histories")
@Index(["configId"])
@Index(["changedAt"])
export class GameConfigHistory {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    configId: number

    @Column({ length: 100 })
    key: string

    @Column({ type: "text", nullable: true })
    oldValue: string | null

    @Column({ type: "text" })
    newValue: string

    @Column()
    changedBy: number

    @CreateDateColumn()
    changedAt: Date

    /**
     * 변경 이력 인스턴스 생성 팩토리
     */
    static create(
        configId: number,
        key: string,
        oldValue: string | null,
        newValue: string,
        changedBy: number
    ): GameConfigHistory {
        const history = new GameConfigHistory()
        history.configId = configId
        history.key = key
        history.oldValue = oldValue
        history.newValue = newValue
        history.changedBy = changedBy
        return history
    }
}
