import { Request, Response } from "express"
import { injectable, inject } from "tsyringe"
import { GamificationService } from "../application/gamification.service"
import { parseIntOrDefault } from "@shared/utils/request-parser.utils"
import { extractUserId } from "@shared/presentation/helpers/request.helper"
import { BadgeResponseDto } from "./dtos/badge-response.dto"

/** 리더보드 최대 조회 건수 */
const MAX_LEADERBOARD_LIMIT = 50

/**
 * Gamification Controller
 * 게임화 HTTP 요청 처리
 */
@injectable()
export class GamificationController {
    constructor(@inject(GamificationService) private gamificationService: GamificationService) { }

    /**
     * GET /gamification/profile
     * 게임화 프로필 조회
     */
    async getProfile(req: Request, res: Response) {
        const userId = extractUserId(req)
        const profile = await this.gamificationService.getProfile(userId)

        return res.status(200).json({
            success: true,
            data: profile,
        })
    }

    /**
     * GET /gamification/badges
     * 뱃지 목록 (해금 상태 포함)
     */
    async getBadges(req: Request, res: Response) {
        const userId = extractUserId(req)
        const { allBadges, unlockedBadges } = await this.gamificationService.getBadgesRaw(userId)

        return res.status(200).json({
            success: true,
            data: BadgeResponseDto.fromEntities(allBadges, unlockedBadges),
        })
    }

    /**
     * GET /gamification/leaderboard
     * XP 리더보드
     */
    async getLeaderboard(req: Request, res: Response) {
        const limit = parseIntOrDefault(req.query.limit as string, 10)
        const leaderboard = await this.gamificationService.getLeaderboard(Math.min(limit, MAX_LEADERBOARD_LIMIT))

        return res.status(200).json({
            success: true,
            data: leaderboard,
        })
    }

    /**
     * GET /gamification/rewards/pending
     * 미확인 보상 조회
     */
    async getUnseenRewards(req: Request, res: Response) {
        const userId = extractUserId(req)
        const rewards = await this.gamificationService.getUnseenRewards(userId)

        return res.status(200).json({
            success: true,
            data: rewards,
        })
    }

    /**
     * POST /gamification/rewards/acknowledge
     * 보상 확인 처리
     */
    async acknowledgeRewards(req: Request, res: Response) {
        const userId = extractUserId(req)
        const { badgeIds, levelAcknowledged } = req.body

        const result = await this.gamificationService.acknowledgeRewards(
            userId,
            badgeIds,
            levelAcknowledged
        )

        return res.status(200).json({
            success: true,
            data: result,
        })
    }
}
