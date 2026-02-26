import type { Assessment } from "../../domain/assessment.entity"
import type { AssessmentStatus } from "../../domain/assessment.entity"
import type { IAnalysisFeedback } from "../../domain/analysis-feedback.interface"

/**
 * Assessment 상세 응답 DTO
 * 엔티티의 retryCount, lastError, version, domainEvents 제외
 *
 * @openapi
 * components:
 *   schemas:
 *     AssessmentResponseDto:
 *       type: object
 *       required: [id, audioUrl, duration, status, createdAt, updatedAt]
 *       properties:
 *         id:
 *           type: integer
 *         userId:
 *           type: integer
 *           nullable: true
 *         audioUrl:
 *           type: string
 *         duration:
 *           type: integer
 *         scriptId:
 *           type: integer
 *           nullable: true
 *         transcribedText:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [PENDING, ANALYZING, COMPLETED, FAILED, MAX_RETRY_EXCEEDED]
 *         score:
 *           type: number
 *           nullable: true
 *         feedback:
 *           type: object
 *           nullable: true
 *           properties:
 *             similarity:
 *               type: number
 *             alignment:
 *               type: array
 *               items:
 *                 type: object
 *             fa_score:
 *               type: number
 *             phoneme_accuracy:
 *               type: number
 *         pitchData:
 *           type: array
 *           nullable: true
 *           items:
 *             type: object
 *             properties:
 *               t:
 *                 type: number
 *               f0:
 *                 type: number
 *         speakingRate:
 *           type: number
 *           nullable: true
 *         scriptSnapshot:
 *           type: object
 *           nullable: true
 *           properties:
 *             title:
 *               type: string
 *             content:
 *               type: string
 *             difficulty:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
export class AssessmentResponseDto {
    id: number
    userId: number | null
    audioUrl: string
    duration: number
    scriptId: number | null
    transcribedText: string | null
    status: AssessmentStatus
    score: number | null
    feedback: IAnalysisFeedback | null
    pitchData: { t: number; f0: number }[] | null
    speakingRate: number | null
    scriptSnapshot: { title: string; content: string; difficulty: string } | null
    createdAt: Date
    updatedAt: Date

    static from(entity: Assessment): AssessmentResponseDto {
        const dto = new AssessmentResponseDto()
        dto.id = entity.id
        dto.userId = entity.userId
        dto.audioUrl = entity.audioUrl
        dto.duration = entity.duration
        dto.scriptId = entity.scriptId
        dto.transcribedText = entity.transcribedText
        dto.status = entity.status
        dto.score = entity.score ?? null
        dto.feedback = entity.feedback ?? null
        dto.pitchData = entity.pitchData
        dto.speakingRate = entity.speakingRate
        dto.scriptSnapshot = entity.scriptSnapshot
        dto.createdAt = entity.createdAt
        dto.updatedAt = entity.updatedAt
        return dto
    }
}

/**
 * Assessment 목록용 요약 DTO
 * feedback, pitchData 제외
 *
 * @openapi
 * components:
 *   schemas:
 *     AssessmentSummaryDto:
 *       type: object
 *       required: [id, audioUrl, duration, status, createdAt]
 *       properties:
 *         id:
 *           type: integer
 *         userId:
 *           type: integer
 *           nullable: true
 *         audioUrl:
 *           type: string
 *         duration:
 *           type: integer
 *         scriptId:
 *           type: integer
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [PENDING, ANALYZING, COMPLETED, FAILED, MAX_RETRY_EXCEEDED]
 *         score:
 *           type: number
 *           nullable: true
 *         speakingRate:
 *           type: number
 *           nullable: true
 *         scriptSnapshot:
 *           type: object
 *           nullable: true
 *           properties:
 *             title:
 *               type: string
 *             content:
 *               type: string
 *             difficulty:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 */
export class AssessmentSummaryDto {
    id: number
    userId: number | null
    audioUrl: string
    duration: number
    scriptId: number | null
    status: AssessmentStatus
    score: number | null
    speakingRate: number | null
    scriptSnapshot: { title: string; content: string; difficulty: string } | null
    createdAt: Date

    static from(entity: Assessment): AssessmentSummaryDto {
        const dto = new AssessmentSummaryDto()
        dto.id = entity.id
        dto.userId = entity.userId
        dto.audioUrl = entity.audioUrl
        dto.duration = entity.duration
        dto.scriptId = entity.scriptId
        dto.status = entity.status
        dto.score = entity.score ?? null
        dto.speakingRate = entity.speakingRate
        dto.scriptSnapshot = entity.scriptSnapshot
        dto.createdAt = entity.createdAt
        return dto
    }
}
