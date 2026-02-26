import { IsDefined, IsOptional, IsString, MaxLength } from "class-validator"

/**
 * @openapi
 * components:
 *   schemas:
 *     UpdateGameConfigDto:
 *       type: object
 *       required:
 *         - value
 *       properties:
 *         value:
 *           description: 설정 값 (타입 무관 — 숫자, 객체, 배열, boolean 등)
 *         description:
 *           type: string
 *           description: 관리자용 설명 (선택)
 */
export class UpdateGameConfigDto {
    @IsDefined({ message: "value는 필수입니다" })
    value: unknown

    @IsOptional()
    @IsString({ message: "description은 문자열이어야 합니다" })
    @MaxLength(500)
    description?: string
}
