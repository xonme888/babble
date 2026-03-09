import "reflect-metadata"
import { GuestAccountCleaner } from "../../../src/features/user/cron/guest-account-cleaner"
import { createMockUserRepository, createMockLogger } from "../../utils/mock-factories"
import { User, UserRole } from "../../../src/features/user/domain/user.entity"

export {}

describe("GuestAccountCleaner", () => {
    let cleaner: GuestAccountCleaner
    let mockUserRepo: ReturnType<typeof createMockUserRepository>
    let mockLogger: ReturnType<typeof createMockLogger>

    beforeEach(() => {
        mockUserRepo = createMockUserRepository()
        mockLogger = createMockLogger()
        cleaner = new GuestAccountCleaner(
            mockUserRepo as unknown as ConstructorParameters<typeof GuestAccountCleaner>[0],
            mockLogger
        )
    })

    describe("cleanUp", () => {
        it("동의 미수집 게스트를 hard delete 한다", async () => {
            const guest = { id: 100, role: UserRole.GUEST, serviceConsentAt: null } as User
            mockUserRepo.findNoConsentGuests.mockResolvedValue([guest])
            mockUserRepo.findInactiveGuests.mockResolvedValue([])

            await cleaner.cleanUp()

            expect(mockUserRepo.findNoConsentGuests).toHaveBeenCalledTimes(1)
            expect(mockUserRepo.hardDeleteBatch).toHaveBeenCalledWith([100])
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("동의 미수집 게스트 1건 hard delete")
            )
        })

        it("비활성 게스트를 soft delete 한다", async () => {
            const guest = { id: 200, role: UserRole.GUEST } as User
            mockUserRepo.findNoConsentGuests.mockResolvedValue([])
            mockUserRepo.findInactiveGuests.mockResolvedValue([guest])

            await cleaner.cleanUp()

            expect(mockUserRepo.findInactiveGuests).toHaveBeenCalledTimes(1)
            expect(mockUserRepo.softDeleteBatch).toHaveBeenCalledWith([200])
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("비활성 게스트 1건 soft delete")
            )
        })

        it("정리 대상이 없으면 아무 작업도 하지 않는다", async () => {
            mockUserRepo.findNoConsentGuests.mockResolvedValue([])
            mockUserRepo.findInactiveGuests.mockResolvedValue([])

            await cleaner.cleanUp()

            expect(mockUserRepo.hardDeleteBatch).not.toHaveBeenCalled()
            expect(mockUserRepo.softDeleteBatch).not.toHaveBeenCalled()
        })

        it("여러 게스트를 일괄 처리한다", async () => {
            const guests = [
                { id: 1, role: UserRole.GUEST } as User,
                { id: 2, role: UserRole.GUEST } as User,
                { id: 3, role: UserRole.GUEST } as User,
            ]
            mockUserRepo.findNoConsentGuests.mockResolvedValue(guests)
            mockUserRepo.findInactiveGuests.mockResolvedValue([])

            await cleaner.cleanUp()

            expect(mockUserRepo.hardDeleteBatch).toHaveBeenCalledTimes(1)
            expect(mockUserRepo.hardDeleteBatch).toHaveBeenCalledWith([1, 2, 3])
        })

        it("동의 미수집 정리 실패 시 에러 로그를 남기고 비활성 정리는 계속 진행한다", async () => {
            mockUserRepo.findNoConsentGuests.mockRejectedValue(new Error("DB error"))
            const guest = { id: 200, role: UserRole.GUEST } as User
            mockUserRepo.findInactiveGuests.mockResolvedValue([guest])

            await cleaner.cleanUp()

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("동의 미수집 게스트 정리 실패")
            )
            expect(mockUserRepo.softDeleteBatch).toHaveBeenCalledWith([200])
        })

        it("비활성 게스트 정리 실패 시 에러 로그를 남긴다", async () => {
            mockUserRepo.findNoConsentGuests.mockResolvedValue([])
            mockUserRepo.findInactiveGuests.mockRejectedValue(new Error("DB error"))

            await cleaner.cleanUp()

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("비활성 게스트 정리 실패")
            )
        })
    })
})
