/**
 * IGamificationProvider — cross-feature 소비자용 Port
 *
 * GamificationService의 업적 조회 메서드만 노출한다.
 */
export interface IGamificationProvider {
    getAchievements(userId: number): Promise<
        Array<{
            id: string
            title: string
            description: string
            iconName: string
            isUnlocked: boolean
            unlockedAt: Date | null
        }>
    >
}
