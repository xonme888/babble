import { Router } from "express"
import { container } from "tsyringe"
import { GamificationController } from "./gamification.controller"
import { authGuard } from "@features/auth/presentation/guards/auth.guard"
import { validateDto } from "@shared/presentation/middlewares/validation.middleware"
import { rateLimitMiddleware } from "@shared/presentation/middlewares/rate-limit.middleware"
import { AcknowledgeRewardsDto } from "./dtos/acknowledge-rewards.dto"

/**
 * Gamification 라우터 생성 함수
 * @returns Express Router
 */
export function getGamificationRouter(): Router {
    const router = Router()
    const controller = container.resolve(GamificationController)

    /**
     * @openapi
     * /gamification/profile:
     *   get:
     *     tags: [게임화(Gamification)]
     *     summary: 게임화 프로필 조회
     *     description: 레벨, XP, 스트릭, 뱃지 수 등 게임화 프로필을 반환합니다.
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: 조회 성공
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 data:
     *                   type: object
     *                   properties:
     *                     level:
     *                       type: integer
     *                     totalXp:
     *                       type: integer
     *                     xpToNextLevel:
     *                       type: integer
     *                     levelProgress:
     *                       type: number
     *                     weeklyXp:
     *                       type: integer
     *                     currentStreak:
     *                       type: integer
     *                     longestStreak:
     *                       type: integer
     *                     unlockedBadgeCount:
     *                       type: integer
     *       401:
     *         description: 인증 실패
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    const gamificationRateLimit = rateLimitMiddleware("gamification-read", (req) => `user:${req.user?.id ?? "anonymous"}`)

    router.get("/profile", authGuard, gamificationRateLimit, (req, res) => controller.getProfile(req, res))

    /**
     * @openapi
     * /gamification/badges:
     *   get:
     *     tags: [게임화(Gamification)]
     *     summary: 뱃지 목록 조회
     *     description: 전체 뱃지 목록과 사용자의 해금 상태를 반환합니다.
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: 조회 성공
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 data:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       id:
     *                         type: integer
     *                       code:
     *                         type: string
     *                       title:
     *                         type: string
     *                       description:
     *                         type: string
     *                       iconName:
     *                         type: string
     *                       category:
     *                         type: string
     *                         enum: [STREAK, SCORE, COUNT, LEVEL, SPECIAL]
     *                       isUnlocked:
     *                         type: boolean
     *                       unlockedAt:
     *                         type: string
     *                         format: date-time
     *                         nullable: true
     *       401:
     *         description: 인증 실패
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.get("/badges", authGuard, gamificationRateLimit, (req, res) => controller.getBadges(req, res))

    /**
     * @openapi
     * /gamification/leaderboard:
     *   get:
     *     tags: [게임화(Gamification)]
     *     summary: XP 리더보드
     *     description: XP 기준 상위 사용자 순위를 반환합니다.
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 10
     *           maximum: 50
     *     responses:
     *       200:
     *         description: 조회 성공
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 data:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       rank:
     *                         type: integer
     *                       userId:
     *                         type: integer
     *                       firstName:
     *                         type: string
     *                       level:
     *                         type: integer
     *                       totalXp:
     *                         type: integer
     *       401:
     *         description: 인증 실패
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.get("/leaderboard", authGuard, gamificationRateLimit, (req, res) => controller.getLeaderboard(req, res))

    /**
     * @openapi
     * /gamification/rewards/pending:
     *   get:
     *     tags: [게임화(Gamification)]
     *     summary: 미확인 보상 조회
     *     description: 사용자가 아직 확인하지 않은 뱃지와 레벨업 정보를 반환합니다.
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: 조회 성공
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 data:
     *                   type: object
     *                   properties:
     *                     badges:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           id:
     *                             type: integer
     *                           code:
     *                             type: string
     *                           title:
     *                             type: string
     *                           iconName:
     *                             type: string
     *                           unlockedAt:
     *                             type: string
     *                             format: date-time
     *                     levelUp:
     *                       type: object
     *                       nullable: true
     *                       properties:
     *                         newLevel:
     *                           type: integer
     *                         oldLevel:
     *                           type: integer
     *       401:
     *         description: 인증 실패
     */
    router.get("/rewards/pending", authGuard, gamificationRateLimit, (req, res) => controller.getUnseenRewards(req, res))

    /**
     * @openapi
     * /gamification/rewards/acknowledge:
     *   post:
     *     tags: [게임화(Gamification)]
     *     summary: 보상 확인 처리
     *     description: 미확인 보상(뱃지, 레벨업)을 모두 확인 상태로 변경합니다.
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               badgeIds:
     *                 type: array
     *                 items:
     *                   type: integer
     *                 description: 확인할 뱃지 ID 배열
     *               levelAcknowledged:
     *                 type: integer
     *                 minimum: 1
     *                 description: 확인한 레벨 번호
     *     responses:
     *       200:
     *         description: 처리 성공
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 data:
     *                   type: object
     *                   properties:
     *                     acknowledgedBadges:
     *                       type: integer
     *                     acknowledgedLevel:
     *                       type: integer
     *                       nullable: true
     *       401:
     *         description: 인증 실패
     */
    router.post("/rewards/acknowledge", authGuard, gamificationRateLimit, validateDto(AcknowledgeRewardsDto), (req, res) => controller.acknowledgeRewards(req, res))

    return router
}
