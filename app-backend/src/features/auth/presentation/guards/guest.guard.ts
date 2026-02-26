import { Request, Response, NextFunction } from "express"
import { ForbiddenException } from "@shared/core/exceptions/domain-exceptions"
import { isGuestRole } from "@features/assessment/domain/guest-trial-policy"

/**
 * 게스트 차단 미들웨어 — authGuard 뒤에 배치
 *
 * GUEST 역할 사용자의 보호 엔드포인트 접근을 차단한다.
 * USER, ADMIN 등 실제 계정은 통과.
 */
export function guestGuard(req: Request, _res: Response, next: NextFunction) {
    if (isGuestRole(req.user?.role)) {
        return next(new ForbiddenException("auth.guest_not_allowed", "GUEST_NOT_ALLOWED"))
    }
    next()
}
