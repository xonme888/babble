import { injectable } from "tsyringe"
import { IEmailQueue, EmailJobData } from "@shared/core/queue.interface"
import { emailQueue, EMAIL_QUEUE_NAME } from "./email.queue"
import { QueueCrypto } from "@shared/utils/queue-crypto.utils"

/**
 * BullMQ 기반 이메일 큐 어댑터
 *
 * 암호화는 인프라 관심사이므로 어댑터 내부에서 처리한다.
 */
@injectable()
export class EmailQueueAdapter implements IEmailQueue {
    async enqueue(data: EmailJobData): Promise<void> {
        await emailQueue.add(EMAIL_QUEUE_NAME, {
            to: QueueCrypto.encrypt(data.to),
            subject: QueueCrypto.encrypt(data.subject),
            content: QueueCrypto.encrypt(data.content),
            logId: data.logId,
            encrypted: true,
        })
    }
}
