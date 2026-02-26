import { Request, Response, CookieOptions } from "express"
import { injectable, inject } from "tsyringe"
import { AuthService } from "../application/auth.service"
import { VerificationService } from "../application/verification.service"
import { PasswordResetService } from "../application/password-reset.service"
import { ClientType } from "../domain/client-type"
import type { IConfigService } from "@shared/core/config.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { ValidationException } from "@shared/core/exceptions/domain-exceptions"
import { translate } from "@shared/presentation/helpers/i18n.helper"
import { RegisterResponseDto, LoginUserDto } from "./dtos/auth-response.dto"
import { extractUserId } from "@shared/presentation/helpers/request.helper"

@injectable()
export class AuthController {
    constructor(
        @inject(AuthService) private authService: AuthService,
        @inject(VerificationService) private verificationService: VerificationService,
        @inject(PasswordResetService) private passwordResetService: PasswordResetService,
        @inject(DI_TOKENS.IConfigService) private configService: IConfigService
    ) {}

    /**
     * 클라이언트 타입 판별 — Origin 헤더 기반 (스푸핑 방지)
     * Origin 헤더가 있으면 브라우저(admin), 없으면 x-client-type 확인
     */
    private resolveClientType(req: Request): ClientType {
        if (req.headers.origin) {
            return "admin"
        }
        if (req.headers["x-client-type"] === "mobile") {
            return "mobile"
        }
        return "admin"
    }

    private getRefreshCookieOptions(): CookieOptions {
        return {
            httpOnly: true,
            secure: this.configService.config.env === "production",
            sameSite: "strict",
            maxAge: this.configService.config.auth.refreshTokenMaxAge,
            path: "/",
        }
    }

    private extractBearerToken(req: Request): string | undefined {
        return req.headers.authorization?.split(" ")[1]
    }

    private getClearCookieOptions(): CookieOptions {
        return {
            httpOnly: true,
            secure: this.configService.config.env === "production",
            sameSite: "strict",
            path: "/",
        }
    }

    /**
     * 토큰 응답 공통 처리 — 쿠키 설정 + 모바일 분기
     * login과 refreshToken에서 공통 사용
     */
    private sendTokenResponse(
        req: Request,
        res: Response,
        clientType: string,
        tokens: { accessToken: string; refreshToken: string },
        messageKey: string,
        messageFallback: string,
        extraData?: object
    ): void {
        // Refresh Token을 HttpOnly Cookie로 설정 (보안 강화)
        res.cookie("refreshToken", tokens.refreshToken, this.getRefreshCookieOptions())

        // 모바일 클라이언트만 body에 refreshToken 포함 (Origin 기반 판별)
        const isMobile = clientType === "mobile"

        res.status(200).json({
            success: true,
            message: translate(req, messageKey, messageFallback),
            data: {
                accessToken: tokens.accessToken,
                ...(isMobile && { refreshToken: tokens.refreshToken }),
                ...extraData,
            },
        })
    }

    async checkEmail(req: Request, res: Response) {
        const { email } = req.body
        await this.authService.checkEmailAvailability(email)

        return res.status(200).json({
            success: true,
            message: translate(req, "auth.email_available", "Email is available"),
            data: { available: true },
        })
    }

    async register(req: Request, res: Response) {
        const { email, password, firstName, lastName, agreedToTerms } = req.body
        const user = await this.authService.register(email, password, firstName, lastName, agreedToTerms)

        return res.status(201).json({
            success: true,
            message: translate(req, "auth.registration_success", "Registration successful"),
            data: RegisterResponseDto.from(user),
        })
    }

    async verifyEmail(req: Request, res: Response) {
        const { email, code } = req.body
        await this.verificationService.verifyEmail(email, code)

        return res.status(200).json({
            success: true,
            message: translate(req, "auth.email_verified_success", "Email verified successfully"),
        })
    }

    async resendVerificationCode(req: Request, res: Response) {
        const { email } = req.body
        await this.verificationService.resendVerificationCode(email)

        return res.status(200).json({
            success: true,
            message: translate(req, "auth.verification_code_resent", "Verification code resent"),
        })
    }

    async login(req: Request, res: Response) {
        const { strategy = "email", ...credentials } = req.body
        const clientType = this.resolveClientType(req)
        const tokens = await this.authService.login(strategy, credentials, clientType)

        return this.sendTokenResponse(
            req, res, clientType, tokens,
            "auth.login_success", "Login successful",
            { user: LoginUserDto.from(tokens.user) }
        )
    }

    async requestPasswordReset(req: Request, res: Response) {
        const { email } = req.body
        await this.passwordResetService.requestPasswordReset(email)

        return res.status(200).json({
            success: true,
            message: translate(req, "auth.password_reset_sent", "Password reset email sent"),
        })
    }

