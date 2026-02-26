import "reflect-metadata"
import { UserController } from "@features/user/presentation/user.controller"
import { Request, Response } from "express"
import {
    createMockGamificationService,
} from "../../utils/mock-factories"

import type { UserService } from "@features/user/application/user.service"
import type { GamificationService } from "@features/gamification/application/gamification.service"

export {}

describe("UserController (사용자 컨트롤러)", () => {
    let controller: UserController
    let userService: jest.Mocked<UserService>
    let gamificationService: jest.Mocked<GamificationService>
    let req: Partial<Request>
    let res: Partial<Response>

    beforeEach(() => {
        userService = {
            getById: jest.fn(),
            getByEmail: jest.fn(),
            getAll: jest.fn(),
            getStats: jest.fn(),
            getScriptProgress: jest.fn(),
            updateProfile: jest.fn(),
            updateWeeklyGoal: jest.fn(),
            changePassword: jest.fn(),
            withdraw: jest.fn(),
            verifyEmail: jest.fn(),
            adminUpdateUser: jest.fn(),
        } as unknown as jest.Mocked<UserService>

        gamificationService = createMockGamificationService()

        controller = new UserController(userService, gamificationService)

        req = { user: { id: 1 } as unknown }
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        }
    })

    describe("getAchievements (업적 조회)", () => {
        it("GamificationService에 위임해야 한다", async () => {
            // Given
            const mockAchievements = [
                { id: "1", title: "첫 걸음", isUnlocked: true },
                { id: "2", title: "일주일 연속", isUnlocked: false },
            ]
            gamificationService.getAchievements.mockResolvedValue(mockAchievements)

            // When
            await controller.getAchievements(req as Request, res as Response)

            // Then
            expect(gamificationService.getAchievements).toHaveBeenCalledWith(1)
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: mockAchievements,
            })
        })
    })
})
