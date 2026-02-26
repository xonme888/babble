import { injectable } from "tsyringe"

/** 토큰 상태 */
export type TokenStatus = "current" | "previous" | "revoked"

/**
 * TokenRefreshPolicy (Domain Service)
 *
 * 토큰 갱신 시 상태 판정 규칙
 * - 현재 토큰 일치 → current (정상 갱신)
 * - 이전 토큰 일치 → previous (grace period 내 재시도)
 * - 불일치 → revoked (탈취 가능)
 */
@injectable()
export class TokenRefreshPolicy {
    /** 네트워크 재시도 레이스 컨디션 방지 (초) */
    static readonly GRACE_PERIOD_SECONDS = 10

    /**
     * 토큰 상태 판정
     * @param storedToken Redis에 저장된 현재 토큰
     * @param previousToken Grace period 키에 저장된 이전 토큰
     * @param incomingToken 클라이언트가 전송한 토큰
     */
    determineTokenStatus(
        storedToken: string | null,
        previousToken: string | null,
        incomingToken: string
    ): TokenStatus {
        if (storedToken === incomingToken) return "current"
        if (previousToken === incomingToken) return "previous"
        return "revoked"
    }
}
