import { Queue } from "bullmq"
import { configurations } from "../config/configurations"
import { SystemLogger } from "../logging/system-logger"
import { REDIS_QUEUE_DB } from "@shared/core/constants/redis.constants"

const config = configurations()

export const EMAIL_QUEUE_NAME = "email"

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
    defaultJobOptions: {
        attempts: config.queue.attempts,
        backoff: {
            type: "exponential",
            delay: config.queue.backoffDelay,
        },
        removeOnComplete: { count: config.queue.completedJobRetention },
        removeOnFail: { count: config.queue.failedJobRetention },
    },
    connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: REDIS_QUEUE_DB,
    },
})

// Redis 연결 에러 핸들러 — 미등록 시 unhandled error로 프로세스 종료 위험
emailQueue.on("error", (err) => {
    SystemLogger.error("[EmailQueue] Queue error", err)
})
