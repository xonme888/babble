import type { Assessment } from "../../domain/assessment.entity"
import type { AssessmentStatus } from "../../domain/assessment.entity"
import type { AssessmentOriginType, AssessmentTypeType } from "@shared/core/constants/api-contract"
import type { IAnalysisFeedback } from "../../domain/analysis-feedback.interface"
import type {
    IFluencyDetail,
    IVoiceQuality,
    IMonotoneDetail,
    IStutteringDetail,
} from "../../domain/ai-analysis-result.interface"

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
 *         scenarioSessionId:
 *           type: integer
 *           nullable: true
 *           description: 시나리오 세션 FK (시나리오 소속 Assessment인 경우)
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
 *             faScore:
 *               type: number
 *             phonemeAccuracy:
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
 *         fluencyScore:
 *           type: number
 *           nullable: true
 *           description: 유창성 종합 점수 (0~100)
 *         fluencyDetail:
 *           type: object
 *           nullable: true
 *           description: 유창성 상세 (pause, stability, intonation)
 *         voiceQuality:
 *           type: object
 *           nullable: true
 *           description: 음질 분석 (HNR, Jitter, Shimmer)
 *         monotone:
 *           type: object
 *           nullable: true
 *           description: 단음조 분석 (F0 변동성)
 *         stuttering:
 *           type: object
 *           nullable: true
 *           description: 말더듬 감지 (반복/연장/블록)
 *         origin:
 *           type: string
 *           enum: [MOBILE, THERAPY, GUEST]
 *           description: Assessment 출처
 *         assessmentType:
 *           type: string
 *           enum: [SCRIPT_READING, MINIMAL_PAIR, SCENARIO_LINE, WORD_PRACTICE, FREE_SPEECH]
 *           description: Assessment 유형
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
    scenarioSessionId: number | null
    transcribedText: string | null
    status: AssessmentStatus
    score: number | null
    feedback: IAnalysisFeedback | null
    pitchData: { t: number; f0: number }[] | null
    speakingRate: number | null
    fluencyScore: number | null
    fluencyDetail: IFluencyDetail | null
    voiceQuality: IVoiceQuality | null
    monotone: IMonotoneDetail | null
    stuttering: IStutteringDetail | null
    origin: AssessmentOriginType
    assessmentType: AssessmentTypeType
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
        dto.scenarioSessionId = entity.scenarioSessionId ?? null
        dto.transcribedText = entity.transcribedText
        dto.status = entity.status
        dto.score = entity.score ?? null
        dto.feedback = entity.feedback ?? null
        dto.pitchData = entity.pitchData
        dto.speakingRate = entity.speakingRate
        dto.fluencyScore = entity.fluencyScore ?? null
        dto.fluencyDetail = entity.fluencyDetail ?? null
        dto.voiceQuality = entity.voiceQuality ?? null
        dto.monotone = entity.monotone ?? null
        dto.stuttering = entity.stuttering ?? null
        dto.origin = entity.origin
        dto.assessmentType = entity.assessmentType
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
 *         scenarioSessionId:
 *           type: integer
 *           nullable: true
 *           description: 시나리오 세션 FK (시나리오 소속 Assessment인 경우)
 *         status:
 *           type: string
 *           enum: [PENDING, ANALYZING, COMPLETED, FAILED, MAX_RETRY_EXCEEDED]
 *         score:
 *           type: number
 *           nullable: true
 *         speakingRate:
 *           type: number
 *           nullable: true
 *         faScore:
 *           type: number
 *           nullable: true
 *         fluencyScore:
 *           type: number
 *           nullable: true
 *           description: 유창성 종합 점수 (0~100)
 *         origin:
 *           type: string
 *           enum: [MOBILE, THERAPY, GUEST]
 *           description: Assessment 출처
 *         assessmentType:
 *           type: string
 *           enum: [SCRIPT_READING, MINIMAL_PAIR, SCENARIO_LINE, WORD_PRACTICE, FREE_SPEECH]
 *           description: Assessment 유형
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
    scenarioSessionId: number | null
    status: AssessmentStatus
    score: number | null
    speakingRate: number | null
    faScore: number | null
    fluencyScore: number | null
    origin: AssessmentOriginType
    assessmentType: AssessmentTypeType
    scriptSnapshot: { title: string; content: string; difficulty: string } | null
    createdAt: Date

    static from(entity: Assessment): AssessmentSummaryDto {
        const dto = new AssessmentSummaryDto()
        dto.id = entity.id
        dto.userId = entity.userId
        dto.audioUrl = entity.audioUrl
        dto.duration = entity.duration
        dto.scriptId = entity.scriptId
        dto.scenarioSessionId = entity.scenarioSessionId ?? null
        dto.status = entity.status
        dto.score = entity.score ?? null
        dto.speakingRate = entity.speakingRate
        dto.faScore = entity.feedback?.faScore ?? null
        dto.fluencyScore = entity.fluencyScore ?? null
        dto.origin = entity.origin
        dto.assessmentType = entity.assessmentType
        dto.scriptSnapshot = entity.scriptSnapshot
        dto.createdAt = entity.createdAt
        return dto
    }
}
