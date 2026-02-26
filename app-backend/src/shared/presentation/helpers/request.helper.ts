import { Request } from "express"
import {
    UnauthorizedException,
    ValidationException,
} from "@shared/core/exceptions/domain-exceptions"

/**
 * 인증된 사용자 ID 추출 — req.user!.id non-null assertion 제거
 */
export function extractUserId(req: Request): number {
    if (!req.user?.id) throw new UnauthorizedException("auth.user_required")
    return req.user.id
}

/**
 * 경로 파라미터 정수 ID 추출 — 컨트롤러 공통 헬퍼
 */
export function extractId(req: Request, paramName = "id"): number {
    const raw = req.params[paramName]
    const value = Array.isArray(raw) ? raw[0] : raw
    const parsed = Number(value)

    if (value == null || isNaN(parsed) || !Number.isInteger(parsed)) {
        throw new ValidationException("validation.invalid_id")
    }

    return parsed
}
