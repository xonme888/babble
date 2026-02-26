// typeorm-transactional을 no-op mock (단위 테스트에서 DB 불필요)
jest.mock("typeorm-transactional", () => ({
    Transactional:
        () => (_target: Record<string, unknown>, _key: string, descriptor: PropertyDescriptor) =>
            descriptor,
    initializeTransactionalContext: jest.fn(),
    addTransactionalDataSource: (dataSource: unknown) => dataSource,
}))

import "reflect-metadata"
import { GameConfigService } from "@features/gamification/application/game-config.service"
import { GameConfig } from "@features/gamification/domain/game-config.entity"
import { GameConfigHistory } from "@features/gamification/domain/game-config-history.entity"
import { NotFoundException, ValidationException } from "@shared/core/exceptions/domain-exceptions"
import { createMockGameConfigRepository, createMockLogger } from "../../utils/mock-factories"

import type { GameConfigRepository } from "@features/gamification/infrastructure/game-config.repository"
import type { ILogger } from "@shared/core/logger.interface"

describe("GameConfigService (게임 설정 서비스)", () => {
    let service: GameConfigService
    let repo: jest.Mocked<GameConfigRepository>
    let logger: jest.Mocked<ILogger>

    beforeEach(() => {
        repo = createMockGameConfigRepository()
        logger = createMockLogger()
        service = new GameConfigService(repo, logger)
    })

    describe("loadAll (전체 캐시 로드)", () => {
        it("DB에서 전체 설정을 로드하여 캐시에 저장한다", async () => {
            // Given
            const configs: GameConfig[] = [
                {
                    id: 1,
                    key: "xp.game.firstClear",
                    value: 20,
                    description: "최초 클리어",
                    category: "xp",
                    updatedAt: new Date("2026-01-01"),
                    updatedBy: null,
                },
                {
                    id: 2,
                    key: "hint.maxPerSentence",
                    value: 2,
                    description: "힌트 최대",
                    category: "hint",
                    updatedAt: new Date("2026-01-01"),
                    updatedBy: null,
                },
            ]
            repo.findAll.mockResolvedValue(configs)

            // When
            await service.loadAll()

            // Then
            expect(repo.findAll).toHaveBeenCalledTimes(1)
            expect(service.get("xp.game.firstClear", 0)).toBe(20)
            expect(service.get("hint.maxPerSentence", 0)).toBe(2)
        })

        it("중복 호출 시 캐시를 재초기화한다", async () => {
            // Given
            repo.findAll
                .mockResolvedValueOnce([
                    {
                        id: 1,
                        key: "xp.game.firstClear",
                        value: 10,
                        description: "",
                        category: "xp",
                        updatedAt: new Date(),
                        updatedBy: null,
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        id: 1,
                        key: "xp.game.firstClear",
                        value: 30,
                        description: "",
                        category: "xp",
                        updatedAt: new Date(),
                        updatedBy: null,
                    },
                ])

            // When
            await service.loadAll()
            expect(service.get("xp.game.firstClear", 0)).toBe(10)

            await service.loadAll()

            // Then
            expect(service.get("xp.game.firstClear", 0)).toBe(30)
        })
    })

    describe("get (캐시 조회)", () => {
        it("캐시에 존재하는 키의 값을 반환한다", async () => {
            // Given
            repo.findAll.mockResolvedValue([
                {
                    id: 1,
                    key: "xp.game.firstClear",
                    value: 20,
                    description: "",
                    category: "xp",
                    updatedAt: new Date(),
                    updatedBy: null,
                },
            ])
            await service.loadAll()

            // When
            const result = service.get<number>("xp.game.firstClear", 0)

            // Then
            expect(result).toBe(20)
        })

        it("캐시에 없는 키는 기본값을 반환한다", () => {
            // When
            const result = service.get<number>("nonexistent.key", 42)

            // Then
            expect(result).toBe(42)
        })
    })

    describe("getByCategory (카테고리별 조회)", () => {
        it("카테고리에 해당하는 설정만 반환한다", async () => {
            // Given
            repo.findAll.mockResolvedValue([
                {
                    id: 1,
                    key: "hint.maxPerSentence",
                    value: 2,
                    description: "",
                    category: "hint",
                    updatedAt: new Date(),
                    updatedBy: null,
                },
                {
                    id: 2,
                    key: "hint.xpPenalty",
                    value: 5,
                    description: "",
                    category: "hint",
                    updatedAt: new Date(),
                    updatedBy: null,
                },
                {
                    id: 3,
                    key: "xp.game.firstClear",
                    value: 20,
                    description: "",
                    category: "xp",
                    updatedAt: new Date(),
                    updatedBy: null,
                },
            ])
            await service.loadAll()

            // When
            const result = service.getByCategory("hint")

            // Then
            expect(Object.keys(result)).toHaveLength(2)
            expect(result["hint.maxPerSentence"]).toBe(2)
            expect(result["hint.xpPenalty"]).toBe(5)
        })
    })

    describe("getConfigVersion (버전 해시)", () => {
        it("캐시에 데이터가 있으면 해시 문자열을 반환한다", async () => {
            // Given
            repo.findAll.mockResolvedValue([
                {
                    id: 1,
                    key: "xp.game.firstClear",
                    value: 20,
                    description: "",
                    category: "xp",
                    updatedAt: new Date("2026-01-15T10:00:00Z"),
                    updatedBy: null,
                },
            ])
            await service.loadAll()

            // When
            const version = service.getConfigVersion()

            // Then
            expect(version).toHaveLength(16)
            expect(typeof version).toBe("string")
        })

        it("동일 데이터에 대해 항상 같은 해시를 반환한다", async () => {
            // Given
            const configs: GameConfig[] = [
                {
                    id: 1,
                    key: "xp.game.firstClear",
                    value: 20,
                    description: "",
                    category: "xp",
                    updatedAt: new Date("2026-01-15T10:00:00Z"),
                    updatedBy: null,
                },
            ]
            repo.findAll.mockResolvedValue(configs)
            await service.loadAll()

            // When
            const v1 = service.getConfigVersion()
            const v2 = service.getConfigVersion()

            // Then
            expect(v1).toBe(v2)
        })
    })

    describe("update (설정 업데이트)", () => {
        /** updateConfig 메서드를 포함한 GameConfig 객체 생성 */
        function createGameConfigEntity(overrides: Partial<GameConfig> = {}): GameConfig {
            const config = Object.assign(new GameConfig(), {
                id: 1,
                key: "xp.game.firstClear",
                value: 20,
                description: "",
                category: "xp",
                updatedAt: new Date(),
                updatedBy: null,
                ...overrides,
            })
            return config
        }

        it("DB + 캐시를 갱신하고 이력을 저장한다", async () => {
            // Given
            const existing = createGameConfigEntity({ description: "최초 클리어" })
            repo.findByKeyOrThrow.mockResolvedValue(existing)
            repo.save.mockImplementation(
                async (c) => ({ ...c, updatedAt: new Date() }) as GameConfig
            )

            // 캐시에 기존 값 로드
            repo.findAll.mockResolvedValue([existing])
            await service.loadAll()

            // When
            await service.update("xp.game.firstClear", 30, 1)

            // Then
            expect(repo.saveHistory).toHaveBeenCalledTimes(1)
            expect(repo.save).toHaveBeenCalledWith(
                expect.objectContaining({ value: 30, updatedBy: 1 })
            )
            expect(service.get("xp.game.firstClear", 0)).toBe(30)
        })

        it("존재하지 않는 키는 NotFoundException을 던진다", async () => {
            // Given
            repo.findByKeyOrThrow.mockRejectedValue(new NotFoundException("설정을 찾을 수 없습니다: nonexistent.key"))

            // When / Then
            await expect(service.update("nonexistent.key", 10, 1)).rejects.toThrow(
                NotFoundException
            )
        })

        it("유효성 검증 실패 시 ValidationException을 던진다", async () => {
            // Given — xp.game.firstClear는 int 0~500이므로 문자열은 실패
            const existing = createGameConfigEntity()
            repo.findByKeyOrThrow.mockResolvedValue(existing)

            // When / Then
            await expect(service.update("xp.game.firstClear", "invalid", 1)).rejects.toThrow(
                ValidationException
            )
        })

        it("이력에 oldValue와 newValue가 JSON으로 저장된다", async () => {
            // Given
            const existing = createGameConfigEntity()
            repo.findByKeyOrThrow.mockResolvedValue(existing)
            repo.save.mockImplementation(
                async (c) => ({ ...c, updatedAt: new Date() }) as GameConfig
            )

            // When
            await service.update("xp.game.firstClear", 50, 2)

            // Then
            expect(repo.saveHistory).toHaveBeenCalledWith(
                expect.objectContaining({
                    configId: 1,
                    key: "xp.game.firstClear",
                    oldValue: "20",
                    newValue: "50",
                    changedBy: 2,
                })
            )
        })
    })

    describe("getHistory (변경 이력 조회)", () => {
        it("리포지토리에서 특정 키의 변경 이력을 반환한다", async () => {
            // Given
            const histories: GameConfigHistory[] = [
                {
                    id: 2,
                    configId: 1,
                    key: "xp.game.firstClear",
                    oldValue: "20",
                    newValue: "30",
                    changedBy: 1,
                    changedAt: new Date("2026-02-15"),
                },
                {
                    id: 1,
                    configId: 1,
                    key: "xp.game.firstClear",
                    oldValue: "10",
                    newValue: "20",
                    changedBy: 1,
                    changedAt: new Date("2026-02-14"),
                },
            ]
            repo.findHistoryByKey.mockResolvedValue(histories)

            // When
            const result = await service.getHistory("xp.game.firstClear")

            // Then
            expect(result).toEqual(histories)
            expect(repo.findHistoryByKey).toHaveBeenCalledWith("xp.game.firstClear")
        })

        it("이력이 없으면 빈 배열을 반환한다", async () => {
            // Given
            repo.findHistoryByKey.mockResolvedValue([])

            // When
            const result = await service.getHistory("xp.game.firstClear")

            // Then
            expect(result).toEqual([])
        })
    })

    describe("getAll (전체 목록)", () => {
        it("리포지토리에서 전체 설정을 반환한다", async () => {
            // Given
            const configs: GameConfig[] = [
                {
                    id: 1,
                    key: "xp.game.firstClear",
                    value: 20,
                    description: "",
                    category: "xp",
                    updatedAt: new Date(),
                    updatedBy: null,
                },
            ]
            repo.findAll.mockResolvedValue(configs)

            // When
            const result = await service.getAll()

            // Then
            expect(result).toEqual(configs)
            expect(repo.findAll).toHaveBeenCalled()
        })
    })
})
