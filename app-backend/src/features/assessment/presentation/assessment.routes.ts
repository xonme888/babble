import { Router } from "express"
import { container } from "tsyringe"
import { AssessmentController } from "./assessment.controller"
import { authGuard } from "@features/auth/presentation/guards/auth.guard"
import { adminGuard } from "@features/auth/presentation/guards/admin.guard"
import { voiceConsentGuard } from "@features/auth/presentation/guards/voice-consent.guard"
import { rateLimitMiddleware } from "@shared/presentation/middlewares/rate-limit.middleware"
import { validateDto } from "@shared/presentation/middlewares/validation.middleware"
import { AssessmentUploadDto } from "./dtos/assessment-upload.dto"
import multer from "multer"
import path from "path"
import fs from "fs"
import type { IConfigService } from "@shared/core/config.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"

const router = Router()

const ALLOWED_MIME_TYPES: Record<string, string> = {
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/m4a": ".m4a",
    "audio/ogg": ".ogg",
    "audio/webm": ".webm",
}

const ALLOWED_EXTENSIONS = [".wav", ".mp3", ".m4a", ".ogg", ".webm"]

export function getAssessmentRouter(): Router {
    const controller = container.resolve(AssessmentController)
    const configService = container.resolve<IConfigService>(DI_TOKENS.IConfigService)
    const config = configService.config

    // Multer 설정
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadPath = path.join(process.cwd(), "uploads")
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true })
            }
            cb(null, uploadPath)
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
            // MIME 타입 기반 확장자 결정, octet-stream 등 매핑 없으면 원본 확장자 사용
            const ext =
                ALLOWED_MIME_TYPES[file.mimetype] || path.extname(file.originalname).toLowerCase()
            cb(null, file.fieldname + "-" + uniqueSuffix + ext)
        },
    })

    const upload = multer({
        storage: storage,
        limits: {
            fileSize: config.upload.maxFileSizeBytes,
        },
        fileFilter: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase()
            const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext)

            // 확장자는 항상 필수 검증
            if (!isExtAllowed) {
                return cb(null, false)
            }

            // application/octet-stream: 모바일 클라이언트 호환 — 확장자 검증 통과 시 허용
            if (file.mimetype === "application/octet-stream") {
                return cb(null, true)
            }

            // 그 외: MIME 타입도 AND 검증
            const isMimeAllowed = file.mimetype in ALLOWED_MIME_TYPES
            cb(null, isMimeAllowed)
        },
    })

    // 주의: 고정 경로를 /:id 파라미터 라우트보다 위에 배치해야 라우트 충돌 방지

    /**
     * @openapi
     * /assessments:
     *   post:
     *     tags: [진단(Assessment)]
     *     summary: 음성 파일 업로드 및 진단 생성
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         multipart/form-data:
     *           schema:
     *             type: object
     *             properties:
     *               audio:
     *                 type: string
     *                 format: binary
     *               scriptId:
     *                 type: integer
     *                 example: 1
     *     responses:
     *       201:
     *         description: 업로드 성공 및 진단 생성 완료
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SuccessResponse'
     *       400:
     *         description: 파일이 없거나 잘못된 형식
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       401:
     *         description: 인증 실패
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.post(
        "/",
        authGuard,
        voiceConsentGuard,
        rateLimitMiddleware("assessment-upload"),
        upload.single("audio"),
        validateDto(AssessmentUploadDto),
        (req, res) => controller.upload(req, res)
    )

    /**
     * @openapi
     * /assessments/trial/policy:
     *   get:
     *     tags: [진단(Assessment)]
     *     summary: 게스트 체험 정책 조회
     *     description: 게스트 기능별 최대 체험 횟수와 Assessment TTL 정보를 반환한다. 인증 불필요.
     *     responses:
     *       200:
     *         description: 정책 조회 성공
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 data:
     *                   type: object
     *                   properties:
     *                     maxTrials:
     *                       type: object
     *                       description: 기능별 최대 체험 횟수
     *                       properties:
     *                         PRACTICE:
     *                           type: integer
     *                           example: 1
     *                         CONTINUOUS_READING:
     *                           type: integer
     *                           example: 1
     *                         WORD_GAME:
     *                           type: integer
     *                           example: 0
     *                         LEADERBOARD:
     *                           type: integer
     *                           example: 0
     *                         HISTORY:
     *                           type: integer
     *                           example: 0
     *                         PROFILE:
     *                           type: integer
     *                           example: 0
     *                     assessmentTtlHours:
     *                       type: integer
     *                       example: 24
     *       429:
     *         description: Rate limit 초과
     */
    router.get(
        "/trial/policy",
        rateLimitMiddleware("script-public-read", (req) => req.ip || "unknown"),
        (req, res) => controller.getTrialPolicy(req, res)
    )

    /**
     * @openapi
     * /assessments:
     *   get:
     *     tags: [진단(Assessment)]
     *     summary: 진단 이력 조회
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 20
     *       - in: query
     *         name: offset
     *         schema:
     *           type: integer
     *           default: 0
     *     responses:
     *       200:
     *         description: 조회 성공
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         description: 인증 실패
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiErrorResponse'
     */
    router.get("/", authGuard, (req, res) => controller.getHistory(req, res))

    /**
     * @openapi
     * /assessments/notifications/sse:
     *   get:
     *     tags: [진단(Assessment)]
     *     summary: 실시간 분석 알림 SSE (일반 사용자)
     *     description: 사용자의 진단 분석 완료/실패를 실시간으로 수신하는 SSE 스트림
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: SSE 스트림 연결 성공
     *         content:
     *           text/event-stream:
     *             schema:
     *               type: string
     *       401:
     *         description: 인증 실패
     *       503:
     *         description: 연결 제한 초과
     */
    router.get("/notifications/sse", authGuard, (req, res) =>
        controller.userSseNotifications(req, res)
    )

    /**
     * @openapi
     * /assessments/admin/user/{userId}:
     *   get:
     *     tags: [진단 관리]
     *     summary: (어드민) 특정 사용자의 전체 진단 이력 조회
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: userId
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: 조회 성공
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         description: 인증 실패
     *       403:
     *         description: 관리자 권한 필요
     */
    router.get("/admin/user/:userId", authGuard, adminGuard, (req, res) =>
        controller.getUserAssessments(req, res)
    )

    /**
     * @openapi
     * /assessments/admin/all:
     *   get:
     *     tags: [진단 관리]
     *     summary: (어드민) 모든 사용자의 전체 진단 이력 조회
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: 조회 성공
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         description: 인증 실패
     *       403:
     *         description: 관리자 권한 필요
     */
    router.get("/admin/all", authGuard, adminGuard, (req, res) =>
        controller.getAllAssessments(req, res)
    )

    /**
     * @openapi
     * /assessments/admin/{id}/retry:
     *   post:
     *     tags: [진단 관리]
     *     summary: (어드민) 진단 분석 재시도
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: 재시도 요청 성공
     */
    router.post("/admin/:id/retry", authGuard, adminGuard, (req, res) =>
        controller.adminRetry(req, res)
    )

    /**
     * @openapi
     * /assessments/admin/notifications/sse:
     *   get:
     *     tags: [진단 관리]
     *     summary: (어드민) 실시간 분석 알림 SSE
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: SSE 연결 성공
     */
    router.get("/admin/notifications/sse", authGuard, adminGuard, (req, res) =>
        controller.sseNotifications(req, res)
    )

    /**
     * @openapi
     * /assessments/{id}:
     *   get:
     *     tags: [진단(Assessment)]
     *     summary: 특정 진단 결과 조회
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: 조회 성공
     *       404:
     *         description: 진단 결과를 찾을 수 없음
     */
    router.get("/:id", authGuard, (req, res) => controller.getAssessment(req, res))

    /**
     * @openapi
     * /assessments/{id}/retry:
     *   post:
     *     tags: [진단(Assessment)]
     *     summary: 진단 분석 재시도
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: 재시도 요청 성공
     *       404:
     *         description: 진단 결과를 찾을 수 없음
     */
    router.post("/:id/retry", authGuard, rateLimitMiddleware("assessment-retry"), (req, res) =>
        controller.retry(req, res)
    )

    return router
}
