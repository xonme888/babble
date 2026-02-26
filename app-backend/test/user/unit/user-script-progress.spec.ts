import "reflect-metadata"
import { UserService } from "@features/user/application/user.service"
import {
    createMockUserRepository,
    createMockDomainEventDispatcher,
    createMockPasswordHasher,
    createMockTokenRotationService,
    createMockLogger,
    createMockUserStatsService,
} from "../../utils/mock-factories"
import type { UserStatsService } from "@features/user/application/user-stats.service"

describe("사용자 구절 진행도 (단위 테스트)", () => {
    let userService: UserService
    let mockStatsService: jest.Mocked<UserStatsService>

    beforeEach(() => {
        mockStatsService = createMockUserStatsService()

        userService = new UserService(
            createMockUserRepository(),
            createMockDomainEventDispatcher(),
            createMockPasswordHasher(),
            createMockTokenRotationService(),
            createMockLogger(),
            mockStatsService
        )
    })

    describe("getScriptProgress", () => {
        it("완료된 평가가 있을 때 completedScriptIds와 bestScores를 반환한다", async () => {
            mockStatsService.getScriptProgress.mockResolvedValue({
                completedScriptIds: [1, 3, 5],
                bestScores: { 1: 92.5, 3: 87.0, 5: 95.0 },
            })

            const result = await userService.getScriptProgress(1)

            expect(result.completedScriptIds).toEqual([1, 3, 5])
            expect(result.bestScores).toEqual({ 1: 92.5, 3: 87.0, 5: 95.0 })
            expect(mockStatsService.getScriptProgress).toHaveBeenCalledWith(1)
        })

        it("완료된 평가가 없을 때 빈 배열을 반환한다", async () => {
            mockStatsService.getScriptProgress.mockResolvedValue({
                completedScriptIds: [],
                bestScores: {},
            })

            const result = await userService.getScriptProgress(1)

            expect(result.completedScriptIds).toEqual([])
            expect(result.bestScores).toEqual({})
        })

        it("동일 스크립트에 대한 여러 평가 중 최고 점수를 반환한다", async () => {
            // Repository가 이미 MAX(score) 쿼리로 최고 점수만 반환
            mockStatsService.getScriptProgress.mockResolvedValue({
                completedScriptIds: [2],
                bestScores: { 2: 95.0 },
            })

            const result = await userService.getScriptProgress(1)

            expect(result.completedScriptIds).toEqual([2])
            expect(result.bestScores[2]).toBe(95.0)
        })
    })
})
