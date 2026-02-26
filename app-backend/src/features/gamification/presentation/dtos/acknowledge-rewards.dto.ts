import { IsArray, IsOptional, IsNumber, IsInt, Min } from "class-validator"

/**
 * 보상 확인 요청 DTO
 * POST /gamification/rewards/acknowledge
 */
export class AcknowledgeRewardsDto {
    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    badgeIds?: number[]

    /** 확인한 레벨 번호 (예: 14) — 서비스에서 lastSeenLevel과 비교 */
    @IsOptional()
    @IsInt()
    @Min(1)
    levelAcknowledged?: number
}
