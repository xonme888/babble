/**
 * 토큰 검증 결과 — discriminated union
 * valid: true → 페이로드 포함, valid: false → 실패 사유 (expired | invalid)
 */
export type TokenVerifyResult =
    | { valid: true; payload: { userId: number; role?: string; exp?: number; iat?: number } }
    | { valid: false; reason: "expired" | "invalid" }

/**
 * JWT 토큰 생성/검증을 위한 포트 인터페이스 (Auth Domain)
 */
export interface ITokenProvider {
    /**
     * 사용자 ID로부터 액세스 토큰 생성
     * @param expiresIn 커스텀 만료 시간 (예: "1h") — 미지정 시 기본값 사용
     */
    generateAccessToken(userId: number, role?: string, expiresIn?: string): string

    /**
     * 사용자 ID로부터 리프레시 토큰 생성
     */
    generateRefreshToken(userId: number): string

    /**
     * 토큰을 검증하고 결과 반환
     * @param token JWT 토큰
     * @param type 토큰 타입 (기본값: 'access')
     */
    verifyToken(token: string, type?: "access" | "refresh"): TokenVerifyResult
}
