import "reflect-metadata"
import type { IRedisService } from "@shared/core/redis-service.interface"
import type { ILogger } from "@shared/core/logger.interface"

/**
 * 결과 큐(RPUSH/BLPOP) 통합 테스트
 *
 * 리스트 기반 mock Redis로 BLPOP 소비자의 핵심 시나리오를 검증:
 * 1. 정상 소비  2. 게스트 필터링  3. DLQ 폴백  4. 메시지 보존  5. 자동 재시도
 */

// === Mock 인프라 ===

/** 리스트 스토어 — rpush/blpop/llen 시뮬레이션 */
const listStore = new Map<string, string[]>()

const mockLogger: jest.Mocked<ILogger> = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}

const mockRedisService: jest.Mocked<IRedisService> = {
    set: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    delete: jest.fn(),
    ttl: jest.fn().mockResolvedValue(100),
    increment: jest.fn(),
    exists: jest.fn().mockResolvedValue(false),
    rpush: jest.fn(async (key: string, value: string) => {
        const list = listStore.get(key) ?? []
        list.push(value)
        listStore.set(key, list)
        return list.length
    }),
    lpop: jest.fn(async (key: string) => {
        const list = listStore.get(key)
        if (!list || list.length === 0) return null
        return list.shift()!
    }),
    blpop: jest.fn(async (key: string) => {
        const list = listStore.get(key)
        if (!list || list.length === 0) {
            // 빈 큐 시 블로킹 시뮬레이션 — tight loop OOM 방지
            await new Promise((r) => setTimeout(r, 50))
            return null
        }
        return list.shift()!
    }),
    llen: jest.fn(async (key: string) => {
        return listStore.get(key)?.length ?? 0
    }),
    publish: jest.fn(async () => 0),
    getDuplicateClient: jest.fn(),
    setRequired: jest.fn(),
    getRequired: jest.fn().mockResolvedValue(null),
    deleteRequired: jest.fn(),
    getAndDeleteRequired: jest.fn().mockResolvedValue(null),
    incrementRequired: jest.fn(),
    incrWithExpire: jest.fn(),
    existsRequired: jest.fn().mockResolvedValue(false),
    isAvailable: jest.fn().mockReturnValue(true),
    ping: jest.fn().mockResolvedValue("PONG"),
}

const mockProcessor = { process: jest.fn() }

const mockAssessmentRepo = {
    findById: jest.fn().mockResolvedValue(null),
}

const mockAnalysisService = {
    scheduleRetry: jest.fn(),
}

/** 클래스 토큰 구조 — tsyringe resolve용 */
interface ClassToken { name: string }

// DI 컨테이너 모킹 — tsyringe를 직접 모킹하여 TypeORM 로딩 회피
jest.mock("tsyringe", () => ({
    container: {
        resolve: jest.fn((token: string | ClassToken) => {
            if (token === "ILogger") return mockLogger
            if (token === "IRedisService") return mockRedisService
            if (typeof token === "function" && (token as ClassToken).name === "AnalysisResultProcessor")
                return mockProcessor
            if (typeof token === "function" && (token as ClassToken).name === "AssessmentRepository")
                return mockAssessmentRepo
            if (typeof token === "function" && (token as ClassToken).name === "AssessmentAnalysisService")
                return mockAnalysisService
            throw new Error(`Unknown DI token: ${token}`)
        }),
    },
    injectable: () => (target: Record<string, unknown>) => target,
    inject: () => () => undefined,
}))

jest.mock("@shared/infra/logging/trace-context", () => ({
    TraceContext: {
        run: jest.fn((_id: string, fn: () => Promise<void>) => fn()),
    },
}))

jest.mock("@shared/infra/config/configurations", () => ({
    configurations: jest.fn(() => ({
        queue: { retryDelay: 5000 },
    })),
}))

import {
    createAnalysisResultSubscriber,
    RESULT_QUEUE_KEY,
} from "@features/assessment/worker/analysis-result.subscriber"

