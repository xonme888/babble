import { injectable, inject } from "tsyringe"
import { Gauge } from "prom-client"
import { ILogger } from "@shared/core/logger.interface"
import { IRedisService } from "@shared/core/redis-service.interface"
import { IConfigService } from "@shared/core/config.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"

const DLQ_KEY = "ai:analysis:dead-letter"

/**
 * DLQ 모니터
 *
 * `ai:analysis:dead-letter` 리스트 길이를 주기적으로 조회하여
 * 로그 레벨별 알림 + Prometheus Gauge로 노출합니다.
 */
@injectable()
export class DLQMonitor {
    private gauge: Gauge
    private readonly errorThreshold: number

    constructor(
        @inject(DI_TOKENS.IRedisService) private redisService: IRedisService,
        @inject(DI_TOKENS.ILogger) private logger: ILogger,
        @inject(DI_TOKENS.IConfigService) private configService: IConfigService
    ) {
        this.gauge = new Gauge({
            name: "dlq_analysis_length",
            help: "Number of messages in ai:analysis:dead-letter queue",
        })
        this.errorThreshold = this.configService.config.worker.dlqErrorThreshold
    }

    /**
     * DLQ 길이 조회 및 로그/메트릭 갱신
     * Cron: try-catch + error log, throw 금지
     */
    async check(): Promise<void> {
        try {
            const length = await this.redisService.llen(DLQ_KEY)
            this.gauge.set(length)

            if (length === 0) {
                this.logger.debug("[DLQMonitor] Dead letter queue is empty.")
                return
            }

            if (length > this.errorThreshold) {
                this.logger.error(
                    `[DLQMonitor] Dead letter queue has ${length} messages — immediate attention required.`
                )
                return
            }

            this.logger.warn(`[DLQMonitor] Dead letter queue has ${length} message(s).`)
        } catch (error: unknown) {
            this.logger.error(
                `[DLQMonitor] Failed to check DLQ: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }
}
