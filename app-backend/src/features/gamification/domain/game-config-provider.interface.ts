/**
 * 게임 설정 조회 인터페이스 (도메인 계층)
 *
 * 도메인 서비스(GameXpCalculator)가 설정값에 접근하기 위한 포트.
 * Application 계층의 GameConfigService가 이 인터페이스를 구현한다.
 */
export interface IGameConfigProvider {
    /** 설정 키 조회, 미설정 시 defaultValue 반환 */
    get<T>(key: string, defaultValue: T): T
}
