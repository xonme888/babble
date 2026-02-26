import { Request, Response, NextFunction } from "express"
import { container } from "tsyringe"
import type { IUserRepository } from "@features/user/domain/user-repository.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { ForbiddenException } from "@shared/core/exceptions/domain-exceptions"

/**
 * 음성 동의 확인 미들웨어 — authGuard 뒤에 배치
 *
 * 2단계 음성 동의(voiceConsentAt)가 없는 사용자의 음성 업로드를 차단한다.
 * 정식 회원(USER/ADMIN)은 가입 시 전체 약관 동의이므로 통과.
 */
export async function voiceConsentGuard(req: Request, _res: Response, next: NextFunction) {
    const userId = req.user?.id
    if (!userId) {
        return next(new ForbiddenException("auth.unauthorized"))
    }

    const userRepository = container.resolve<IUserRepository>(DI_TOKENS.IUserRepository)
    const user = await userRepository.findById(userId)
    if (!user) {
        return next(new ForbiddenException("auth.unauthorized"))
    }

    // 정식 회원은 가입 시 약관 동의 완료 → 음성 동의 확인 불필요
    if (!user.isGuest()) {
        return next()
    }

    // 게스트는 2단계 음성 동의가 있어야 음성 업로드 가능
    if (!user.hasVoiceConsent()) {
        return next(new ForbiddenException("voice_consent.required", "VOICE_CONSENT_REQUIRED"))
    }

    next()
}
