import { Entity, Column } from "typeorm"
import { BaseCreatedEntity } from "@shared/core/entity"

/**
 * 뱃지 카테고리
 */
export enum BadgeCategory {
    STREAK = "STREAK",
    SCORE = "SCORE",
    COUNT = "COUNT",
    LEVEL = "LEVEL",
    SPECIAL = "SPECIAL",
}

/**
 * Badge Entity
 * 뱃지 정의 (시스템에서 관리하는 마스터 데이터)
 */
@Entity("badges")
export class Badge extends BaseCreatedEntity {
    // 예: "STREAK_7"
    @Column({ length: 50, unique: true })
    code: string

    @Column({ length: 100 })
    title: string

    @Column({ type: "text" })
    description: string

    @Column({ length: 100 })
    iconName: string

    @Column({ type: "simple-enum", enum: BadgeCategory })
    category: BadgeCategory

    // 해금 조건 (JSON — 유연한 조건 표현)
    @Column({ type: "simple-json" })
    condition: {
        type: string // "streak" | "score" | "count" | "level"
        value: number // 조건값 (예: 7일 스트릭이면 7)
        field?: string // 추가 필드 (예: "assessment", "game")
    }

    @Column({ type: "int", default: 0 })
    orderIndex: number
}
