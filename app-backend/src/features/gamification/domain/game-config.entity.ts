import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from "typeorm"

/**
 * GameConfig Entity
 * 게임/보상 규칙을 DB에 저장하여 배포 없이 어드민에서 실시간 튜닝 가능
 */
@Entity("game_configs")
@Index(["category"])
// BaseAuditEntity 미상속: createdAt 없이 updatedAt만 사용하는 특수 구조
export class GameConfig {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ length: 100, unique: true })
    key: string

    @Column({ type: "simple-json" })
    value: unknown

    @Column({ type: "text" })
    description: string

    @Column({ length: 50 })
    category: string

    @UpdateDateColumn()
    updatedAt: Date

    @Column({ type: "int", nullable: true })
    updatedBy: number | null

    /** 설정값 업데이트 */
    updateConfig(value: unknown, updatedBy: number, description?: string): void {
        this.value = value
        this.updatedBy = updatedBy
        if (description !== undefined) {
            this.description = description
        }
    }
}
