import { User } from "@features/user/domain/user.entity"

/**
 * 로그인 전략 인터페이스 (Strategy Pattern)
 *
 * 다양한 로그인 방식을 지원하기 위한 인터페이스
 * - Email/Password
 * - OAuth (Google, Facebook 등)
 * - SSO
 */
export interface ILoginStrategy {
    /**
     * 전략 이름 반환
     */
    getName(): string

    /**
     * 로그인 수행
     * @param credentials 인증 정보 (전략마다 다름)
     * @returns 인증된 사용자
     */
    login(credentials: Record<string, unknown>): Promise<User>
}
