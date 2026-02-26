import { container } from "tsyringe"
import { IRedisService } from "@shared/core/redis-service.interface"
import { SSENotificationService } from "./sse-notification.service"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { SSE_ASSESSMENT_UPDATED_CHANNEL } from "@features/assessment/application/analysis-result-processor"

/**
 * Redis Pub/Sub을 구독하여 SSE 클라이언트에게 실시간 알림을 전달하는 구독자
 *
 * Processor가 DB 저장 후 발행하는 sse:assessment:updated 채널을 구독한다.
 * (이전: AI Worker가 직접 발행하는 ai:analysis:completed 채널 → 결과 큐 전환으로 제거)
 */
export const createSSERedisSubscriber = () => {
    const logger = container.resolve<ILogger>(DI_TOKENS.ILogger)
    const redisService = container.resolve<IRedisService>(DI_TOKENS.IRedisService)
    const notificationService = container.resolve(SSENotificationService)

    const subClient = redisService.getDuplicateClient()

    logger.info(`[SSE-Subscriber] Subscribing to Redis channel: ${SSE_ASSESSMENT_UPDATED_CHANNEL}`)

    subClient.subscribe(SSE_ASSESSMENT_UPDATED_CHANNEL, (err: Error | null) => {
        if (err) {
            logger.error(`[SSE-Subscriber] Failed to subscribe: ${err.message}`)
        }
    })

    subClient.on("message", (channel: string, message: string) => {
        if (channel !== SSE_ASSESSMENT_UPDATED_CHANNEL) return

        try {
            const data = JSON.parse(message)
            logger.info(
                `[SSE-Subscriber] Forwarding analysis completion for Assessment ${data.assessmentId}`
            )

            // SSE 클라이언트들에게 알림 전송
            notificationService.notifyAll("analysis_completed", {
                assessmentId: data.assessmentId,
                status: data.status,
                success: data.status === "COMPLETED",
            })
        } catch (error: unknown) {
            logger.error(`[SSE-Subscriber] Error parsing Redis message: ${error instanceof Error ? error.message : String(error)}`)
        }
    })

    return {
        close: async () => {
            await subClient.unsubscribe(SSE_ASSESSMENT_UPDATED_CHANNEL)
            await subClient.quit()
        },
    }
}
