import "reflect-metadata"
import { ChapterProgressService } from "@features/script/application/chapter-progress.service"
import { ChapterUnlockPolicy } from "@features/script/domain/chapter-unlock-policy"
import { Chapter } from "@features/script/domain/chapter.entity"
import { Script, ScriptDifficulty } from "@features/script/domain/script.entity"
import {
    createMockScriptRepository,
    createMockAssessmentRepository,
    createMockGameConfigService,
    createMockRedisService,
    createMockLogger,
} from "../../utils/mock-factories"

import type { ScriptRepository } from "@features/script/infrastructure/script.repository"
import type { AssessmentRepository } from "@features/assessment/infrastructure/assessment.repository"
import type { IGameConfigProvider } from "@features/gamification/domain/game-config-provider.interface"

/** 테스트용 챕터 생성 헬퍼 */
function makeChapter(id: number, orderIndex: number, scripts: Partial<Script>[] = []): Chapter {
    const chapter = new Chapter()
    chapter.id = id
    chapter.orderIndex = orderIndex
    chapter.title = `챕터 ${id}`
    chapter.scripts = scripts.map((s) => {
        const script = new Script()
        Object.assign(script, {
            chapterId: id,
            isActive: true,
            difficulty: ScriptDifficulty.EASY,
            title: `스크립트 ${s.id}`,
            content: `내용 ${s.id}`,
            ...s,
        })
        return script
    })
    return chapter
}

