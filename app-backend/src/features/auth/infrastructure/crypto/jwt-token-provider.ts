import { injectable, inject } from "tsyringe"
import * as jwt from "jsonwebtoken"
import { randomUUID } from "crypto"
import { ITokenProvider, TokenVerifyResult } from "../../domain/token-provider.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import type { IConfigService } from "@shared/core/config.interface"

/**
 * JWT 기반 토큰 제공자 구현체 (Auth Domain Infrastructure)
 */
@injectable()
export class JwtTokenProvider implements ITokenProvider {
    private readonly secret: string
    private readonly refreshSecret: string
    private readonly accessTokenExpiry: string
    private readonly refreshTokenExpiry: string

    constructor(@inject(DI_TOKENS.IConfigService) private configService: IConfigService) {
        const jwtConfig = this.configService.config.jwt
        this.secret = jwtConfig.secret
        this.refreshSecret = jwtConfig.refreshSecret
        this.accessTokenExpiry = jwtConfig.accessExpiry
        this.refreshTokenExpiry = jwtConfig.refreshExpiry
    }

    /**
     * 액세스 토큰 생성 (짧은 유효기간)
     */
    generateAccessToken(userId: number, role?: string, expiresIn?: string): string {
        const payload: Record<string, unknown> = { userId }
        if (role) payload.role = role
        return jwt.sign(payload, this.secret, {
            algorithm: "HS256",
            expiresIn: expiresIn ?? this.accessTokenExpiry,
            jwtid: randomUUID(),
        } as jwt.SignOptions)
    }

    /**
     * 리프레시 토큰 생성 (긴 유효기간, 별도 시크릿 사용)
     */
    generateRefreshToken(userId: number): string {
        return jwt.sign({ userId }, this.refreshSecret, {
            algorithm: "HS256",
            expiresIn: this.refreshTokenExpiry,
            jwtid: randomUUID(),
        } as jwt.SignOptions)
    }

    /**
     * 토큰 검증 및 페이로드 추출
     * @param token JWT 토큰
     * @param type 토큰 타입 (기본값: 'access')
     */
    verifyToken(token: string, type: "access" | "refresh" = "access"): TokenVerifyResult {
        try {
            const secret = type === "refresh" ? this.refreshSecret : this.secret
            const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as {
                userId: number
                role?: string
                exp?: number
                iat?: number
            }
            return { valid: true, payload: decoded }
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                return { valid: false, reason: "expired" }
            }
            return { valid: false, reason: "invalid" }
        }
    }
}
