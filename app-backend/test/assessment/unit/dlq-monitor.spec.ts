import "reflect-metadata"
import { register } from "prom-client"
import { DLQMonitor } from "@features/assessment/cron/dlq-monitor"
import { createMockRedisService, createMockLogger, createMockIConfigService } from "../../utils/mock-factories"

describe("DLQMonitor (DLQ 모니터)", () => {
    let monitor: DLQMonitor
    let mockRedis: ReturnType<typeof createMockRedisService>
    let mockLogger: ReturnType<typeof createMockLogger>

    const ERROR_THRESHOLD = 10

    beforeEach(() => {
        jest.clearAllMocks()
        register.clear()
        mockRedis = createMockRedisService()
        mockLogger = createMockLogger()
        const mockConfig = createMockIConfigService({
            config: {
                worker: { dlqErrorThreshold: ERROR_THRESHOLD },
            },
        } as any)

        monitor = new DLQMonitor(mockRedis, mockLogger, mockConfig)
    })

    describe("check (DLQ 체크)", () => {
        it("DLQ가 비어 있으면 debug 로그를 남겨야 한다", async () => {
            // Given
            mockRedis.llen.mockResolvedValue(0)

            // When
            await monitor.check()

            // Then
            expect(mockRedis.llen).toHaveBeenCalledWith("ai:analysis:dead-letter")
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("empty")
            )
        })

        it("DLQ 길이가 임계값 이하이면 warn 로그를 남겨야 한다", async () => {
            // Given
            mockRedis.llen.mockResolvedValue(3)

            // When
            await monitor.check()

            // Then
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("3")
            )
        })

        it("DLQ 길이가 임계값 초과이면 error 로그를 남겨야 한다", async () => {
            // Given
            mockRedis.llen.mockResolvedValue(ERROR_THRESHOLD + 1)

            // When
            await monitor.check()

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("immediate attention")
            )
        })

        it("임계값과 정확히 같은 길이이면 warn 로그를 남겨야 한다", async () => {
            // Given
            mockRedis.llen.mockResolvedValue(ERROR_THRESHOLD)

            // When
            await monitor.check()

            // Then
            expect(mockLogger.warn).toHaveBeenCalled()
            expect(mockLogger.error).not.toHaveBeenCalled()
        })

        it("Redis 조회 실패 시 throw하지 않고 error 로그를 남겨야 한다", async () => {
            // Given
            mockRedis.llen.mockRejectedValue(new Error("Redis connection failed"))

            // When & Then — 예외가 발생하지 않아야 한다
            await expect(monitor.check()).resolves.toBeUndefined()
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Redis connection failed")
            )
        })

        it("Redis 조회 실패가 Error 인스턴스가 아닌 경우에도 로그를 남겨야 한다", async () => {
            // Given
            mockRedis.llen.mockRejectedValue("unknown error")

            // When
            await monitor.check()

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("unknown error")
            )
        })
    })
})
