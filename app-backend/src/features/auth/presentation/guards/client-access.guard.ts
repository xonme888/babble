import { Request, Response, NextFunction } from "express"
import { container } from "tsyringe"
import { UserRole } from "@features/user/domain/user.entity"
import { DI_TOKENS } from "@shared/core/di-tokens"
import type { ITherapistClientChecker } from "@features/therapy/domain/therapist-client-checker.interface"
import {
    UnauthorizedException,
    ForbiddenException,
} from "@shared/core/exceptions/domain-exceptions"

/**
 * 환자 접근 권한 체크 미들웨어
 * - therapistGuard 이후에 체인
 * - req.params.clientId의 therapist-client 관계 검증
 * - ADMIN은 전체 접근 허용
 */
export async function clientAccessGuard(req: Request, res: Response, next: NextFunction) {
    if (req.user?.role === UserRole.ADMIN) {
        return next()
    }

    if (!req.user?.id) {
        return next(new UnauthorizedException("validation.token.missing"))
    }

    const therapistId = req.user.id
    const clientId = parseInt(req.params.clientId as string, 10)

    if (isNaN(clientId)) {
        return next(new ForbiddenException("therapy.invalid_client_id"))
    }

    const checker = container.resolve<ITherapistClientChecker>(DI_TOKENS.ITherapistClientChecker)
    const isLinked = await checker.isLinked(therapistId, clientId)

    if (!isLinked) {
        return next(new ForbiddenException("therapy.not_your_client"))
    }

    next()
}
