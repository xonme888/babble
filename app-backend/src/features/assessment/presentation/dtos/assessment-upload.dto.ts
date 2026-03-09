import { Type } from "class-transformer"
import { IsInt, IsOptional, IsIn, IsString, MaxLength, Min } from "class-validator"
import { AssessmentOrigin, AssessmentType } from "@shared/core/constants/api-contract"

const ORIGIN_VALUES = Object.values(AssessmentOrigin)
const ASSESSMENT_TYPE_VALUES = Object.values(AssessmentType)

/**
 * @openapi
 * components:
 *   schemas:
 *     AssessmentUploadDto:
 *       type: object
 *       properties:
 *         scriptId:
 *           type: integer
 *           minimum: 1
 *           description: 연습할 스크립트 ID (자유 발화 시 생략 가능)
 *         duration:
 *           type: integer
 *           minimum: 0
 *           description: 소요 시간 (초)
 *         origin:
 *           type: string
 *           enum: [MOBILE, THERAPY, GUEST]
 *           default: MOBILE
 *           description: Assessment 출처 (MOBILE, THERAPY, GUEST)
 *         referenceText:
 *           type: string
 *           maxLength: 2000
 *           description: 참조 텍스트 (최소대립쌍/시나리오 대사 등)
 *         assessmentType:
 *           type: string
 *           enum: [SCRIPT_READING, MINIMAL_PAIR, SCENARIO_LINE, WORD_PRACTICE, FREE_SPEECH]
 *           default: SCRIPT_READING
 *           description: Assessment 유형
 */
export class AssessmentUploadDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    scriptId?: number

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    duration?: number

    @IsOptional()
    @IsIn(ORIGIN_VALUES)
    origin?: string

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    referenceText?: string

    @IsOptional()
    @IsIn(ASSESSMENT_TYPE_VALUES)
    assessmentType?: string
}
