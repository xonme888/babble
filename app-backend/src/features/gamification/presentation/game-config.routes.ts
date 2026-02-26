import { Router } from "express"
import { container } from "tsyringe"
import { GameConfigController } from "./game-config.controller"
import { authGuard } from "@features/auth/presentation/guards/auth.guard"
import { adminGuard } from "@features/auth/presentation/guards/admin.guard"
import { validateDto } from "@shared/presentation/middlewares/validation.middleware"
import { rateLimitMiddleware } from "@shared/presentation/middlewares/rate-limit.middleware"
import { UpdateGameConfigDto } from "./dtos/update-game-config.dto"

/**
 * GameConfig 클라이언트 라우터
 * @returns Express Router
 */
export function getGameConfigClientRouter(): Router {
    const router = Router()
    const controller = container.resolve(GameConfigController)

    /**
     * @openapi
     * /game-configs/hint:
     *   get:
     *     tags: [게임설정(GameConfig)]
     *     summary: 힌트 설정 조회
     *     description: 클라이언트용 힌트 관련 설정을 반환합니다. ETag 기반 캐싱을 지원합니다.
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: 조회 성공
     *         headers:
     *           ETag:
     *             schema:
     *               type: string
     *             description: 설정 버전 해시
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 data:
     *                   type: object
     *                   description: 힌트 카테고리 설정 (key-value 쌍)
     *       304:
     *         description: 변경 없음 (ETag 매칭)
     *       401:
     *         description: 인증 실패
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiErrorResponse'
     */
    router.get("/hint", authGuard, rateLimitMiddleware("game-config-read"), (req, res) =>
        controller.getHintConfig(req, res)
    )

    return router
}

/**
 * GameConfig 어드민 라우터
 * @returns Express Router
 */
export function getGameConfigAdminRouter(): Router {
    const router = Router()
    const controller = container.resolve(GameConfigController)

    /**
     * @openapi
     * /admin/game-configs:
     *   get:
     *     tags: [어드민-게임설정(Admin-GameConfig)]
     *     summary: 전체 게임 설정 목록
     *     description: 모든 게임 설정을 반환합니다. (어드민 전용)
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
     *                       key:
     *                         type: string
     *                       value: {}
     *                       description:
     *                         type: string
     *                       category:
     *                         type: string
     *                       updatedAt:
     *                         type: string
     *                         format: date-time
     *                       updatedBy:
     *                         type: integer
     *                         nullable: true
     *       401:
     *         description: 인증 실패
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiErrorResponse'
     *       403:
     *         description: 관리자 권한 필요
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiErrorResponse'
     */
    router.get("/", authGuard, adminGuard, (req, res) => controller.getAllConfigs(req, res))

    /**
     * @openapi
     * /admin/game-configs/{key}/history:
     *   get:
     *     tags: [어드민-게임설정(Admin-GameConfig)]
     *     summary: 게임 설정 변경 이력 조회
     *     description: 특정 설정 키의 변경 이력을 최근 20건까지 반환합니다. (어드민 전용)
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: key
     *         required: true
     *         schema:
     *           type: string
     *         description: 설정 키 (예 xp.game.firstClear)
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
     *                       configId:
     *                         type: integer
     *                       key:
     *                         type: string
     *                       oldValue:
     *                         type: string
     *                         nullable: true
     *                       newValue:
     *                         type: string
     *                       changedBy:
     *                         type: integer
     *                       changedAt:
     *                         type: string
     *                         format: date-time
     *       401:
     *         description: 인증 실패
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiErrorResponse'
     *       403:
     *         description: 관리자 권한 필요
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiErrorResponse'
     */
    router.get("/:key/history", authGuard, adminGuard, (req, res) =>
        controller.getConfigHistory(req, res)
    )

    /**
     * @openapi
     * /admin/game-configs/{key}:
     *   put:
     *     tags: [어드민-게임설정(Admin-GameConfig)]
     *     summary: 게임 설정 업데이트
     *     description: 특정 게임 설정 값을 변경합니다. (어드민 전용)
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: key
     *         required: true
     *         schema:
     *           type: string
     *         description: 설정 키 (예 xp.game.firstClear)
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/UpdateGameConfigDto'
     *     responses:
     *       200:
     *         description: 업데이트 성공
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 data:
     *                   type: object
     *                 message:
     *                   type: string
     *       400:
     *         description: 유효성 검증 실패
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiErrorResponse'
     *       401:
     *         description: 인증 실패
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiErrorResponse'
     *       403:
     *         description: 관리자 권한 필요
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiErrorResponse'
     */
    router.put(
        "/:key",
        authGuard,
        adminGuard,
        validateDto(UpdateGameConfigDto),
        rateLimitMiddleware("game-config-update"),
        (req, res) => controller.updateConfig(req, res)
    )

    return router
}
