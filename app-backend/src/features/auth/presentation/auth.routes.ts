import { Router } from "express"
import { container } from "tsyringe"
import { AuthController } from "./auth.controller"
import { validateDto } from "@shared/presentation/middlewares/validation.middleware"
import { rateLimitMiddleware } from "@shared/presentation/middlewares/rate-limit.middleware"
import { authGuard } from "./guards/auth.guard"
import {
    RegisterDto,
    LoginDto,
    VerifyEmailDto,
    RequestPasswordResetDto,
    ResetPasswordDto,
    ResendCodeDto,
    RefreshTokenDto,
    CheckEmailDto,
    GuestTokenDto,
    VoiceConsentDto,
    GuestUpgradeDto,
    MergeGuestDto,
} from "./dtos/auth.dto"

export function getAuthRouter(): Router {
    const router = Router()
    const authController = container.resolve(AuthController)

    /**
     * @openapi
     * /auth/check-email:
     *   post:
     *     tags: [인증]
     *     summary: 이메일 중복 체크
     *     description: 이메일이 이미 가입되어 있는지 확인합니다 (인증 여부 무관).
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CheckEmailDto'
     *     security: []
     *     responses:
     *       200:
     *         description: 사용 가능한 이메일
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SuccessResponse'
     *       409:
     *         description: 이미 사용 중인 이메일
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.post(
        "/check-email",
        rateLimitMiddleware("email-check"),
        validateDto(CheckEmailDto),
        (req, res) => authController.checkEmail(req, res)
    )

    /**
     * @openapi
     * /auth/register:
     *   post:
     *     tags: [인증]
     *     summary: 회원가입 요청
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/RegisterDto'
     *     security: []
     *     responses:
     *       201:
     *         description: 가입 성공
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SuccessResponse'
     *       400:
     *         description: 유효성 검증 실패
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.post(
        "/register",
        rateLimitMiddleware("registration"),
        validateDto(RegisterDto),
        (req, res) => authController.register(req, res)
    )

    /**
     * @openapi
     * /auth/verify-email:
     *   post:
     *     tags: [인증]
     *     summary: 이메일 인증 확인
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/VerifyEmailDto'
     *     security: []
     *     responses:
     *       200:
     *         description: 인증 성공
     */
    router.post(
        "/verify-email",
        rateLimitMiddleware("email-verification"),
        validateDto(VerifyEmailDto),
        (req, res) => authController.verifyEmail(req, res)
    )

    /**
     * @openapi
     * /auth/resend-code:
     *   post:
     *     tags: [인증]
     *     summary: 인증 코드 재전송
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ResendCodeDto'
     *     security: []
     *     responses:
     *       200:
     *         description: 재전송 성공
     */
    router.post(
        "/resend-code",
        rateLimitMiddleware("verification-resend"),
        validateDto(ResendCodeDto),
        (req, res) => authController.resendVerificationCode(req, res)
    )

    /**
     * @openapi
     * /auth/login:
     *   post:
     *     tags: [인증]
     *     summary: 로그인
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/LoginDto'
     *     security: []
     *     responses:
     *       200:
     *         description: 로그인 성공 (토큰 반환)
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SuccessResponse'
     *       401:
     *         description: 인증 실패
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.post("/login", rateLimitMiddleware("login-attempt"), validateDto(LoginDto), (req, res) =>
        authController.login(req, res)
    )

    /**
     * @openapi
     * /auth/request-password-reset:
     *   post:
     *     tags: [인증]
     *     summary: 비밀번호 재설정 요청
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/RequestPasswordResetDto'
     *     security: []
     *     responses:
     *       200:
     *         description: 재설정 코드 발송 성공
     */
    router.post(
        "/request-password-reset",
        rateLimitMiddleware("password-reset-request"),
        validateDto(RequestPasswordResetDto),
        (req, res) => authController.requestPasswordReset(req, res)
    )

    /**
     * @openapi
     * /auth/reset-password:
     *   post:
     *     tags: [인증]
     *     summary: 비밀번호 재설정 수행
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ResetPasswordDto'
     *     security: []
     *     responses:
     *       200:
     *         description: 비밀번호 변경 성공
     */
    router.post(
        "/reset-password",
        rateLimitMiddleware("password-reset"),
        validateDto(ResetPasswordDto),
        (req, res) => authController.resetPassword(req, res)
    )

    /**
     * @openapi
     * /auth/refresh:
     *   post:
     *     tags: [인증]
     *     summary: 토큰 갱신
     *     description: |
     *       HttpOnly Cookie에 저장된 `refreshToken`을 사용하여 Access Token을 갱신합니다.
     *       Swagger UI에서는 브라우저가 쿠키를 자동으로 전송하지 못할 수 있으므로, 테스트 시 주의하세요.
     *     requestBody:
     *       required: false
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/RefreshTokenDto'
     *     security: []
     *     responses:
     *       200:
     *         description: 갱신 성공 (Access Token 반환, 새 Refresh Token 쿠키 설정)
     */
    router.post(
        "/refresh",
        rateLimitMiddleware("token-refresh"),
        validateDto(RefreshTokenDto),
        (req, res) => authController.refreshToken(req, res)
    )

    /**
     * @openapi
     * /auth/guest:
     *   post:
     *     tags: [인증]
     *     summary: 게스트 계정 생성 + 토큰 발급
     *     description: |
     *       1단계 서비스 동의를 받은 후 DB에 GUEST User를 생성하고 JWT 토큰을 발급합니다.
     *       같은 deviceId로 기존 게스트가 있으면 기존 계정의 토큰을 반환합니다.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/GuestTokenDto'
     *     security: []
     *     responses:
     *       201:
     *         description: 게스트 계정 생성 성공
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SuccessResponse'
     *       409:
     *         description: 해당 deviceId로 이미 정식 회원 승격된 계정 존재
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       429:
     *         description: 요청 제한 초과
     */
    router.post(
        "/guest",
        rateLimitMiddleware("guest-token"),
        validateDto(GuestTokenDto),
        (req, res) => authController.issueGuestToken(req, res)
    )

    /**
     * @openapi
     * /auth/guest/voice-consent:
     *   post:
     *     tags: [인증]
     *     summary: 2단계 음성 데이터 수집 동의
     *     description: 게스트 사용자의 음성 데이터 수집 동의를 기록합니다.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/VoiceConsentDto'
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: 음성 동의 기록 성공
     */
    router.post(
        "/guest/voice-consent",
        authGuard,
        validateDto(VoiceConsentDto),
        (req, res) => authController.voiceConsent(req, res)
    )

    /**
     * @openapi
     * /auth/guest/upgrade:
     *   post:
     *     tags: [인증]
     *     summary: 게스트 → 정식 회원 승격
     *     description: 게스트 계정을 이메일/비밀번호로 정식 회원으로 승격합니다. 기존 데이터가 모두 유지됩니다.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/GuestUpgradeDto'
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: 승격 성공
     */
    router.post(
        "/guest/upgrade",
        authGuard,
        rateLimitMiddleware("registration"),
        validateDto(GuestUpgradeDto),
        (req, res) => authController.upgradeGuest(req, res)
    )

    /**
     * @openapi
     * /auth/merge-guest:
     *   post:
     *     tags: [인증]
     *     summary: 게스트 데이터를 기존 회원에 병합
     *     description: 게스트 계정의 활동 데이터를 로그인한 기존 회원 계정으로 이전합니다.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/MergeGuestDto'
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: 병합 성공
     */
    router.post(
        "/merge-guest",
        authGuard,
        validateDto(MergeGuestDto),
        (req, res) => authController.mergeGuest(req, res)
    )

    /**
     * @openapi
     * /auth/guest:
     *   delete:
     *     tags: [인증]
     *     summary: 게스트 본인 데이터 삭제
     *     description: 게스트 사용자가 자신의 계정과 모든 연관 데이터를 삭제합니다.
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       204:
     *         description: 삭제 성공
     */
    router.delete("/guest", authGuard, (req, res) =>
        authController.deleteGuest(req, res)
    )

    /**
     * @openapi
     * /auth/logout:
     *   post:
     *     tags: [인증]
     *     summary: 로그아웃 (서버측 토큰 무효화)
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: 로그아웃 성공
     *       401:
     *         description: 인증 실패
     */
    router.post("/logout", authGuard, rateLimitMiddleware("logout"), (req, res) =>
        authController.logout(req, res)
    )

    /**
     * @openapi
     * /auth/logout-all:
     *   post:
     *     tags: [인증]
     *     summary: 전체 세션 로그아웃 (모든 클라이언트)
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: 전체 로그아웃 성공
     *       401:
     *         description: 인증 실패
     */
    router.post("/logout-all", authGuard, rateLimitMiddleware("logout"), (req, res) =>
        authController.logoutAll(req, res)
    )

    return router
}
