/**
 * IUserStatsUpdater — cross-feature 소비자용 Port
 *
 * UserStatsService의 캐시 무효화 메서드만 노출한다.
 */
export interface IUserStatsUpdater {
    invalidateStatsCache(userId: number): Promise<void>
}
