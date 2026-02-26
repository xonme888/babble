import type { Badge } from "../../domain/badge.entity"
import type { UserBadge } from "../../domain/user-badge.entity"

/**
 * 뱃지 목록 응답 DTO (해금 상태 포함)
 *
 * @openapi
 * components:
 *   schemas:
 *     BadgeResponseDto:
 *       type: object
 *       required: [id, code, title, description, iconName, category, isUnlocked]
 *       properties:
 *         id:
 *           type: integer
 *         code:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         iconName:
 *           type: string
 *         category:
 *           type: string
 *         isUnlocked:
 *           type: boolean
 *         unlockedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 */
export class BadgeResponseDto {
    id!: number
    code!: string
    title!: string
    description!: string
    iconName!: string
    category!: string
    isUnlocked!: boolean
    unlockedAt!: Date | null

    /**
     * 전체 뱃지 + 해금 뱃지 목록으로부터 응답 DTO 배열 생성
     */
    static fromEntities(allBadges: Badge[], unlockedBadges: UserBadge[]): BadgeResponseDto[] {
        const unlockedMap = new Map(unlockedBadges.map((ub) => [ub.badgeId, ub.unlockedAt]))

        return allBadges.map((badge) => {
            const dto = new BadgeResponseDto()
            dto.id = badge.id
            dto.code = badge.code
            dto.title = badge.title
            dto.description = badge.description
            dto.iconName = badge.iconName
            dto.category = badge.category
            dto.isUnlocked = unlockedMap.has(badge.id)
            dto.unlockedAt = unlockedMap.get(badge.id) ?? null
            return dto
        })
    }
}
