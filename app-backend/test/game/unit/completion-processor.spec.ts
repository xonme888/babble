import "reflect-metadata"
import { CompletionProcessor } from "@features/game/application/completion-processor"
import { GameScriptCompletion } from "@features/game/domain/game-script-completion.entity"
import { CompletionSnapshot } from "@features/game/domain/completion-snapshot"
import {
    createMockGameScriptCompletionRepository,
    createMockGameWordResultRepository,
} from "../../utils/mock-factories"
import type { GameScriptCompletionRepository } from "@features/game/infrastructure/game-script-completion.repository"
import type { GameWordResultRepository } from "@features/game/infrastructure/game-word-result.repository"

export {}

describe("CompletionProcessor (완료 처리기)", () => {
    let processor: CompletionProcessor
    let completionRepo: jest.Mocked<GameScriptCompletionRepository>
    let wordResultRepo: jest.Mocked<GameWordResultRepository>
    let completionSnapshot: CompletionSnapshot // 실제 Domain 서비스 사용

    beforeEach(() => {
        completionRepo = createMockGameScriptCompletionRepository()
        wordResultRepo = createMockGameWordResultRepository()
        completionSnapshot = new CompletionSnapshot()

        processor = new CompletionProcessor(completionRepo, wordResultRepo, completionSnapshot)
    })

    describe("saveWordResults (단어 결과 저장)", () => {
        it("WordResultInput -> GameWordResult 변환 후 배치 저장한다", async () => {
            const wordResults = [
                {
                    scriptId: 1,
                    word: "hello",
                    wordIndex: 0,
                    isCorrect: true,
                    attempts: 1,
                    hintUsed: false,
                },
                {
                    scriptId: 1,
                    word: "world",
                    wordIndex: 1,
                    isCorrect: false,
                    attempts: 2,
                    hintUsed: true,
                },
            ]

            await processor.saveWordResults(100, 1, wordResults)

            expect(wordResultRepo.saveBatch).toHaveBeenCalledTimes(1)
            const saved = wordResultRepo.saveBatch.mock.calls[0][0]
            expect(saved).toHaveLength(2)
        })
    })

    describe("upsertCompletions (completion 갱신)", () => {
        it("기존 completion이 있으면 recordPlay 호출", async () => {
            const existing = GameScriptCompletion.create({
                userId: 1,
                scriptId: 10,
                accuracy: 80,
                correct: 8,
                wrong: 2,
            })
            completionRepo.findByUserAndScripts.mockResolvedValue([existing])

            const wordResults = [
                {
                    scriptId: 10,
                    word: "a",
                    wordIndex: 0,
                    isCorrect: true,
                    attempts: 1,
                    hintUsed: false,
                },
            ]

            const result = await processor.upsertCompletions(1, wordResults)

            expect(completionRepo.saveAll).toHaveBeenCalled()
            expect(result.size).toBeGreaterThan(0) // 스냅샷 반환
        })

        it("기존 completion이 없으면 새로 생성", async () => {
            completionRepo.findByUserAndScripts.mockResolvedValue([])

            const wordResults = [
                {
                    scriptId: 10,
                    word: "a",
                    wordIndex: 0,
                    isCorrect: true,
                    attempts: 1,
                    hintUsed: false,
                },
            ]

            await processor.upsertCompletions(1, wordResults)

            expect(completionRepo.saveAll).toHaveBeenCalledTimes(1)
            const saved = completionRepo.saveAll.mock.calls[0][0]
            expect(saved[0].scriptId).toBe(10)
        })

        it("수정 전 스냅샷을 반환한다", async () => {
            const existing = GameScriptCompletion.create({
                userId: 1,
                scriptId: 10,
                accuracy: 80,
                correct: 8,
                wrong: 2,
            })
            completionRepo.findByUserAndScripts.mockResolvedValue([existing])

            const wordResults = [
                {
                    scriptId: 10,
                    word: "a",
                    wordIndex: 0,
                    isCorrect: true,
                    attempts: 1,
                    hintUsed: false,
                },
            ]

            const snapshotMap = await processor.upsertCompletions(1, wordResults)

            // 스냅샷의 playCount는 1 (recordPlay 전)
            expect(snapshotMap.get(10)?.playCount).toBe(1)
        })
    })
})