    async resetPassword(req: Request, res: Response) {
        const { email, code, newPassword } = req.body
        await this.passwordResetService.resetPassword(email, code, newPassword)

        return res.status(200).json({
            success: true,
            message: translate(req, "auth.password_reset_success", "Password reset successful"),
        })
    }

    async refreshToken(req: Request, res: Response) {
        // 쿠키에서 먼저 찾고, 없으면 바디에서 찾음
        const refreshToken = req.cookies.refreshToken ?? req.body.refreshToken

        if (!refreshToken) {
            throw new ValidationException("validation.token.missing")
        }

        const clientType = this.resolveClientType(req)
        const tokens = await this.authService.refreshToken(refreshToken, clientType)

        return this.sendTokenResponse(
            req, res, clientType, tokens,
            "auth.token_refreshed", "Token refreshed"
        )
    }

    async logout(req: Request, res: Response) {
        const token = this.extractBearerToken(req)

        // 의도적 skip: 보안상 토큰 유무를 응답으로 노출하지 않음 (항상 200)
        if (token) {
            const clientType = this.resolveClientType(req)
            await this.authService.logout(token, clientType)
        }

        // 쿠키 삭제 (보안 플래그 포함)
        res.clearCookie("refreshToken", this.getClearCookieOptions())

        return res.status(200).json({
            success: true,
            message: translate(req, "auth.logout_success", "Logout successful"),
        })
    }

    async logoutAll(req: Request, res: Response) {
        const token = this.extractBearerToken(req)

        // 의도적 skip: 보안상 토큰 유무를 응답으로 노출하지 않음 (항상 200)
        if (token) {
            await this.authService.logoutAll(token)
        }

        // 쿠키 삭제 (보안 플래그 포함)
        res.clearCookie("refreshToken", this.getClearCookieOptions())

        return res.status(200).json({
            success: true,
            message: translate(req, "auth.logout_all_success", "All sessions logged out"),
        })
    }

    /**
     * POST /auth/guest — 게스트 계정 생성 + 토큰 발급
     * 1단계 동의(serviceConsentVersion) 필수. DB에 GUEST User 행 생성.
     */
    async issueGuestToken(req: Request, res: Response) {
        const { deviceId, serviceConsentVersion } = req.body
        const clientType = this.resolveClientType(req)

        const tokens = await this.authService.createGuestAccount(
            deviceId,
            serviceConsentVersion,
            clientType
        )

        // 게스트도 Refresh Token 쿠키 설정
        res.cookie("refreshToken", tokens.refreshToken, this.getRefreshCookieOptions())

        const isMobile = clientType === "mobile"

        return res.status(201).json({
            success: true,
            message: translate(req, "auth.guest_token_issued", "Guest account created"),
            data: {
                accessToken: tokens.accessToken,
                ...(isMobile && { refreshToken: tokens.refreshToken }),
            },
        })
    }

    /** POST /auth/guest/voice-consent — 2단계 음성 동의 */
    async voiceConsent(req: Request, res: Response) {
        const userId = extractUserId(req)
        const { voiceConsentVersion } = req.body

        const voiceConsentAt = await this.authService.recordVoiceConsent(userId, voiceConsentVersion)

        return res.status(200).json({
            success: true,
            message: translate(req, "auth.voice_consent_recorded", "Voice consent recorded"),
            data: { voiceConsentAt },
        })
    }

    /** POST /auth/guest/upgrade — 게스트 → 정식 회원 승격 */
    async upgradeGuest(req: Request, res: Response) {
        const userId = extractUserId(req)
        const { email, password, firstName, lastName } = req.body
        const clientType = this.resolveClientType(req)

        const result = await this.authService.upgradeGuest(
            userId, email, password, firstName, lastName, clientType
        )

        return this.sendTokenResponse(
            req, res, clientType, result,
            "auth.guest_upgraded", "Guest account upgraded",
            { user: LoginUserDto.from(result.user) }
        )
    }

    /** POST /auth/merge-guest — 게스트 데이터를 기존 회원에 병합 */
    async mergeGuest(req: Request, res: Response) {
        const targetUserId = extractUserId(req)
        const { guestUserId } = req.body

        await this.authService.mergeGuestToUser(guestUserId, targetUserId)

        return res.status(200).json({
            success: true,
            message: translate(req, "auth.guest_merged", "Guest data merged"),
        })
    }

    /** DELETE /auth/guest — 게스트 본인 데이터 삭제 */
    async deleteGuest(req: Request, res: Response) {
        const userId = extractUserId(req)
        await this.authService.deleteGuestAccount(userId)

        res.clearCookie("refreshToken", this.getClearCookieOptions())

        return res.status(204).send()
    }
}
