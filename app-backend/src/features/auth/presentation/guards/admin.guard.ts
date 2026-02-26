import { Request, Response, NextFunction } from "express"
import { container } from "tsyringe"
import type { IUserRepository } from "@features/user/domain/user-repository.interface"
import { UserRole } from "@features/user/domain/user.entity"
import { DI_TOKENS } from "@shared/core/di-tokens"
import {
    UnauthorizedException,
    ForbiddenException,
} from "@shared/core/exceptions/domain-exceptions"

/**
 * 어드민 권한 체크 미들웨어 (Auth Feature)
 * - authGuard 이후에 사용되어야 함 (req.user 필요)
 * - JWT에 role이 있으면 DB 조회 없이 판단 (새 토큰)
 * - role이 없으면 DB 폴백 (기존 토큰 하위 호환)
 */
export async function adminGuard(req: Request, res: Response, next: NextFunction) {
    if (!req.user?.id) {
        return next(new UnauthorizedException("validation.token.missing"))
    }

    // JWT에서 role이 있는 경우 (새 토큰) — DB 조회 불필요
    if (req.user.role) {
        if (req.user.role !== UserRole.ADMIN) {
            return next(new ForbiddenException("auth.admin_required"))
        }
        return next()
    }

    // JWT에 role이 없는 경우 (기존 토큰) — DB 폴백
    const userRepository = container.resolve<IUserRepository>(DI_TOKENS.IUserRepository)
    const user = await userRepository.findById(req.user.id)

    if (!user || user.role !== UserRole.ADMIN) {
        return next(new ForbiddenException("auth.admin_required"))
    }

    next()
}
