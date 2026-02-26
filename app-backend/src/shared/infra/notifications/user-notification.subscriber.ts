import { container } from "tsyringe"
import { IRedisService } from "@shared/core/redis-service.interface"
import { IRealtimeNotifier } from "@shared/core/realtime-notifier.interface"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { SSE_ASSESSMENT_UPDATED_CHANNEL } from "@features/assessment/worker/analysis-result.subscriber"

/**
 * 사용자 타겟 SSE 알림 구독자
 *
 * AnalysisResultSubscriber가 DB 업데이트 후 발행하는
 * 'sse:assessment:updated' 채널을 구독하여 해당 userId의 SSE 클라이언트에게 전달
 */
export const createUserNotificationSubscriber = () => {
    const logger = container.resolve<ILogger>(DI_TOKENS.ILogger)
    const redisService = container.resolve<IRedisService>(DI_TOKENS.IRedisService)
    const notifier = container.resolve<IRealtimeNotifier>(DI_TOKENS.IRealtimeNotifier)

    const subClient = redisService.getDuplicateClient()

    logger.info(`[UserNotification] Subscribing to channel: ${SSE_ASSESSMENT_UPDATED_CHANNEL}`)

    subClient.subscribe(SSE_ASSESSMENT_UPDATED_CHANNEL, (err: Error | null) => {
        if (err) {
            logger.error(`[UserNotification] Failed to subscribe: ${err.message}`)
        }
    })

    subClient.on("message", (channel: string, message: string) => {
        if (channel !== SSE_ASSESSMENT_UPDATED_CHANNEL) return

        try {
            const { userId, ...data } = JSON.parse(message)

            if (!userId) {
                logger.warn(`[UserNotification] userId 누락된 메시지: ${message}`)
                return
            }

            notifier.notifyUser(userId, "assessment_updated", data)
        } catch (error: unknown) {
            logger.error(`[UserNotification] 메시지 파싱 실패: ${error instanceof Error ? error.message : String(error)}`)
        }
    })

    return {
        close: async () => {
            logger.info("[UserNotification] Closing subscription...")
            await subClient.unsubscribe(SSE_ASSESSMENT_UPDATED_CHANNEL)
            await subClient.quit()
        },
    }
}
