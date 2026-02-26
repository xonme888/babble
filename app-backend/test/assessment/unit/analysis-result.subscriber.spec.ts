import {
    createMockLogger,
    createMockRedisService,
    createMockAssessmentRepository,
    createMockAnalysisResultProcessor,
} from "../../utils/mock-factories"

/**
 * AnalysisResultSubscriber 단위 테스트
 *
 * Subscriber는 thin wrapper로서 아래만 담당:
 * - Redis BLPOP 결과 큐 소비 + JSON 파싱
 * - AnalysisResultProcessor.process() 호출 위임
 * - 자동 재시도 스케줄링 (인프라 관심사)
 * - DLQ 저장 (에러 폴백)
 */

// DI 컨테이너 모킹
const mockLogger = createMockLogger()
const mockRedisService = createMockRedisService()
const mockAssessmentRepo = createMockAssessmentRepository()
const mockProcessor = createMockAnalysisResultProcessor()

/** 클래스 토큰 구조 -- tsyringe의 resolve에 전달되는 클래스 타입 */
interface ClassToken {
    name: string
}

// container.resolve는 문자열 토큰과 클래스 토큰 모두 처리해야 함
jest.mock("tsyringe", () => ({
    container: {
        resolve: jest.fn((token: string | ClassToken) => {
            // 문자열 토큰
            if (token === "ILogger") return mockLogger
            if (token === "IRedisService") return mockRedisService
            // 클래스 토큰 -- name으로 매칭
            if (typeof token === "function" && (token as ClassToken).name === "AnalysisResultProcessor")
                return mockProcessor
            if (typeof token === "function" && (token as ClassToken).name === "AssessmentRepository")
                return mockAssessmentRepo
            throw new Error(`Unknown DI token: ${token}`)
        }),
    },
    injectable: () => (target: Record<string, unknown>) => target,
    inject: () => () => undefined,
}))

// TraceContext.run은 콜백을 즉시 실행하도록 모킹
jest.mock("@shared/infra/logging/trace-context", () => ({
    TraceContext: {
        run: jest.fn((_id: string, fn: () => Promise<void>) => fn()),
    },
}))

// configurations 모킹
jest.mock("@shared/infra/config/configurations", () => ({
    configurations: jest.fn(() => ({
        queue: { retryDelay: 5000 },
    })),
}))

// fs 부분 모킹 — DLQ 파일 쓰기만 차단, 나머지(realpathSync.native 등)는 실제 fs 유지
// 전체 대체 시 TypeORM → path-scurry 로드 실패 (fs.realpathSync.native 소멸)
jest.mock("fs", () => ({
    ...jest.requireActual("fs"),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
}))

import {
    createAnalysisResultSubscriber,
    RESULT_QUEUE_KEY,
    SSE_ASSESSMENT_UPDATED_CHANNEL,
} from "@features/assessment/worker/analysis-result.subscriber"

/** blpop이 null 반환 시 폴링 루프가 spin하지 않도록 지연을 주는 헬퍼 */
function delayedNull(): Promise<null> {
    return new Promise((r) => setTimeout(() => r(null), 100))
}