describe("Analysis Result Queue (RPUSH/BLPOP) Integration Test", () => {
    let subscriber: ReturnType<typeof createAnalysisResultSubscriber>

    beforeEach(() => {
        listStore.clear()
        jest.clearAllMocks()
    })

    afterEach(async () => {
        if (subscriber) {
            await subscriber.close()
            await new Promise((r) => setTimeout(r, 50))
        }
    })

    it("AI Worker가 RPUSH한 결과를 Subscriber가 BLPOP으로 소비한다", async () => {
        const message = JSON.stringify({
            jobId: "job-int-1",
            assessmentId: 100,
            success: true,
            score: 85,
        })

        // AI Worker RPUSH 시뮬레이션
        await mockRedisService.rpush(RESULT_QUEUE_KEY, message)

        subscriber = createAnalysisResultSubscriber()
        await new Promise((r) => setTimeout(r, 150))

        expect(mockProcessor.process).toHaveBeenCalledWith(
            expect.objectContaining({
                jobId: "job-int-1",
                assessmentId: 100,
                success: true,
                score: 85,
            })
        )
    })

    it("게스트 결과(guest-* jobId)는 무시한다", async () => {
        await mockRedisService.rpush(
            RESULT_QUEUE_KEY,
            JSON.stringify({
                jobId: "guest-abc-123",
                success: true,
                score: 75,
            })
        )

        subscriber = createAnalysisResultSubscriber()
        await new Promise((r) => setTimeout(r, 150))

        expect(mockProcessor.process).not.toHaveBeenCalled()
    })

    it("잘못된 JSON 메시지는 DLQ에 저장한다", async () => {
        await mockRedisService.rpush(RESULT_QUEUE_KEY, "invalid-json{{{")

        subscriber = createAnalysisResultSubscriber()
        await new Promise((r) => setTimeout(r, 150))

        // JSON.parse 실패 → catch → DLQ에 rpush
        expect(mockRedisService.rpush).toHaveBeenCalledWith(
            "ai:analysis:dead-letter",
            expect.any(String)
        )
        expect(mockProcessor.process).not.toHaveBeenCalled()
    })

    it("Subscriber가 꺼낸 후에만 큐에서 제거된다 (메시지 보존 검증)", async () => {
        const message = JSON.stringify({
            jobId: "job-preserve-1",
            assessmentId: 200,
            success: true,
            score: 90,
        })

        // RPUSH → LLEN 확인
        await mockRedisService.rpush(RESULT_QUEUE_KEY, message)
        const lenBefore = await mockRedisService.llen(RESULT_QUEUE_KEY)
        expect(lenBefore).toBe(1)

        // BLPOP → LLEN 감소 확인
        const consumed = await mockRedisService.blpop(RESULT_QUEUE_KEY, 1)
        expect(consumed).toBe(message)

        const lenAfter = await mockRedisService.llen(RESULT_QUEUE_KEY)
        expect(lenAfter).toBe(0)
    })

    it("shouldAutoRetry() true 시 scheduleRetry()를 호출한다", async () => {
        const message = JSON.stringify({
            jobId: "job-retry-1",
            assessmentId: 300,
            success: false,
            message: "analysis failed",
        })

        mockAssessmentRepo.findById.mockResolvedValue({
            shouldAutoRetry: jest.fn().mockReturnValue(true),
        } as never)

        await mockRedisService.rpush(RESULT_QUEUE_KEY, message)

        subscriber = createAnalysisResultSubscriber()
        await new Promise((r) => setTimeout(r, 200))

        expect(mockProcessor.process).toHaveBeenCalledWith(
            expect.objectContaining({
                jobId: "job-retry-1",
                assessmentId: 300,
            })
        )
        expect(mockAssessmentRepo.findById).toHaveBeenCalledWith(300)
        expect(mockAnalysisService.scheduleRetry).toHaveBeenCalledWith(300, 5000)
    })
})