describe("ChapterProgressService (챕터/번들 해금 서비스)", () => {
    let service: ChapterProgressService
    let scriptRepository: jest.Mocked<ScriptRepository>
    let assessmentRepository: jest.Mocked<AssessmentRepository>
    let gameConfigService: jest.Mocked<IGameConfigProvider>

    beforeEach(() => {
        scriptRepository = createMockScriptRepository()
        assessmentRepository = createMockAssessmentRepository()
        gameConfigService = createMockGameConfigService({
            get: jest.fn().mockImplementation((key: string, defaultValue: unknown) => {
                if (key === "bundle.size") return 5
                return defaultValue
            }),
        })
        service = new ChapterProgressService(
            scriptRepository,
            assessmentRepository,
            gameConfigService,
            createMockRedisService() as any,
            createMockLogger(),
            new ChapterUnlockPolicy()
        )
    })

    // ==================== 챕터 해금 ====================

    describe("getUnlockedChapterIds (해금 챕터 ID 목록)", () => {
        it("첫 번째 챕터(orderIndex 최소)는 항상 해금", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, [{ id: 10 }]),
                makeChapter(2, 1, [{ id: 20 }]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [],
                bestScores: {},
            })

            const result = await service.getUnlockedChapterIds(1)

            expect(result).toEqual([1])
        })

        it("이전 챕터의 모든 스크립트가 완료되면 다음 챕터 해금", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, [{ id: 10 }, { id: 11 }]),
                makeChapter(2, 1, [{ id: 20 }]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [10, 11],
                bestScores: { 10: 85, 11: 90 },
            })

            const result = await service.getUnlockedChapterIds(1)

            expect(result).toEqual([1, 2])
        })

        it("이전 챕터가 미완료면 다음 챕터 잠금", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, [{ id: 10 }, { id: 11 }]),
                makeChapter(2, 1, [{ id: 20 }]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [10], // 11 미완료
                bestScores: { 10: 85 },
            })

            const result = await service.getUnlockedChapterIds(1)

            expect(result).toEqual([1])
        })

        it("챕터가 없으면 빈 배열 반환", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [],
                bestScores: {},
            })

            const result = await service.getUnlockedChapterIds(1)

            expect(result).toEqual([])
        })

        it("스크립트가 없는 챕터는 완료로 간주 (다음 챕터 해금)", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, []), // 스크립트 없음
                makeChapter(2, 1, [{ id: 20 }]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [],
                bestScores: {},
            })

            const result = await service.getUnlockedChapterIds(1)

            expect(result).toEqual([1, 2])
        })

        it("여러 챕터가 연속 완료되면 모두 해금", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, [{ id: 10 }]),
                makeChapter(2, 1, [{ id: 20 }]),
                makeChapter(3, 2, [{ id: 30 }]),
                makeChapter(4, 3, [{ id: 40 }]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [10, 20, 30],
                bestScores: { 10: 90, 20: 85, 30: 80 },
            })

            const result = await service.getUnlockedChapterIds(1)

            expect(result).toEqual([1, 2, 3, 4])
        })

        it("orderIndex 순서대로 해금을 판단한다 (ID 순서와 무관)", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(5, 2, [{ id: 50 }]), // orderIndex=2
                makeChapter(3, 0, [{ id: 30 }]), // orderIndex=0 (첫 챕터)
                makeChapter(7, 1, [{ id: 70 }]), // orderIndex=1
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [30],
                bestScores: { 30: 95 },
            })

            const result = await service.getUnlockedChapterIds(1)

            expect(result).toEqual([3, 7])
        })
    })

    describe("isChapterUnlocked (챕터 해금 여부)", () => {
        it("해금된 챕터 ID면 true", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([makeChapter(1, 0, [{ id: 10 }])])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [],
                bestScores: {},
            })

            const result = await service.isChapterUnlocked(1, 1)

            expect(result).toBe(true)
        })

        it("잠긴 챕터 ID면 false", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, [{ id: 10 }]),
                makeChapter(2, 1, [{ id: 20 }]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [],
                bestScores: {},
            })

            const result = await service.isChapterUnlocked(1, 2)

            expect(result).toBe(false)
        })
    })

    // ==================== 번들 해금 ====================

    describe("computeBundles (번들 분할 — 순수 함수)", () => {
        it("5개 스크립트를 하나의 번들로 분할", () => {
            const scripts = [1, 2, 3, 4, 5].map((id) => {
                const s = new Script()
                Object.assign(s, { id, orderIndex: id - 1 })
                return s
            })

            const bundles = new ChapterUnlockPolicy().computeBundles(scripts, [], 5)

            expect(bundles).toHaveLength(1)
            expect(bundles[0].bundleIndex).toBe(0)
            expect(bundles[0].totalCount).toBe(5)
            expect(bundles[0].completedCount).toBe(0)
            expect(bundles[0].isUnlocked).toBe(true)
            expect(bundles[0].isCompleted).toBe(false)
        })

        it("12개 스크립트를 3개 번들(5+5+2)로 분할", () => {
            const scripts = Array.from({ length: 12 }, (_, i) => {
                const s = new Script()
                Object.assign(s, { id: i + 1, orderIndex: i })
                return s
            })

            const bundles = new ChapterUnlockPolicy().computeBundles(scripts, [], 5)

            expect(bundles).toHaveLength(3)
            expect(bundles[0].totalCount).toBe(5)
            expect(bundles[1].totalCount).toBe(5)
            expect(bundles[2].totalCount).toBe(2)
        })

        it("첫 번들은 항상 해금", () => {
            const scripts = Array.from({ length: 10 }, (_, i) => {
                const s = new Script()
                Object.assign(s, { id: i + 1, orderIndex: i })
                return s
            })

            const bundles = new ChapterUnlockPolicy().computeBundles(scripts, [], 5)

            expect(bundles[0].isUnlocked).toBe(true)
            expect(bundles[1].isUnlocked).toBe(false) // 첫 번들 미완료
        })

        it("첫 번들 완료 시 두 번째 번들 해금", () => {
            const scripts = Array.from({ length: 10 }, (_, i) => {
                const s = new Script()
                Object.assign(s, { id: i + 1, orderIndex: i })
                return s
            })

            const bundles = new ChapterUnlockPolicy().computeBundles(scripts, [1, 2, 3, 4, 5], 5)

            expect(bundles[0].isCompleted).toBe(true)
            expect(bundles[1].isUnlocked).toBe(true)
        })

        it("부분 완료 시 다음 번들 잠김", () => {
            const scripts = Array.from({ length: 10 }, (_, i) => {
                const s = new Script()
                Object.assign(s, { id: i + 1, orderIndex: i })
                return s
            })

            const bundles = new ChapterUnlockPolicy().computeBundles(
                scripts,
                [1, 2, 3],
                5 // 5개 중 3개만 완료
            )

            expect(bundles[0].completedCount).toBe(3)
            expect(bundles[0].isCompleted).toBe(false)
            expect(bundles[1].isUnlocked).toBe(false)
        })

        it("orderIndex 순서대로 번들 분할 (ID 무관)", () => {
            const scripts = [
                { id: 99, orderIndex: 2 },
                { id: 50, orderIndex: 0 },
                { id: 77, orderIndex: 1 },
            ].map((data) => {
                const s = new Script()
                Object.assign(s, data)
                return s
            })

            const bundles = new ChapterUnlockPolicy().computeBundles(scripts, [], 2)

            expect(bundles).toHaveLength(2) // 2+1
            expect(bundles[0].scripts.map((s) => s.id)).toEqual([50, 77])
            expect(bundles[1].scripts.map((s) => s.id)).toEqual([99])
        })

        it("스크립트가 없으면 빈 배열 반환", () => {
            const bundles = new ChapterUnlockPolicy().computeBundles([], [], 5)

            expect(bundles).toEqual([])
        })

        it("번들 크기 3으로 설정 시 3개씩 분할", () => {
            const scripts = Array.from({ length: 7 }, (_, i) => {
                const s = new Script()
                Object.assign(s, { id: i + 1, orderIndex: i })
                return s
            })

            const bundles = new ChapterUnlockPolicy().computeBundles(scripts, [], 3)

            expect(bundles).toHaveLength(3) // 3+3+1
            expect(bundles[0].totalCount).toBe(3)
            expect(bundles[1].totalCount).toBe(3)
            expect(bundles[2].totalCount).toBe(1)
        })

        it("전체 완료 시 모든 번들 isCompleted=true", () => {
            const scripts = Array.from({ length: 10 }, (_, i) => {
                const s = new Script()
                Object.assign(s, { id: i + 1, orderIndex: i })
                return s
            })
            const allIds = scripts.map((s) => s.id)

            const bundles = new ChapterUnlockPolicy().computeBundles(scripts, allIds, 5)

            expect(bundles.every((b) => b.isCompleted)).toBe(true)
            expect(bundles.every((b) => b.isUnlocked)).toBe(true)
        })
    })

    // ==================== getNextScriptWithProgress + 번들 ====================

    describe("getNextScriptWithProgress (다음 스크립트 + 번들 진행도)", () => {
        it("첫 번들 내 첫 미완료 스크립트 + 번들 진행도 반환", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, [
                    { id: 10, orderIndex: 0 },
                    { id: 11, orderIndex: 1 },
                    { id: 12, orderIndex: 2 },
                    { id: 13, orderIndex: 3 },
                    { id: 14, orderIndex: 4 },
                ]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [10],
                bestScores: { 10: 85 },
            })

            const result = await service.getNextScriptWithProgress(1)

            expect(result).not.toBeNull()
            expect(result!.script.id).toBe(11)
            expect(result!.bundle).toEqual({
                bundleIndex: 0,
                completedCount: 1,
                totalCount: 5,
                totalBundles: 1,
            })
            expect(result!.bundleScripts).toHaveLength(5)
            expect(result!.bundleScripts[0].isCompleted).toBe(true)
            expect(result!.bundleScripts[1].isCompleted).toBe(false)
        })

        it("첫 번들 완료 후 두 번째 번들 첫 스크립트 반환", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(
                    1,
                    0,
                    Array.from({ length: 10 }, (_, i) => ({
                        id: i + 1,
                        orderIndex: i,
                    }))
                ),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [1, 2, 3, 4, 5],
                bestScores: { 1: 90, 2: 85, 3: 88, 4: 92, 5: 87 },
            })

            const result = await service.getNextScriptWithProgress(1)

            expect(result).not.toBeNull()
            expect(result!.script.id).toBe(6)
            expect(result!.bundle).toEqual({
                bundleIndex: 1,
                completedCount: 0,
                totalCount: 5,
                totalBundles: 2,
            })
            expect(result!.bundleScripts).toHaveLength(5) // 두 번째 번들
            expect(result!.bundleScripts[0].id).toBe(6)
        })

        it("첫 챕터 완료 시 두 번째 챕터 첫 스크립트 반환", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, [
                    { id: 10, orderIndex: 0 },
                    { id: 11, orderIndex: 1 },
                ]),
                makeChapter(2, 1, [
                    { id: 20, orderIndex: 0 },
                    { id: 21, orderIndex: 1 },
                ]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [10, 11],
                bestScores: { 10: 90, 11: 85 },
            })

            const result = await service.getNextScriptWithProgress(1)

            expect(result).not.toBeNull()
            expect(result!.script.id).toBe(20)
            expect(result!.chapter).toEqual({
                id: 2,
                title: "챕터 2",
                completedScripts: 0,
                totalScripts: 2,
            })
            expect(result!.overallProgress).toEqual({
                completedChapters: 1,
                totalChapters: 2,
            })
        })

        it("모든 챕터 완료이면 null", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, [{ id: 10, orderIndex: 0 }]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [10],
                bestScores: { 10: 90 },
            })

            const result = await service.getNextScriptWithProgress(1)

            expect(result).toBeNull()
        })

        it("챕터가 없으면 null", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [],
                bestScores: {},
            })

            const result = await service.getNextScriptWithProgress(1)

            expect(result).toBeNull()
        })

        it("비활성 스크립트는 건너뛴다", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, [
                    { id: 10, orderIndex: 0, isActive: true },
                    { id: 11, orderIndex: 1, isActive: false },
                    { id: 12, orderIndex: 2, isActive: true },
                ]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [10],
                bestScores: { 10: 85 },
            })

            const result = await service.getNextScriptWithProgress(1)

            expect(result).not.toBeNull()
            expect(result!.script.id).toBe(12)
            expect(result!.chapter).toEqual({
                id: 1,
                title: "챕터 1",
                completedScripts: 1,
                totalScripts: 2,
            })
        })

        it("totalScripts는 해금된 번들만 집계한다 (멀티 번들)", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(
                    1,
                    0,
                    Array.from({ length: 10 }, (_, i) => ({
                        id: i + 1,
                        orderIndex: i,
                    }))
                ),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [1, 2],
                bestScores: { 1: 90, 2: 85 },
            })

            const result = await service.getNextScriptWithProgress(1)

            expect(result).not.toBeNull()
            // 첫 번들(5개)만 해금 → totalScripts=5
            expect(result!.chapter.totalScripts).toBe(5)
            expect(result!.chapter.completedScripts).toBe(2)
        })
    })

    // ==================== getChaptersWithBundles ====================

    describe("getChaptersWithBundles (챕터 목록 + 번들 진행도)", () => {
        it("챕터에 progress 필드를 포함한다", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, [
                    { id: 10, orderIndex: 0 },
                    { id: 11, orderIndex: 1 },
                    { id: 12, orderIndex: 2 },
                    { id: 13, orderIndex: 3 },
                    { id: 14, orderIndex: 4 },
                ]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [10, 11],
                bestScores: { 10: 90, 11: 85 },
            })

            const result = await service.getChaptersWithBundles(1)

            expect(result[0].progress).toEqual({
                completedScripts: 2,
                totalScripts: 5,
                completionRate: 0.4,
            })
        })

        it("잠긴 번들의 scripts는 빈 배열이다", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(
                    1,
                    0,
                    Array.from({ length: 10 }, (_, i) => ({
                        id: i + 1,
                        orderIndex: i,
                    }))
                ),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [1, 2],
                bestScores: { 1: 90, 2: 85 },
            })

            const result = await service.getChaptersWithBundles(1)

            const bundles = result[0].bundles
            expect(bundles[0].isUnlocked).toBe(true)
            expect(bundles[0].scripts).toHaveLength(5)
            expect(bundles[1].isUnlocked).toBe(false)
            expect(bundles[1].scripts).toEqual([])
        })

        it("잠긴 챕터의 progress는 모두 0이다", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, [{ id: 10, orderIndex: 0 }]),
                makeChapter(2, 1, [
                    { id: 20, orderIndex: 0 },
                    { id: 21, orderIndex: 1 },
                ]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [],
                bestScores: {},
            })

            const result = await service.getChaptersWithBundles(1)

            expect(result[1].isUnlocked).toBe(false)
            expect(result[1].progress).toEqual({
                completedScripts: 0,
                totalScripts: 0,
                completionRate: 0,
            })
        })
    })

    // ==================== checkBundleCompletion ====================

    describe("checkBundleCompletion (번들 완료 판정)", () => {
        it("번들이 방금 완료된 경우 bundleCompleted=true", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(
                    1,
                    0,
                    Array.from({ length: 10 }, (_, i) => ({
                        id: i + 1,
                        orderIndex: i,
                    }))
                ),
            ])
            // 구절 1~5 모두 완료 (번들 1 완료)
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [1, 2, 3, 4, 5],
                bestScores: {},
            })

            const result = await service.checkBundleCompletion(1, 5)

            expect(result.bundleCompleted).toBe(true)
            expect(result.bundleIndex).toBe(0)
            expect(result.nextBundleUnlocked).toBe(true)
            expect(result.chapterCompleted).toBe(false)
        })

        it("번들 미완료 시 bundleCompleted=false", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(
                    1,
                    0,
                    Array.from({ length: 10 }, (_, i) => ({
                        id: i + 1,
                        orderIndex: i,
                    }))
                ),
            ])
            // 구절 1~4만 완료 (번들 1 미완료)
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [1, 2, 3, 4],
                bestScores: {},
            })

            const result = await service.checkBundleCompletion(1, 4)

            expect(result.bundleCompleted).toBe(false)
            expect(result.nextBundleUnlocked).toBe(false)
        })

        it("챕터 마지막 번들 완료 시 chapterCompleted=true", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(
                    1,
                    0,
                    Array.from({ length: 5 }, (_, i) => ({
                        id: i + 1,
                        orderIndex: i,
                    }))
                ),
                makeChapter(2, 1, [{ id: 10, orderIndex: 0 }]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [1, 2, 3, 4, 5],
                bestScores: {},
            })

            const result = await service.checkBundleCompletion(1, 5)

            expect(result.bundleCompleted).toBe(true)
            expect(result.chapterCompleted).toBe(true)
            expect(result.nextChapterUnlocked).toBe(true)
        })

        it("마지막 챕터 완료 시 nextChapterUnlocked=false", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(
                    1,
                    0,
                    Array.from({ length: 5 }, (_, i) => ({
                        id: i + 1,
                        orderIndex: i,
                    }))
                ),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [1, 2, 3, 4, 5],
                bestScores: {},
            })

            const result = await service.checkBundleCompletion(1, 5)

            expect(result.chapterCompleted).toBe(true)
            expect(result.nextChapterUnlocked).toBe(false) // 마지막 챕터
        })

        it("존재하지 않는 스크립트면 기본값 반환", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, [{ id: 1, orderIndex: 0 }]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [],
                bestScores: {},
            })

            const result = await service.checkBundleCompletion(1, 999)

            expect(result.bundleCompleted).toBe(false)
            expect(result.bundleIndex).toBe(-1)
        })
    })

    // ==================== 기존 메서드 ====================

    describe("getOverallProgress (전체 챕터 진행도)", () => {
        it("완료된 챕터 수와 전체 챕터 수를 반환한다", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, [{ id: 10, orderIndex: 0 }]),
                makeChapter(2, 1, [
                    { id: 20, orderIndex: 0 },
                    { id: 21, orderIndex: 1 },
                ]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [10],
                bestScores: { 10: 90 },
            })

            const result = await service.getOverallProgress(1)

            expect(result).toEqual({ completedChapters: 1, totalChapters: 2 })
        })

        it("챕터가 없으면 0/0을 반환한다", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [],
                bestScores: {},
            })

            const result = await service.getOverallProgress(1)

            expect(result).toEqual({ completedChapters: 0, totalChapters: 0 })
        })

        it("비활성 스크립트는 무시한다", async () => {
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, [
                    { id: 10, orderIndex: 0, isActive: true },
                    { id: 11, orderIndex: 1, isActive: false },
                ]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [10],
                bestScores: { 10: 85 },
            })

            const result = await service.getOverallProgress(1)

            expect(result).toEqual({ completedChapters: 1, totalChapters: 1 })
        })
    })

    describe("isScriptUnlocked (스크립트 접근 가능 여부)", () => {
        it("해금된 챕터의 스크립트면 true", async () => {
            const script = new Script()
            script.id = 10
            script.chapterId = 1
            scriptRepository.findById.mockResolvedValue(script)
            scriptRepository.findAllChapters.mockResolvedValue([makeChapter(1, 0, [{ id: 10 }])])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [],
                bestScores: {},
            })

            const result = await service.isScriptUnlocked(1, 10)

            expect(result).toBe(true)
        })

        it("잠긴 챕터의 스크립트면 false", async () => {
            const script = new Script()
            script.id = 20
            script.chapterId = 2
            scriptRepository.findById.mockResolvedValue(script)
            scriptRepository.findAllChapters.mockResolvedValue([
                makeChapter(1, 0, [{ id: 10 }]),
                makeChapter(2, 1, [{ id: 20 }]),
            ])
            assessmentRepository.getScriptProgress.mockResolvedValue({
                completedScriptIds: [],
                bestScores: {},
            })

            const result = await service.isScriptUnlocked(1, 20)

            expect(result).toBe(false)
        })

        it("chapterId가 null인 스크립트(레거시)는 항상 true", async () => {
            const script = new Script()
            script.id = 99
            script.chapterId = null as unknown
            scriptRepository.findById.mockResolvedValue(script)

            const result = await service.isScriptUnlocked(1, 99)

            expect(result).toBe(true)
        })

        it("존재하지 않는 스크립트면 false", async () => {
            scriptRepository.findById.mockResolvedValue(null)

            const result = await service.isScriptUnlocked(1, 999)

            expect(result).toBe(false)
        })
    })

    // ==================== getBundleSize ====================

    describe("getBundleSize (번들 크기 조회)", () => {
        it("GameConfig에서 bundle.size를 조회한다", () => {
            expect(service.getBundleSize()).toBe(5)
            expect(gameConfigService.get).toHaveBeenCalledWith("bundle.size", 5)
        })

        it("GameConfig에 값이 없으면 기본값 5 반환", () => {
            gameConfigService.get.mockImplementation(
                (_key: string, defaultValue: unknown) => defaultValue
            )

            expect(service.getBundleSize()).toBe(5)
        })
    })
})
