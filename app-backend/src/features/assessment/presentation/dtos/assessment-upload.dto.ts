import { Type } from "class-transformer"
import { IsInt, IsOptional, Min } from "class-validator"

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
}
