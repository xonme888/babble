import { ClientType } from "./client-type"

/**
 * Auth 피처 Redis 키 빌더
 * 키 패턴을 단일 소스로 관리하여 오타/불일치 방지
 */
export const AuthRedisKeys = {
    /** 이메일 인증 코드 */
    verification: (email: string) => `verify:${email}`,
    /** 비밀번호 재설정 코드 */
    passwordReset: (email: string) => `reset:${email}`,
    /** Refresh 토큰 (클라이언트별) */
    refreshToken: (userId: number, clientType: ClientType) => `refresh:${userId}:${clientType}`,
    /** Refresh 토큰 이전 값 (Grace period용) */
    refreshTokenPrev: (userId: number, clientType: ClientType) =>
        `refresh:${userId}:${clientType}:prev`,
    /** Refresh 토큰 갱신 분산 락 */
    refreshLock: (userId: number, clientType: ClientType) =>
        `lock:refresh:${userId}:${clientType}`,
    /** Access 토큰 블랙리스트 */
    blacklist: (token: string) => `blacklist:${token}`,
} as const

/** 지원하는 클라이언트 타입 목록 */
export const CLIENT_TYPES: readonly ClientType[] = ["mobile", "admin", "therapy"] as const
