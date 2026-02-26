// typeorm-transactional을 no-op mock (단위 테스트에서 DB 불필요)
jest.mock("typeorm-transactional", () => ({
    Transactional:
        () => (_target: Record<string, unknown>, _key: string, descriptor: PropertyDescriptor) =>
            descriptor,
    initializeTransactionalContext: jest.fn(),
    addTransactionalDataSource: (dataSource: unknown) => dataSource,
}))

import "reflect-metadata"
import { ScriptService } from "@features/script/application/script.service"
import { Script, ScriptDifficulty, ArticulationPlace } from "@features/script/domain/script.entity"
import { Chapter } from "@features/script/domain/chapter.entity"
import { NotFoundException } from "@shared/core/exceptions/domain-exceptions"
import {
    createMockScriptRepository,
    createMockChapterProgressService,
    createMockContentVersionService,
    createMockGameScriptSelector,
} from "../../utils/mock-factories"

import type { ScriptRepository } from "@features/script/infrastructure/script.repository"
import type { ChapterProgressService } from "@features/script/application/chapter-progress.service"
import type { ContentVersionService } from "@features/script/application/content-version.service"
import type { GameScriptSelector } from "@features/script/application/game-script-selector"

describe("ScriptService (스크립트 서비스)", () => {
    let scriptService: ScriptService
    let scriptRepository: jest.Mocked<ScriptRepository>
    let chapterProgressService: jest.Mocked<ChapterProgressService>
    let contentVersionService: jest.Mocked<ContentVersionService>
    let gameScriptSelector: jest.Mocked<GameScriptSelector>

    beforeEach(() => {
        scriptRepository = createMockScriptRepository()
        chapterProgressService = createMockChapterProgressService()
        contentVersionService = createMockContentVersionService()
        gameScriptSelector = createMockGameScriptSelector()
        scriptService = new ScriptService(
            scriptRepository,
            chapterProgressService,
            contentVersionService,
            gameScriptSelector
        )
    })

    describe("createScript (스크립트 생성)", () => {
        it("새로운 스크립트를 생성하고 저장해야 한다", async () => {
            const data = {
                title: "Test Script",
                content: "Test Content",
                difficulty: ScriptDifficulty.MEDIUM,
                articulationPlace: ArticulationPlace.BILABIAL,
            }

            const mockScript = new Script()
            Object.assign(mockScript, data)
            scriptRepository.save.mockResolvedValue(mockScript)

            const result = await scriptService.createScript(data)

            expect(result.title).toBe(data.title)
            expect(scriptRepository.save).toHaveBeenCalled()
        })

        it("생성 후 콘텐츠 버전을 생성해야 한다", async () => {
            const mockScript = new Script()
            scriptRepository.save.mockResolvedValue(mockScript)

            await scriptService.createScript({ title: "T", content: "C" })

            expect(contentVersionService.createVersion).toHaveBeenCalledWith("구절 생성")
        })
    })

    describe("getScript (스크립트 조회)", () => {
        it("스크립트를 찾은 경우 반환해야 한다", async () => {
            const mockScript = new Script()
            mockScript.id = 1
            scriptRepository.findByIdOrThrow.mockResolvedValue(mockScript)

            const result = await scriptService.getScript(1)

            expect(result.id).toBe(1)
            expect(scriptRepository.findByIdOrThrow).toHaveBeenCalledWith(1)
        })

        it("찾지 못한 경우 NotFoundException을 던져야 한다", async () => {
            scriptRepository.findByIdOrThrow.mockRejectedValue(
                new NotFoundException("script.not_found")
            )

            await expect(scriptService.getScript(1)).rejects.toThrow(NotFoundException)
        })
    })

    describe("updateScript (스크립트 수정)", () => {
        it("스크립트를 수정하고 저장해야 한다", async () => {
            const existingScript = new Script()
            existingScript.id = 1
            existingScript.title = "Old Title"

            scriptRepository.findByIdOrThrow.mockResolvedValue(existingScript)
            scriptRepository.save.mockImplementation(async (s) => s as Script)

            const result = await scriptService.updateScript(1, { title: "New Title" })

            expect(result.title).toBe("New Title")
            expect(scriptRepository.save).toHaveBeenCalled()
        })

        it("수정 후 콘텐츠 버전을 생성해야 한다", async () => {
            const existingScript = new Script()
            existingScript.id = 1
            scriptRepository.findByIdOrThrow.mockResolvedValue(existingScript)
            scriptRepository.save.mockImplementation(async (s) => s as Script)

            await scriptService.updateScript(1, { title: "Updated" })

            expect(contentVersionService.createVersion).toHaveBeenCalledWith("구절 수정")
        })
    })

    describe("deleteScript (스크립트 삭제)", () => {
        it("스크립트를 소프트 삭제하고 버전을 생성해야 한다", async () => {
            const mockScript = new Script()
            mockScript.id = 1
            mockScript.deletedAt = null
            scriptRepository.findByIdOrThrow.mockResolvedValue(mockScript)
            scriptRepository.save.mockImplementation(async (s) => s as Script)

            await scriptService.deleteScript(1)

            expect(mockScript.deletedAt).toBeInstanceOf(Date)
            expect(scriptRepository.save).toHaveBeenCalledWith(mockScript)
            expect(contentVersionService.createVersion).toHaveBeenCalledWith("구절 삭제")
        })
    })

    describe("findRandomUnlockedScripts (인증 사용자 랜덤 스크립트)", () => {
        it("해금된 챕터의 스크립트만 반환", async () => {
            // Given
            chapterProgressService.getUnlockedChapterIds.mockResolvedValue([1, 2])
            const mockScript = new Script()
            mockScript.id = 10
            scriptRepository.findRandomByChapterIds.mockResolvedValue([mockScript])

            // When
            const result = await scriptService.findRandomUnlockedScripts(1, {})

            // Then
            expect(result).toEqual([mockScript])
            expect(scriptRepository.findRandomByChapterIds).toHaveBeenCalledWith([1, 2], {})
        })

        it("해금된 챕터가 없으면 NotFoundException", async () => {
            // Given
            chapterProgressService.getUnlockedChapterIds.mockResolvedValue([])

            // When & Then
            await expect(scriptService.findRandomUnlockedScripts(1, {})).rejects.toThrow(
                NotFoundException
            )
        })

        it("해금된 챕터에 스크립트가 없으면 NotFoundException", async () => {
            // Given
            chapterProgressService.getUnlockedChapterIds.mockResolvedValue([1])
            scriptRepository.findRandomByChapterIds.mockResolvedValue([])

            // When & Then
            await expect(scriptService.findRandomUnlockedScripts(1, {})).rejects.toThrow(
                NotFoundException
            )
        })
    })

    describe("findUnlockedScriptsForGame (워드게임용 스크립트)", () => {
        it("해금된 챕터의 활성 스크립트만 반환 (최대 count개)", async () => {
            // Given
            chapterProgressService.getUnlockedChapterIds.mockResolvedValue([1, 2])
            const mockScripts = [new Script(), new Script()]
            scriptRepository.findRandomByChapterIds.mockResolvedValue(mockScripts)

            // When
            const result = await scriptService.findUnlockedScriptsForGame(1, 50)

            // Then
            expect(result).toEqual(mockScripts)
            expect(scriptRepository.findRandomByChapterIds).toHaveBeenCalledWith([1, 2], {
                count: 50,
            })
        })

        it("count 미지정 시 기본 100개", async () => {
            // Given
            chapterProgressService.getUnlockedChapterIds.mockResolvedValue([1])
            scriptRepository.findRandomByChapterIds.mockResolvedValue([])

            // When
            await scriptService.findUnlockedScriptsForGame(1)

            // Then
            expect(scriptRepository.findRandomByChapterIds).toHaveBeenCalledWith([1], {
                count: 100,
            })
        })

        it("해금된 챕터가 없으면 빈 배열 반환", async () => {
            // Given
            chapterProgressService.getUnlockedChapterIds.mockResolvedValue([])

            // When
            const result = await scriptService.findUnlockedScriptsForGame(1)

            // Then
            expect(result).toEqual([])
        })
    })

    describe("selectTodayGameScripts (GameScriptSelector 위임)", () => {
        it("GameScriptSelector.selectScripts에 위임한다", async () => {
            // Given
            const mockDtos = [
                {
                    scriptId: 1,
                    title: "Test",
                    content: "Content",
                    difficulty: "EASY",
                    isFirstPlay: true,
                    lastPlayedAt: null,
                    recommendedBlanks: null,
                    todayScore: null,
                },
            ]
            gameScriptSelector.selectScripts.mockResolvedValue(mockDtos)

            // When
            const result = await scriptService.selectTodayGameScripts(42, 5)

            // Then
            expect(result).toEqual(mockDtos)
            expect(gameScriptSelector.selectScripts).toHaveBeenCalledWith(42, 5)
        })
    })

    describe("getScripts (스크립트 목록 조회)", () => {
        it("필터를 적용하여 스크립트 목록을 반환해야 한다", async () => {
            // Given
            const mockResult = { items: [new Script()], total: 1 }
            scriptRepository.findAll.mockResolvedValue(mockResult as any)

            // When
            const result = await scriptService.getScripts({ difficulty: "EASY", limit: 10 })

            // Then
            expect(result).toEqual(mockResult)
            expect(scriptRepository.findAll).toHaveBeenCalledWith({ difficulty: "EASY", limit: 10 })
        })
    })

    describe("getRandomScripts (랜덤 스크립트 조회)", () => {
        it("랜덤 스크립트를 반환해야 한다", async () => {
            // Given
            const mockScripts = [new Script(), new Script()]
            scriptRepository.findRandom.mockResolvedValue(mockScripts)

            // When
            const result = await scriptService.getRandomScripts({ count: 5 })

            // Then
            expect(result).toEqual(mockScripts)
        })

        it("결과가 없으면 NotFoundException을 던져야 한다", async () => {
            // Given
            scriptRepository.findRandom.mockResolvedValue([])

            // When & Then
            await expect(scriptService.getRandomScripts({})).rejects.toThrow(NotFoundException)
        })
    })

    describe("restoreScript (스크립트 복원)", () => {
        it("삭제된 스크립트를 복원해야 한다", async () => {
            // Given
            const mockScript = new Script()
            mockScript.id = 1
            mockScript.deletedAt = new Date()
            scriptRepository.findByIdIncludeDeleted.mockResolvedValue(mockScript)
            scriptRepository.save.mockImplementation(async (s) => s as Script)

            // When
            const result = await scriptService.restoreScript(1)

            // Then
            expect(result.deletedAt).toBeNull()
            expect(contentVersionService.createVersion).toHaveBeenCalledWith("구절 복원")
            expect(chapterProgressService.invalidateChaptersCache).toHaveBeenCalled()
        })

        it("존재하지 않는 스크립트면 NotFoundException을 던져야 한다", async () => {
            // Given
            scriptRepository.findByIdIncludeDeleted.mockResolvedValue(null)

            // When & Then
            await expect(scriptService.restoreScript(999)).rejects.toThrow(NotFoundException)
        })
    })

    describe("getNextScriptForUser (다음 학습 스크립트)", () => {
        it("진행 중인 챕터가 있으면 다음 스크립트를 반환해야 한다", async () => {
            // Given
            const mockScript = new Script()
            mockScript.id = 1
            const result = {
                script: mockScript,
                chapter: { id: 1, title: "Ch1", completedScripts: 2, totalScripts: 5 },
                overallProgress: { completedChapters: 0, totalChapters: 3 },
                bundle: { bundleIndex: 0, completedCount: 2, totalCount: 5, totalBundles: 1 },
                bundleScripts: [],
            }
            chapterProgressService.getNextScriptWithProgress.mockResolvedValue(result)

            // When
            const actual = await scriptService.getNextScriptForUser(1)

            // Then
            expect(actual.script.id).toBe(1)
            expect(actual.chapter?.id).toBe(1)
        })

        it("전체 완료 시 랜덤 스크립트와 overallProgress를 반환해야 한다", async () => {
            // Given
            chapterProgressService.getNextScriptWithProgress.mockResolvedValue(null)
            chapterProgressService.getUnlockedChapterIds.mockResolvedValue([1])
            const randomScript = new Script()
            randomScript.id = 99
            scriptRepository.findRandomByChapterIds.mockResolvedValue([randomScript])
            chapterProgressService.getOverallProgress.mockResolvedValue({
                completedChapters: 3,
                totalChapters: 3,
            })

            // When
            const actual = await scriptService.getNextScriptForUser(1)

            // Then
            expect(actual.script.id).toBe(99)
            expect(actual.chapter).toBeNull()
            expect(actual.overallProgress?.completedChapters).toBe(3)
        })
    })

    describe("Chapter operations (챕터 작업)", () => {
        it("챕터를 생성해야 한다", async () => {
            const data = { title: "Chapter 1" }
            const mockChapter = new Chapter()
            mockChapter.title = data.title
            scriptRepository.saveChapter.mockResolvedValue(mockChapter)

            const result = await scriptService.createChapter(data)

            expect(result.title).toBe(data.title)
            expect(scriptRepository.saveChapter).toHaveBeenCalled()
        })

        it("챕터 생성 후 콘텐츠 버전을 생성해야 한다", async () => {
            const mockChapter = new Chapter()
            scriptRepository.saveChapter.mockResolvedValue(mockChapter)

            await scriptService.createChapter({ title: "Ch" })

            expect(contentVersionService.createVersion).toHaveBeenCalledWith("챕터 생성")
        })

        it("챕터를 조회해야 한다", async () => {
            const mockChapter = new Chapter()
            mockChapter.id = 1
            scriptRepository.findChapterByIdOrThrow.mockResolvedValue(mockChapter)

            const result = await scriptService.getChapter(1)

            expect(result.id).toBe(1)
        })

        it("챕터 목록을 조회해야 한다", async () => {
            // Given
            const chapters = [new Chapter(), new Chapter()]
            scriptRepository.findAllChapters.mockResolvedValue(chapters)

            // When
            const result = await scriptService.getChapters()

            // Then
            expect(result).toEqual(chapters)
            expect(scriptRepository.findAllChapters).toHaveBeenCalled()
        })

        it("챕터 수정 후 콘텐츠 버전을 생성해야 한다", async () => {
            const mockChapter = new Chapter()
            mockChapter.id = 1
            scriptRepository.findChapterByIdOrThrow.mockResolvedValue(mockChapter)
            scriptRepository.saveChapter.mockImplementation(async (c) => c as Chapter)

            await scriptService.updateChapter(1, { title: "Updated Ch" })

            expect(contentVersionService.createVersion).toHaveBeenCalledWith("챕터 수정")
        })

        it("챕터 삭제 시 하위 스크립트도 소프트 삭제해야 한다", async () => {
            // Given
            const script1 = new Script()
            script1.id = 1
            script1.deletedAt = null
            const script2 = new Script()
            script2.id = 2
            script2.deletedAt = null

            const mockChapter = new Chapter()
            mockChapter.id = 1
            mockChapter.deletedAt = null
            mockChapter.scripts = [script1, script2]
            scriptRepository.findChapterByIdOrThrow.mockResolvedValue(mockChapter)
            scriptRepository.saveChapter.mockImplementation(async (c) => c as Chapter)

            // When
            await scriptService.deleteChapter(1)

            // Then
            expect(mockChapter.deletedAt).toBeInstanceOf(Date)
            expect(script1.deletedAt).toBeInstanceOf(Date)
            expect(script2.deletedAt).toBeInstanceOf(Date)
            expect(scriptRepository.saveAll).toHaveBeenCalledWith([script1, script2])
            expect(contentVersionService.createVersion).toHaveBeenCalledWith("챕터 삭제")
        })

        it("하위 스크립트가 없는 챕터 삭제도 정상 동작해야 한다", async () => {
            // Given
            const mockChapter = new Chapter()
            mockChapter.id = 1
            mockChapter.deletedAt = null
            mockChapter.scripts = []
            scriptRepository.findChapterByIdOrThrow.mockResolvedValue(mockChapter)
            scriptRepository.saveChapter.mockImplementation(async (c) => c as Chapter)

            // When
            await scriptService.deleteChapter(1)

            // Then
            expect(scriptRepository.saveAll).not.toHaveBeenCalled()
            expect(scriptRepository.saveChapter).toHaveBeenCalled()
        })

        it("챕터 복원 시 하위 스크립트도 복원해야 한다", async () => {
            // Given
            const script1 = new Script()
            script1.id = 1
            script1.deletedAt = new Date()
            const mockChapter = new Chapter()
            mockChapter.id = 1
            mockChapter.deletedAt = new Date()
            mockChapter.scripts = [script1]
            scriptRepository.findChapterByIdIncludeDeleted.mockResolvedValue(mockChapter)
            scriptRepository.saveChapter.mockImplementation(async (c) => c as Chapter)

            // When
            const result = await scriptService.restoreChapter(1)

            // Then
            expect(result.deletedAt).toBeNull()
            expect(script1.deletedAt).toBeNull()
            expect(scriptRepository.saveAll).toHaveBeenCalledWith([script1])
            expect(contentVersionService.createVersion).toHaveBeenCalledWith("챕터 복원")
        })

        it("존재하지 않는 챕터 복원 시 NotFoundException을 던져야 한다", async () => {
            // Given
            scriptRepository.findChapterByIdIncludeDeleted.mockResolvedValue(null)

            // When & Then
            await expect(scriptService.restoreChapter(999)).rejects.toThrow(NotFoundException)
        })
    })

    describe("getContentVersion (콘텐츠 버전 조회)", () => {
        it("최신 버전이 있으면 checksum과 updatedAt을 반환해야 한다", async () => {
            // Given
            const mockVersion = { checksum: "abc123", createdAt: new Date("2026-01-01") }
            contentVersionService.getLatestVersion.mockResolvedValue(mockVersion as any)

            // When
            const result = await scriptService.getContentVersion()

            // Then
            expect(result).toEqual({
                checksum: "abc123",
                updatedAt: mockVersion.createdAt,
            })
        })

        it("버전이 없으면 null을 반환해야 한다", async () => {
            // Given
            contentVersionService.getLatestVersion.mockResolvedValue(null)

            // When
            const result = await scriptService.getContentVersion()

            // Then
            expect(result).toBeNull()
        })
    })
})
