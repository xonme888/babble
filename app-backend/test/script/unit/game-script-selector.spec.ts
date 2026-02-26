import "reflect-metadata"
import { GameScriptSelector } from "@features/script/application/game-script-selector"
import { GameSlotCalculator } from "@features/game/domain/game-slot-calculator"
import { Script, ScriptDifficulty } from "@features/script/domain/script.entity"
import { GameScriptCompletion } from "@features/game/domain/game-script-completion.entity"
import {
    createMockScriptRepository,
    createMockChapterProgressService,
    createMockAssessmentRepository,
    createMockGameScriptCompletionRepository,
    createMockGameConfigService,
} from "../../utils/mock-factories"

import type { ScriptRepository } from "@features/script/infrastructure/script.repository"
import type { ChapterProgressService } from "@features/script/application/chapter-progress.service"
import type { AssessmentRepository } from "@features/assessment/infrastructure/assessment.repository"
import type { GameScriptCompletionRepository } from "@features/game/infrastructure/game-script-completion.repository"
import type { GameConfigService } from "@features/gamification/application/game-config.service"

describe("GameScriptSelector (게임 스크립트 선택 오케스트레이션)", () => {
    let selector: GameScriptSelector
    let scriptRepository: jest.Mocked<ScriptRepository>
    let chapterProgressService: jest.Mocked<ChapterProgressService>
    let assessmentRepository: jest.Mocked<AssessmentRepository>
    let completionRepo: jest.Mocked<GameScriptCompletionRepository>
    let gameConfigService: jest.Mocked<GameConfigService>
    let slotCalculator: GameSlotCalculator

    const makeScript = (id: number): Script => {
        const s = new Script()
        s.id = id
        s.title = `Script ${id}`
        s.content = `Content ${id}`
        s.difficulty = ScriptDifficulty.EASY
        return s
    }

    beforeEach(() => {
        scriptRepository = createMockScriptRepository()
        chapterProgressService = createMockChapterProgressService()
        assessmentRepository = createMockAssessmentRepository()
        completionRepo = createMockGameScriptCompletionRepository()
        gameConfigService = createMockGameConfigService()
        slotCalculator = new GameSlotCalculator()

        // 기본 GameConfig mock
        gameConfigService.get.mockImplementation((key: string, defaultValue: unknown) => {
            const configs: Record<string, unknown> = {
                "game.todayFirstRatio": 0.7,
                "game.adaptiveDifficulty.enabled": true,
                "game.adaptiveDifficulty.highScoreThreshold": 85,
                "game.adaptiveDifficulty.highScoreBlanks": { min: 5, max: 8 },
                "game.adaptiveDifficulty.lowScoreBlanks": { min: 1, max: 3 },
            }
            return configs[key] ?? defaultValue
        })

        selector = new GameScriptSelector(
            scriptRepository,
            chapterProgressService,
            assessmentRepository,
            completionRepo,
            gameConfigService,
            slotCalculator
        )
    })

    it("오늘 학습한 스크립트를 우선 포함하고 DTO로 변환한다", async () => {
        // Given
        assessmentRepository.findTodayCompletedByUser.mockResolvedValue([
            { scriptId: 10, bestScore: 90 },
            { scriptId: 20, bestScore: 75 },
        ])
        scriptRepository.findByIds.mockResolvedValue([makeScript(10), makeScript(20)])
        chapterProgressService.getUnlockedChapterIds.mockResolvedValue([1])
        scriptRepository.findRandomByChapterIds.mockResolvedValue([
            makeScript(30),
            makeScript(40),
        ])

        // When
        const result = await selector.selectScripts(1, 5)

        // Then
        expect(result.length).toBeGreaterThan(0)
        const todayIds = result.filter((r) => r.todayScore !== null).map((r) => r.scriptId)
        expect(todayIds).toEqual(expect.arrayContaining([10, 20]))
    })

    it("오늘 학습 없으면 전체 랜덤 선택한다", async () => {
        // Given
        assessmentRepository.findTodayCompletedByUser.mockResolvedValue([])
        chapterProgressService.getUnlockedChapterIds.mockResolvedValue([1])
        scriptRepository.findRandomByChapterIds.mockResolvedValue([makeScript(30)])

        // When
        const result = await selector.selectScripts(1, 5)

        // Then
        expect(result.length).toBe(1)
        expect(result[0].todayScore).toBeNull()
        expect(result[0].recommendedBlanks).toBeNull()
    })

    it("Repository 호출 인자를 올바르게 전달한다", async () => {
        // Given
        assessmentRepository.findTodayCompletedByUser.mockResolvedValue([
            { scriptId: 10, bestScore: 80 },
        ])
        scriptRepository.findByIds.mockResolvedValue([makeScript(10)])
        chapterProgressService.getUnlockedChapterIds.mockResolvedValue([1, 2])
        scriptRepository.findRandomByChapterIds.mockResolvedValue([])

        // When
        await selector.selectScripts(42, 3)

        // Then
        expect(assessmentRepository.findTodayCompletedByUser).toHaveBeenCalledWith(
            42,
            expect.any(Date),
            expect.any(Date)
        )
        expect(chapterProgressService.getUnlockedChapterIds).toHaveBeenCalledWith(42)
        expect(scriptRepository.findByIds).toHaveBeenCalled()
    })

    it("고점수 -> highBlanks, 저점수 -> lowBlanks 적용한다", async () => {
        // Given
        assessmentRepository.findTodayCompletedByUser.mockResolvedValue([
            { scriptId: 10, bestScore: 90 },
            { scriptId: 20, bestScore: 60 },
        ])
        scriptRepository.findByIds.mockResolvedValue([makeScript(10), makeScript(20)])
        chapterProgressService.getUnlockedChapterIds.mockResolvedValue([1])
        scriptRepository.findRandomByChapterIds.mockResolvedValue([])

        // When
        const result = await selector.selectScripts(1, 2)

        // Then
        const high = result.find((r) => r.scriptId === 10)
        const low = result.find((r) => r.scriptId === 20)
        expect(high?.recommendedBlanks).toEqual({ min: 5, max: 8 })
        expect(low?.recommendedBlanks).toEqual({ min: 1, max: 3 })
    })

    it("GameScriptCompletion이 있으면 isFirstPlay=false이다", async () => {
        // Given
        assessmentRepository.findTodayCompletedByUser.mockResolvedValue([
            { scriptId: 10, bestScore: 80 },
        ])
        scriptRepository.findByIds.mockResolvedValue([makeScript(10)])
        chapterProgressService.getUnlockedChapterIds.mockResolvedValue([1])
        scriptRepository.findRandomByChapterIds.mockResolvedValue([])

        const completion = GameScriptCompletion.create({
            userId: 1,
            scriptId: 10,
            accuracy: 80,
            correct: 8,
            wrong: 2,
        })
        completionRepo.findByUserAndScripts.mockResolvedValue([completion])

        // When
        const result = await selector.selectScripts(1, 1)

        // Then
        expect(result[0].isFirstPlay).toBe(false)
        expect(result[0].lastPlayedAt).toBeInstanceOf(Date)
    })
})
