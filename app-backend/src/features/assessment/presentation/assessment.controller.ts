import { Request, Response } from "express"
import { injectable, inject } from "tsyringe"
import { AssessmentService } from "../application/assessment.service"
import path from "path"
import { IRealtimeNotifier } from "@shared/core/realtime-notifier.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { parsePaginationParams, parseEnumParam, parseRequiredInt } from "@shared/utils/request-parser.utils"
import { ValidationException } from "@shared/core/exceptions/domain-exceptions"
import { translate } from "@shared/presentation/helpers/i18n.helper"
import { extractUserId, extractId } from "@shared/presentation/helpers/request.helper"
import { AssessmentStatus } from "../domain/assessment.entity"
import { AssessmentResponseDto, AssessmentSummaryDto } from "./dtos/assessment-response.dto"
import { AssessmentUploadDto } from "./dtos/assessment-upload.dto"
import { GUEST_MAX_TRIALS } from "../domain/guest-trial-policy"

@injectable()
export class AssessmentController {
    constructor(
        @inject(AssessmentService) private assessmentService: AssessmentService,
        @inject(DI_TOKENS.IRealtimeNotifier) private notificationService: IRealtimeNotifier
    ) {}

    /**
     * GET /assessments/trial/policy
     * 게스트 체험 정책 반환 — 인증 불필요
     */
    async getTrialPolicy(_req: Request, res: Response) {
        return res.status(200).json({
            success: true,
            data: {
                maxTrials: GUEST_MAX_TRIALS,
            },
        })
    }

    async upload(req: Request, res: Response) {
        const userId = extractUserId(req)

        if (!req.file) {
            throw new ValidationException("common.error.invalid_audio_file")
        }

        const { scriptId, duration } = req.body as AssessmentUploadDto
        const filename = req.file.filename || path.basename(req.file.path)

        const assessment = await this.assessmentService.createAssessment(
            userId,
            filename,
            duration ?? 0,
            scriptId
        )

        return res.status(201).json({
            success: true,
            message: translate(req, "common.success.created", "Assessment uploaded successfully"),
            data: AssessmentResponseDto.from(assessment),
        })
    }

    async getHistory(req: Request, res: Response) {
        const userId = extractUserId(req)

        const { limit, offset } = parsePaginationParams(req.query as Record<string, string>)

        const { items, total } = await this.assessmentService.getAssessmentHistory(
            userId,
            limit,
            offset
        )

        return res.status(200).json({
            success: true,
            message: translate(
                req,
                "common.success.retrieved",
                "Assessment history retrieved successfully"
            ),
            data: { items: items.map(AssessmentSummaryDto.from), total, limit, offset },
        })
    }

    /**
     * GET /assessments/:id
     * 특정 진단 결과 조회
     */
    async getAssessment(req: Request, res: Response) {
        const userId = extractUserId(req)
        const assessmentId = extractId(req)

        const assessment = await this.assessmentService.getAssessment(assessmentId, userId)

        return res.status(200).json({
            success: true,
            message: translate(req, "common.success.retrieved", "Assessment retrieved successfully"),
            data: AssessmentResponseDto.from(assessment),
        })
    }

    /**
     * GET /assessments/notifications/sse
     * 일반 사용자용 SSE 실시간 알림
     */
    async userSseNotifications(req: Request, res: Response) {
        const userId = extractUserId(req)
        this.setupSSE(res)
        res.write(`data: ${JSON.stringify({ message: "connected" })}\n\n`)
        this.notificationService.addClient(userId, res)
    }

    /**
     * POST /assessments/:id/retry
     * 진단 분석 재시도
     */
    async retry(req: Request, res: Response) {
        const userId = extractUserId(req)
        const assessmentId = extractId(req)

        // 권한 체크: 본인의 진단인지 확인 (getAssessment가 NotFoundException throw)
        await this.assessmentService.getAssessment(assessmentId, userId)
        await this.assessmentService.retryAnalysis(assessmentId)

        return res.status(200).json({
            success: true,
            message: translate(
                req,
                "common.success.updated",
                "Analysis retry triggered successfully"
            ),
        })
    }

    /**
     * GET /assessments/admin/user/:userId
     * (어드민) 특정 사용자의 전체 진단 이력 조회
     */
    async getUserAssessments(req: Request, res: Response) {
        const userId = extractId(req, "userId")

        const { limit, offset } = parsePaginationParams(req.query as Record<string, string>, 50)

        const { items, total } = await this.assessmentService.getAssessmentHistory(
            userId,
            limit,
            offset
        )

        return res.status(200).json({
            success: true,
            data: { items: items.map(AssessmentSummaryDto.from), total, limit, offset },
        })
    }

    /**
     * GET /assessments/admin/all
     * (어드민) 모든 사용자의 진단 이력 조회
     */
    async getAllAssessments(req: Request, res: Response) {
        const { limit, offset } = parsePaginationParams(req.query as Record<string, string>, 50)
        const filters = {
            status: parseEnumParam(req.query.status, AssessmentStatus),
            userId: parseRequiredInt(req.query.userId as string | undefined) ?? undefined,
        }

        const { items, total } = await this.assessmentService.getAllAssessments(
            limit,
            offset,
            filters
        )

        return res.status(200).json({
            success: true,
            data: { items: items.map(AssessmentSummaryDto.from), total, limit, offset },
        })
    }

    /**
     * POST /assessments/admin/:id/retry
     * (어드민) 진단 분석 재시도
     */
    async adminRetry(req: Request, res: Response) {
        const assessmentId = extractId(req)

        await this.assessmentService.retryAnalysis(assessmentId)

        return res.status(200).json({
            success: true,
            message: translate(req, "common.success.updated", "Analysis retry triggered successfully"),
        })
    }

    /**
     * GET /assessments/admin/notifications/sse
     * (어드민) 실시간 분석 알림 SSE
     */
    async sseNotifications(req: Request, res: Response) {
        this.setupSSE(res)
        res.write(`data: ${JSON.stringify({ message: "SSE connected" })}\n\n`)
        this.notificationService.addAdminClient(res)
    }

    private setupSSE(res: Response): void {
        res.setHeader("Content-Type", "text/event-stream")
        res.setHeader("Cache-Control", "no-cache")
        res.setHeader("Connection", "keep-alive")
        res.setHeader("X-Accel-Buffering", "no")
        res.setTimeout(0)
    }
}
