import { IsEmail, IsString, IsBoolean, IsInt, Min, MinLength, IsOptional, MaxLength } from "class-validator"

/**
 * @openapi
 * components:
 *   schemas:
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           type: object
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *         errorCode:
 *           type: string
 *         errorKey:
 *           type: string
 *     RegisterDto:
 *       type: object
 *       required: [email, password, firstName, agreedToTerms]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 8
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         agreedToTerms:
 *           type: boolean
 */
export class RegisterDto {
    @IsEmail({}, { message: "validation.email.invalid_format" })
    @MaxLength(254)
    email!: string

    @IsString()
    @MinLength(8, { message: "validation.password.length" })
    @MaxLength(128, { message: "validation.password.max_length" })
    password!: string

    @IsString()
    @MinLength(2)
    @MaxLength(50)
    firstName!: string

    @IsOptional()
    @IsString()
    @MaxLength(50)
    lastName?: string

    @IsBoolean({ message: "validation.terms.required" })
    agreedToTerms!: boolean
}

/**
 * @openapi
 * components:
 *   schemas:
 *     LoginDto:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *         strategy:
 *           type: string
 *           default: email
 */
export class LoginDto {
    @IsEmail({}, { message: "validation.email.invalid_format" })
    @MaxLength(254)
    email!: string

    @IsString()
    @MaxLength(128, { message: "validation.password.max_length" })
    password!: string

    @IsOptional()
    @IsString()
    @MaxLength(20)
    strategy?: string = "email"
}

/**
 * @openapi
 * components:
 *   schemas:
 *     VerifyEmailDto:
 *       type: object
 *       required: [email, code]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         code:
 *           type: string
 *           minLength: 6
 *           maxLength: 6
 */
export class VerifyEmailDto {
    @IsEmail({}, { message: "validation.email.invalid_format" })
    @MaxLength(254)
    email!: string

    @IsString()
    @MinLength(6, { message: "validation.code.length" })
    @MaxLength(6, { message: "validation.code.length" })
    code!: string
}

/**
 * @openapi
 * components:
 *   schemas:
 *     RequestPasswordResetDto:
 *       type: object
 *       required: [email]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 */
export class RequestPasswordResetDto {
    @IsEmail({}, { message: "validation.email.invalid_format" })
    @MaxLength(254)
    email!: string
}

/**
 * @openapi
 * components:
 *   schemas:
 *     ResetPasswordDto:
 *       type: object
 *       required: [email, code, newPassword]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         code:
 *           type: string
 *           minLength: 6
 *           maxLength: 6
 *         newPassword:
 *           type: string
 *           minLength: 8
 */
export class ResetPasswordDto {
    @IsEmail({}, { message: "validation.email.invalid_format" })
    @MaxLength(254)
    email!: string

    @IsString()
    @MinLength(6, { message: "validation.code.length" })
    @MaxLength(6, { message: "validation.code.length" })
    code!: string

    @IsString()
    @MinLength(8, { message: "validation.password.length" })
    @MaxLength(128, { message: "validation.password.max_length" })
    newPassword!: string
}

/**
 * @openapi
 * components:
 *   schemas:
 *     RefreshTokenDto:
 *       type: object
 *       properties:
 *         refreshToken:
 *           type: string
 *           description: 모바일 클라이언트용. 브라우저는 HttpOnly 쿠키 사용
 */
export class RefreshTokenDto {
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    refreshToken?: string
}

/**
 * @openapi
 * components:
 *   schemas:
 *     ResendCodeDto:
 *       type: object
 *       required: [email]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 */
export class ResendCodeDto {
    @IsEmail({}, { message: "validation.email.invalid_format" })
    @MaxLength(254)
    email!: string
}

/**
 * @openapi
 * components:
 *   schemas:
 *     CheckEmailDto:
 *       type: object
 *       required: [email]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 */
export class CheckEmailDto {
    @IsEmail({}, { message: "validation.email.invalid_format" })
    @MaxLength(254)
    email!: string
}

/**
 * @openapi
 * components:
 *   schemas:
 *     GuestTokenDto:
 *       type: object
 *       required: [deviceId, serviceConsentVersion]
 *       properties:
 *         deviceId:
 *           type: string
 *           description: 클라이언트 UUID
 *         serviceConsentVersion:
 *           type: string
 *           description: 1단계 서비스 동의 약관 버전
 */
export class GuestTokenDto {
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    deviceId!: string

    @IsString()
    @MinLength(1)
    @MaxLength(50)
    serviceConsentVersion!: string
}

/**
 * @openapi
 * components:
 *   schemas:
 *     VoiceConsentDto:
 *       type: object
 *       required: [voiceConsentVersion]
 *       properties:
 *         voiceConsentVersion:
 *           type: string
 *           description: 2단계 음성 동의 약관 버전
 */
export class VoiceConsentDto {
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    voiceConsentVersion!: string
}

/**
 * @openapi
 * components:
 *   schemas:
 *     GuestUpgradeDto:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 8
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 */
export class GuestUpgradeDto {
    @IsEmail({}, { message: "validation.email.invalid_format" })
    @MaxLength(254)
    email!: string

    @IsString()
    @MinLength(8, { message: "validation.password.length" })
    @MaxLength(128, { message: "validation.password.max_length" })
    password!: string

    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    firstName?: string

    @IsOptional()
    @IsString()
    @MaxLength(50)
    lastName?: string
}

/**
 * @openapi
 * components:
 *   schemas:
 *     MergeGuestDto:
 *       type: object
 *       required: [guestUserId]
 *       properties:
 *         guestUserId:
 *           type: integer
 *           description: 병합할 게스트 User ID
 */
export class MergeGuestDto {
    @IsInt()
    @Min(1)
    guestUserId!: number
}
