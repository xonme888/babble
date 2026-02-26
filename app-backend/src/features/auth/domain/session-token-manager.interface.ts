/**
 * ISessionTokenManager — cross-feature 소비자용 Port
 *
 * TokenRotationService의 세션 무효화 메서드만 노출한다.
 */
export interface ISessionTokenManager {
    clearAllClientTokens(userId: number): Promise<void>
}
