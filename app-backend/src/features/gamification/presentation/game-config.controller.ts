import { Request, Response } from "express"
import { injectable, inject } from "tsyringe"
import { GameConfigService } from "../application/game-config.service"
import { ValidationException } from "@shared/core/exceptions/domain-exceptions"
import { translate } from "@shared/presentation/helpers/i18n.helper"
import { extractUserId } from "@shared/presentation/helpers/request.helper"

/**
 * GameConfig Controller
 * 게임 설정 HTTP 요청 처리
 */
@injectable()
export class GameConfigController {
    constructor(@inject(GameConfigService) private gameConfigService: GameConfigService) {}

    /**
     * GET /game-configs/hint
     * 클라이언트용 힌트 설정 조회 (ETag 지원)
     */
    async getHintConfig(req: Request, res: Response) {
        const version = this.gameConfigService.getConfigVersion()

        // ETag 기반 304 Not Modified
        const ifNoneMatch = req.headers["if-none-match"]
        if (ifNoneMatch === version) {
            return res.status(304).end()
        }

        const hintConfigs = this.gameConfigService.getByCategory("hint")

        res.setHeader("ETag", version)
        return res.status(200).json({
            success: true,
            data: hintConfigs,
        })
    }

    /**
     * GET /admin/game-configs
     * 어드민용 전체 설정 목록
     */
    async getAllConfigs(req: Request, res: Response) {
        const configs = await this.gameConfigService.getAll()

        return res.status(200).json({
            success: true,
            data: configs,
        })
    }

    /**
     * GET /admin/game-configs/:key/history
     * 어드민용 설정 변경 이력 조회
     */
    async getConfigHistory(req: Request, res: Response) {
        const key = this.extractKeyParam(req)
        const history = await this.gameConfigService.getHistory(key)

        return res.status(200).json({
            success: true,
            data: history,
        })
    }

    /**
     * PUT /admin/game-configs/:key
     * 어드민용 설정 업데이트
     */
    async updateConfig(req: Request, res: Response) {
        const key = this.extractKeyParam(req)
        const { value, description } = req.body
        const updatedBy = extractUserId(req)

        const updated = await this.gameConfigService.update(key, value, updatedBy, description)

        return res.status(200).json({
            success: true,
            data: updated,
            message: translate(req, "common.success.updated", "Config updated successfully"),
        })
    }

    /**
     * req.params.key를 파싱하여 문자열로 반환
     */
    private extractKeyParam(req: Request): string {
        const keyParam = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key
        if (!keyParam) {
            throw new ValidationException("key 파라미터가 필요합니다")
        }
        return keyParam
    }
}