describe("AnalysisResultSubscriber", () => {
    let subscriber: ReturnType<typeof createAnalysisResultSubscriber>

    /** BLPOP 응답 큐 -- 테스트에서 메시지를 주입 */
    let blpopResponses: (string | null)[]

    beforeEach(() => {
        jest.clearAllMocks()
        blpopResponses = []

        // blpop 모킹: 큐에 메시지가 있으면 즉시 반환, 없으면 지연 후 null
        // 지연이 없으면 while(running) 루프가 동기적으로 spin → OOM
        mockRedisService.blpop.mockImplementation(async () => {
            if (blpopResponses.length > 0) {
                return blpopResponses.shift()!
            }
            return delayedNull()
        })
    })

    afterEach(async () => {
        if (subscriber) {
            await subscriber.close()
            await new Promise((r) => setTimeout(r, 150))
        }
    })

    it("RESULT_QUEUE_KEY가 ai:results:completed이다", () => {
        expect(RESULT_QUEUE_KEY).toBe("ai:results:completed")
    })

    it("SSE_ASSESSMENT_UPDATED_CHANNEL이 re-export된다", () => {
        expect(SSE_ASSESSMENT_UPDATED_CHANNEL).toBe("sse:assessment:updated")
    })

    describe("BLPOP 폴링 루프", () => {
        it("BLPOP으로 결과 큐를 소비한다", async () => {
            subscriber = createAnalysisResultSubscriber()
            await new Promise((r) => setTimeout(r, 150))

            expect(mockRedisService.blpop).toHaveBeenCalledWith(RESULT_QUEUE_KEY, 5)
        })

        it("유효한 메시지 수신 시 processor.process()를 호출한다", async () => {
            const message = JSON.stringify({
                jobId: "job-1",
                assessmentId: 42,
                success: true,
                score: 85,
            })
            blpopResponses.push(message)

            subscriber = createAnalysisResultSubscriber()
            await new Promise((r) => setTimeout(r, 200))

            expect(mockProcessor.process).toHaveBeenCalledWith(
                expect.objectContaining({
                    jobId: "job-1",
                    assessmentId: 42,
                    success: true,
                })
            )
        })

        it("guest- 접두사 jobId는 무시한다", async () => {
            blpopResponses.push(
                JSON.stringify({
                    jobId: "guest-abc-123",
                    success: true,
                    score: 75,
                })
            )

            subscriber = createAnalysisResultSubscriber()
            await new Promise((r) => setTimeout(r, 200))

            expect(mockProcessor.process).not.toHaveBeenCalled()
        })

        it("jobId 누락 메시지는 warn 로그 후 무시한다", async () => {
            blpopResponses.push(
                JSON.stringify({
                    assessmentId: 42,
                    success: true,
                })
            )

            subscriber = createAnalysisResultSubscriber()
            await new Promise((r) => setTimeout(r, 200))

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid message"))
            expect(mockProcessor.process).not.toHaveBeenCalled()
        })

        it("assessmentId 누락 메시지는 warn 로그 후 무시한다", async () => {
            blpopResponses.push(
                JSON.stringify({
                    jobId: "job-2",
                    success: true,
                })
            )

            subscriber = createAnalysisResultSubscriber()
            await new Promise((r) => setTimeout(r, 200))

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid message"))
            expect(mockProcessor.process).not.toHaveBeenCalled()
        })
    })

    describe("자동 재시도 (인프라 관심사)", () => {
        it("process 완료 후 shouldAutoRetry()가 true이면 재시도를 스케줄링한다", async () => {
            const assessment = {
                shouldAutoRetry: jest.fn().mockReturnValue(true),
            }
            mockAssessmentRepo.findById.mockResolvedValue(assessment as never)

            blpopResponses.push(
                JSON.stringify({
                    jobId: "job-retry",
                    assessmentId: 42,
                    success: false,
                    message: "error",
                })
            )

            subscriber = createAnalysisResultSubscriber()
            await new Promise((r) => setTimeout(r, 250))

            expect(mockProcessor.process).toHaveBeenCalled()
            expect(mockAssessmentRepo.findById).toHaveBeenCalledWith(42)
        })

        it("process 완료 후 shouldAutoRetry()가 false이면 재시도하지 않는다", async () => {
            const assessment = {
                shouldAutoRetry: jest.fn().mockReturnValue(false),
            }
            mockAssessmentRepo.findById.mockResolvedValue(assessment as never)

            blpopResponses.push(
                JSON.stringify({
                    jobId: "job-no-retry",
                    assessmentId: 42,
                    success: true,
                    score: 90,
                })
            )

            subscriber = createAnalysisResultSubscriber()
            await new Promise((r) => setTimeout(r, 250))

            expect(mockProcessor.process).toHaveBeenCalled()
        })
    })

    describe("DLQ (에러 폴백)", () => {
        it("processor.process() 에러 시 DLQ에 저장한다", async () => {
            mockProcessor.process.mockRejectedValue(new Error("DB crash"))

            blpopResponses.push(
                JSON.stringify({
                    jobId: "job-fail",
                    assessmentId: 42,
                    success: true,
                })
            )

            subscriber = createAnalysisResultSubscriber()
            await new Promise((r) => setTimeout(r, 250))

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Error processing message")
            )
            expect(mockRedisService.rpush).toHaveBeenCalledWith(
                "ai:analysis:dead-letter",
                expect.any(String)
            )
        })
    })

    describe("close()", () => {
        it("close() 호출 시 running 플래그를 false로 설정하여 루프 종료", async () => {
            subscriber = createAnalysisResultSubscriber()
            await subscriber.close()
            await new Promise((r) => setTimeout(r, 150))

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Stopping BLPOP consumer")
            )
        })
    })
})
