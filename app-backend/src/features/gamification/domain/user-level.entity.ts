import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
} from "typeorm"
import { SafeVersionColumn } from "@shared/core/decorators/safe-version-column"
import { levelForXp, xpRequiredForLevel, MAX_LEVEL } from "./level-rules"
import type { User } from "@features/user/domain/user.entity"

/**
 * UserLevel Entity
 * 사용자의 현재 레벨 및 누적 XP
 */
@Entity("user_levels")
@Index(["userId"], { unique: true })
// BaseAuditEntity 미상속: createdAt 없이 updatedAt만 사용하는 특수 구조
export class UserLevel {
    @PrimaryGeneratedColumn()
    id: number

    @UpdateDateColumn()
    updatedAt: Date

    @Column()
    userId: number

    @ManyToOne("User", { onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user: User | null

    // 낙관적 잠금 — 동시 XP 부여 경합 방지
    @SafeVersionColumn()
    version: number

    @Column({ type: "int", default: 1 })
    level: number

    @Column({ type: "int", default: 0 })
    totalXp: number

    @Column({ type: "int", default: 1 })
    lastSeenLevel: number

    /** 신규 사용자 레벨 생성 팩토리 */
    static create(userId: number): UserLevel {
        const userLevel = new UserLevel()
        userLevel.userId = userId
        userLevel.level = 1
        userLevel.totalXp = 0
        userLevel.lastSeenLevel = 1
        return userLevel
    }

    /**
     * XP 추가 및 레벨업 확인
     * @returns 레벨업 발생 여부
     */
    addXp(amount: number): boolean {
        this.totalXp += amount
        const newLevel = Math.min(levelForXp(this.totalXp), MAX_LEVEL)
        if (newLevel > this.level) {
            this.level = newLevel
            return true
        }
        return false
    }

    /**
     * 다음 레벨까지 필요한 XP
     */
    get xpToNextLevel(): number {
        if (this.level >= MAX_LEVEL) return 0
        return xpRequiredForLevel(this.level + 1) - this.totalXp
    }

    /**
     * 미확인 레벨업 정보 반환. 없으면 null
     */
    getUnseenLevelUp(): { fromLevel: number; toLevel: number } | null {
        if (this.level <= this.lastSeenLevel) return null
        return { fromLevel: this.lastSeenLevel, toLevel: this.level }
    }

    /**
     * 해당 레벨을 확인(acknowledge) 가능한지 판정
     * lastSeenLevel < level <= currentLevel 범위만 허용
     */
    canAcknowledgeLevel(level: number): boolean {
        return level > this.lastSeenLevel && level <= this.level
    }

    /**
     * 현재 레벨 내 진행도 (0~1)
     */
    get levelProgress(): number {
        if (this.level >= MAX_LEVEL) return 1
        const currentLevelXp = xpRequiredForLevel(this.level)
        const nextLevelXp = xpRequiredForLevel(this.level + 1)
        const range = nextLevelXp - currentLevelXp
        if (range <= 0) return 1
        return (this.totalXp - currentLevelXp) / range
    }
}
