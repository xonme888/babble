import { injectable } from "tsyringe"
import { IAnalysisQueue, AnalysisJobData, AnalysisJobOptions } from "@shared/core/queue.interface"
import { assessmentAnalysisQueue } from "./analysis.queue"
import { configurations } from "../config/configurations"

/**
 * BullMQ 기반 AI 분석 큐 어댑터
 *
 * Queue defaultJobOptions(attempts, backoff)가 기본 적용되지만,
 * 재시도 작업(scheduleRetry)은 단일 시도로 제한한다 — 재시도 예약 자체가 이미 재시도이므로.
 */
@injectable()
export class AnalysisQueueAdapter implements IAnalysisQueue {
    async enqueue(data: AnalysisJobData, options?: AnalysisJobOptions): Promise<void> {
        const config = configurations()
        const isRetryJob = options?.jobId?.includes("-retry-")

        await assessmentAnalysisQueue.add("analyze", data, {
            jobId: options?.jobId,
            delay: options?.delay,
            // 최초 분석: defaultJobOptions(attempts=3, exponential backoff) 적용
            // 재시도 작업: BullMQ 레벨 재시도 1회 — Assessment 레벨 재시도와 중복 방지
            ...(isRetryJob && {
                attempts: 1,
                backoff: undefined,
            }),
        })
    }
}
