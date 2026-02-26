import "reflect-metadata"
import { ChapterUnlockPolicy } from "@features/script/domain/chapter-unlock-policy"
import { Script, ScriptDifficulty } from "@features/script/domain/script.entity"
import { Chapter } from "@features/script/domain/chapter.entity"

export {}

/** 테스트용 Script 생성 헬퍼 */
function makeScript(overrides: Partial<Script> = {}): Script {
    const s = new Script()
    s.id = overrides.id ?? 1
    s.title = overrides.title ?? "test"
    s.content = overrides.content ?? "test content"
    s.difficulty = overrides.difficulty ?? ScriptDifficulty.EASY
    s.orderIndex = overrides.orderIndex ?? 0
    s.isActive = overrides.isActive ?? true
    return s
}

/** 테스트용 Chapter 생성 헬퍼 */
function makeChapter(id: number, orderIndex: number, scripts: Script[] = []): Chapter {
    const c = new Chapter()
    c.id = id
    c.orderIndex = orderIndex
    c.title = `챕터 ${id}`
    c.scripts = scripts
    return c
}

describe("ChapterUnlockPolicy", () => {
    let policy: ChapterUnlockPolicy

    beforeEach(() => {
        policy = new ChapterUnlockPolicy()
    })

    // ==================== getActiveScripts ====================

    describe("getActiveScripts", () => {
        it("isActive=false인 스크립트를 제외한다", () => {
            const chapter = makeChapter(1, 0, [
                makeScript({ id: 1, orderIndex: 0, isActive: true }),
                makeScript({ id: 2, orderIndex: 1, isActive: false }),
                makeScript({ id: 3, orderIndex: 2, isActive: true }),
            ])

            const result = policy.getActiveScripts(chapter)

            expect(result).toHaveLength(2)
            expect(result.map((s) => s.id)).toEqual([1, 3])
        })

        it("orderIndex 기준으로 정렬한다", () => {
            const chapter = makeChapter(1, 0, [
                makeScript({ id: 1, orderIndex: 3 }),
                makeScript({ id: 2, orderIndex: 1 }),
                makeScript({ id: 3, orderIndex: 2 }),
            ])

            const result = policy.getActiveScripts(chapter)

            expect(result.map((s) => s.id)).toEqual([2, 3, 1])
        })
    })

    // ==================== computeUnlockedChapterIds ====================

    describe("computeUnlockedChapterIds", () => {
        it("첫 챕터는 항상 해금된다", () => {
            const chapters = [makeChapter(10, 0, [makeScript({ id: 1 })])]

            const result = policy.computeUnlockedChapterIds(chapters, [])

            expect(result).toEqual([10])
        })

        it("이전 챕터 미완료 시 다음 챕터는 잠금된다", () => {
            const chapters = [
                makeChapter(1, 0, [makeScript({ id: 1 }), makeScript({ id: 2 })]),
                makeChapter(2, 1, [makeScript({ id: 3 })]),
            ]

            const result = policy.computeUnlockedChapterIds(chapters, [1]) // 1만 완료, 2 미완료

            expect(result).toEqual([1])
        })

        it("이전 챕터 전체 완료 시 다음 챕터가 해금된다", () => {
            const chapters = [
                makeChapter(1, 0, [makeScript({ id: 1 }), makeScript({ id: 2 })]),
                makeChapter(2, 1, [makeScript({ id: 3 })]),
            ]

            const result = policy.computeUnlockedChapterIds(chapters, [1, 2])

            expect(result).toEqual([1, 2])
        })

        it("빈 챕터(활성 스크립트 0)는 완료로 간주한다", () => {
            const chapters = [
                makeChapter(1, 0, [makeScript({ id: 1, isActive: false })]), // 활성 0
                makeChapter(2, 1, [makeScript({ id: 2 })]),
            ]

            const result = policy.computeUnlockedChapterIds(chapters, [])

            expect(result).toEqual([1, 2])
        })

        it("챕터 없으면 빈 배열을 반환한다", () => {
            const result = policy.computeUnlockedChapterIds([], [])

            expect(result).toEqual([])
        })

        it("orderIndex 기준으로 정렬하여 판정한다 (ID 무시)", () => {
            const chapters = [
                makeChapter(100, 0, [makeScript({ id: 1 })]),
                makeChapter(50, 1, [makeScript({ id: 2 })]),
                makeChapter(200, 2, [makeScript({ id: 3 })]),
            ]

            const result = policy.computeUnlockedChapterIds(chapters, [1, 2])

            // 100(idx0) → 완료, 50(idx1) → 완료, 200(idx2) → 해금
            expect(result).toEqual([100, 50, 200])
        })
    })

    // ==================== countCompletedChapters ====================

    describe("countCompletedChapters", () => {
        it("모든 챕터 완료 시 전체 수를 반환한다", () => {
            const chapters = [
                makeChapter(1, 0, [makeScript({ id: 1 }), makeScript({ id: 2 })]),
                makeChapter(2, 1, [makeScript({ id: 3 })]),
            ]

            const result = policy.countCompletedChapters(chapters, [1, 2, 3])

            expect(result).toBe(2)
        })

        it("일부 챕터만 완료 시 정확한 수를 반환한다", () => {
            const chapters = [
                makeChapter(1, 0, [makeScript({ id: 1 }), makeScript({ id: 2 })]),
                makeChapter(2, 1, [makeScript({ id: 3 })]),
                makeChapter(3, 2, [makeScript({ id: 4 }), makeScript({ id: 5 })]),
            ]

            // 챕터 1 완료 (1, 2), 챕터 2 미완료, 챕터 3 완료 (4, 5)
            const result = policy.countCompletedChapters(chapters, [1, 2, 4, 5])

            expect(result).toBe(2)
        })

        it("빈 챕터(활성 스크립트 0)는 완료로 간주한다", () => {
            const chapters = [
                makeChapter(1, 0, [makeScript({ id: 1, isActive: false })]), // 활성 스크립트 없음
                makeChapter(2, 1, [makeScript({ id: 2 })]),
            ]

            const result = policy.countCompletedChapters(chapters, [])

            expect(result).toBe(1) // 빈 챕터만 완료
        })
    })

    // ==================== computeBundles ====================

    describe("computeBundles", () => {
        it("5개 스크립트, bundleSize 5 → 번들 1개", () => {
            const scripts = Array.from({ length: 5 }, (_, i) =>
                makeScript({ id: i + 1, orderIndex: i })
            )

            const result = policy.computeBundles(scripts, [], 5)

            expect(result).toHaveLength(1)
            expect(result[0].totalCount).toBe(5)
        })

        it("12개 스크립트, bundleSize 5 → 번들 3개 (5+5+2)", () => {
            const scripts = Array.from({ length: 12 }, (_, i) =>
                makeScript({ id: i + 1, orderIndex: i })
            )

            const result = policy.computeBundles(scripts, [], 5)

            expect(result).toHaveLength(3)
            expect(result.map((b) => b.totalCount)).toEqual([5, 5, 2])
        })

        it("첫 번들은 항상 해금된다", () => {
            const scripts = Array.from({ length: 10 }, (_, i) =>
                makeScript({ id: i + 1, orderIndex: i })
            )

            const result = policy.computeBundles(scripts, [], 5)

            expect(result[0].isUnlocked).toBe(true)
        })

        it("이전 번들 완료 시 다음 번들이 해금된다", () => {
            const scripts = Array.from({ length: 10 }, (_, i) =>
                makeScript({ id: i + 1, orderIndex: i })
            )
            const completedIds = [1, 2, 3, 4, 5] // 첫 번들 전체 완료

            const result = policy.computeBundles(scripts, completedIds, 5)

            expect(result[0].isCompleted).toBe(true)
            expect(result[1].isUnlocked).toBe(true)
        })

        it("이전 번들 미완료 시 다음 번들은 잠금된다", () => {
            const scripts = Array.from({ length: 10 }, (_, i) =>
                makeScript({ id: i + 1, orderIndex: i })
            )
            const completedIds = [1, 2, 3] // 첫 번들 부분 완료

            const result = policy.computeBundles(scripts, completedIds, 5)

            expect(result[0].isCompleted).toBe(false)
            expect(result[1].isUnlocked).toBe(false)
        })

        it("빈 입력 → 빈 배열", () => {
            const result = policy.computeBundles([], [], 5)

            expect(result).toEqual([])
        })
    })

    // ==================== calcChapterProgress ====================

    describe("calcChapterProgress", () => {
        it("잠긴 챕터는 모두 0을 반환한다", () => {
            const scripts = Array.from({ length: 10 }, (_, i) =>
                makeScript({ id: i + 1, orderIndex: i })
            )
            const bundles = policy.computeBundles(scripts, [1, 2, 3], 5)

            const result = policy.calcChapterProgress(bundles, false)

            expect(result).toEqual({ completedScripts: 0, totalScripts: 0, completionRate: 0 })
        })

        it("첫 번들만 해금 시 첫 번들만 집계한다", () => {
            const scripts = Array.from({ length: 10 }, (_, i) =>
                makeScript({ id: i + 1, orderIndex: i })
            )
            const bundles = policy.computeBundles(scripts, [1, 2], 5)

            const result = policy.calcChapterProgress(bundles, true)

            expect(result).toEqual({ completedScripts: 2, totalScripts: 5, completionRate: 0.4 })
        })

        it("모든 번들 해금 시 전체 집계한다", () => {
            const scripts = Array.from({ length: 10 }, (_, i) =>
                makeScript({ id: i + 1, orderIndex: i })
            )
            const allIds = scripts.map((s) => s.id)
            const bundles = policy.computeBundles(scripts, allIds, 5)

            const result = policy.calcChapterProgress(bundles, true)

            expect(result).toEqual({ completedScripts: 10, totalScripts: 10, completionRate: 1 })
        })

        it("빈 번들 배열이면 completionRate=0을 반환한다", () => {
            const bundles = policy.computeBundles([], [], 5)

            const result = policy.calcChapterProgress(bundles, true)

            expect(result).toEqual({ completedScripts: 0, totalScripts: 0, completionRate: 0 })
        })

        it("completionRate를 소수점 2자리로 반올림한다", () => {
            const scripts = Array.from({ length: 3 }, (_, i) =>
                makeScript({ id: i + 1, orderIndex: i })
            )
            const bundles = policy.computeBundles(scripts, [1], 3)

            const result = policy.calcChapterProgress(bundles, true)

            expect(result.completionRate).toBe(0.33)
        })
    })

    // ==================== findNextScript ====================

    describe("findNextScript", () => {
        it("해금된 미완료 번들의 첫 미완료 스크립트를 반환한다", () => {
            const scripts = Array.from({ length: 10 }, (_, i) =>
                makeScript({ id: i + 1, orderIndex: i })
            )
            const completedIds = [1, 2] // 번들1에서 2개 완료
            const bundles = policy.computeBundles(scripts, completedIds, 5)

            const result = policy.findNextScript(bundles, completedIds)

            expect(result).not.toBeNull()
            expect(result!.id).toBe(3)
        })

        it("모두 완료 시 null을 반환한다", () => {
            const scripts = Array.from({ length: 5 }, (_, i) =>
                makeScript({ id: i + 1, orderIndex: i })
            )
            const completedIds = [1, 2, 3, 4, 5]
            const bundles = policy.computeBundles(scripts, completedIds, 5)

            const result = policy.findNextScript(bundles, completedIds)

            expect(result).toBeNull()
        })
    })

    // ==================== toBundleScriptInfos ====================

    describe("toBundleScriptInfos", () => {
        it("Script를 BundleScriptInfo로 정확히 변환한다", () => {
            const scripts = [
                makeScript({
                    id: 1,
                    content: "hello",
                    title: "제목",
                    difficulty: ScriptDifficulty.MEDIUM,
                    orderIndex: 0,
                }),
            ]

            const result = policy.toBundleScriptInfos(scripts, [1], { 1: 95 })

            expect(result).toEqual([
                {
                    id: 1,
                    content: "hello",
                    title: "제목",
                    difficulty: ScriptDifficulty.MEDIUM,
                    orderIndex: 0,
                    isCompleted: true,
                    bestScore: 95,
                },
            ])
        })

        it("bestScore 없으면 null을 반환한다", () => {
            const scripts = [makeScript({ id: 1 })]

            const result = policy.toBundleScriptInfos(scripts, [], {})

            expect(result[0].bestScore).toBeNull()
            expect(result[0].isCompleted).toBe(false)
        })
    })
})
