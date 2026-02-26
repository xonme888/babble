import "reflect-metadata"
import { CompletionSnapshot } from "@features/game/domain/completion-snapshot"
import { GameScriptCompletion } from "@features/game/domain/game-script-completion.entity"

export {}

describe("CompletionSnapshot (완료 스냅샷 도메인 서비스)", () => {
    let snapshot: CompletionSnapshot

    beforeEach(() => {
        snapshot = new CompletionSnapshot()
    })

    describe("captureBeforeUpdate (수정 전 스냅샷)", () => {
        it("깊은 복사를 수행해야 한다 (원본 수정 후에도 스냅샷 유지)", () => {
            const completion = GameScriptCompletion.create({
                userId: 1,
                scriptId: 10,
                accuracy: 80,
                correct: 8,
                wrong: 2,
            })
            const map = new Map<number, GameScriptCompletion>()
            map.set(10, completion)

            const captured = snapshot.captureBeforeUpdate(map)

            // 원본 수정
            completion.recordPlay(90, 9, 1)

            // 스냅샷은 원본 수정 영향 안 받음
            const snapshotCompletion = captured.get(10)
            expect(snapshotCompletion).toBeDefined()
            expect(snapshotCompletion!.playCount).toBe(1) // 원래 값 유지
        })

        it("빈 Map이면 빈 Map을 반환한다", () => {
            const result = snapshot.captureBeforeUpdate(new Map())
            expect(result.size).toBe(0)
        })
    })

    describe("determineClearType (클리어 타입 판정)", () => {
        it("스냅샷에 없으면 'first_clear'를 반환한다", () => {
            const result = snapshot.determineClearType(new Map(), 10, 3)
            expect(result).toBe("first_clear")
        })

        it("스냅샷 있고 cooldown 미경과면 'repeat'를 반환한다", () => {
            const completion = GameScriptCompletion.create({
                userId: 1,
                scriptId: 10,
                accuracy: 80,
                correct: 8,
                wrong: 2,
            })
            completion.lastPlayedAt = new Date() // 방금 플레이
            const map = new Map<number, GameScriptCompletion>()
            map.set(10, completion)

            const result = snapshot.determineClearType(map, 10, 3)
            expect(result).toBe("repeat")
        })

        it("스냅샷 있고 cooldown 경과면 'review'를 반환한다", () => {
            const completion = GameScriptCompletion.create({
                userId: 1,
                scriptId: 10,
                accuracy: 80,
                correct: 8,
                wrong: 2,
            })
            completion.lastPlayedAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4일 전
            const map = new Map<number, GameScriptCompletion>()
            map.set(10, completion)

            const result = snapshot.determineClearType(map, 10, 3)
            expect(result).toBe("review")
        })
    })

    describe("groupByScript (스크립트별 그룹핑)", () => {
        it("scriptId별로 정확하게 그룹핑한다", () => {
            const wordResults = [
                { scriptId: 1, word: "a", wordIndex: 0, isCorrect: true, attempts: 1, hintUsed: false },
                { scriptId: 2, word: "b", wordIndex: 0, isCorrect: false, attempts: 2, hintUsed: true },
                { scriptId: 1, word: "c", wordIndex: 1, isCorrect: true, attempts: 1, hintUsed: false },
            ]

            const result = snapshot.groupByScript(wordResults)

            expect(result.get(1)?.length).toBe(2)
            expect(result.get(2)?.length).toBe(1)
        })

        it("빈 배열이면 빈 Map을 반환한다", () => {
            const result = snapshot.groupByScript([])
            expect(result.size).toBe(0)
        })
    })
})
