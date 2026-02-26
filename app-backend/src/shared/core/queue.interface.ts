/**
 * 큐 Port 인터페이스
 *
 * Application 계층이 BullMQ 등 인프라 의존 없이 큐를 사용할 수 있도록 추상화한다.
 */

/** AI 분석 큐에 전달할 데이터 */
export interface AnalysisJobData {
    assessmentId: number
    audioUrl: string
    scriptContent: string
}

/** AI 분석 큐 옵션 */
export interface AnalysisJobOptions {
    jobId?: string
    delay?: number
}

/** AI 분석 큐 Port */
export interface IAnalysisQueue {
    /** 분석 작업을 큐에 추가 */
    enqueue(data: AnalysisJobData, options?: AnalysisJobOptions): Promise<void>
}

/** 이메일 큐에 전달할 데이터 */
export interface EmailJobData {
    to: string
    subject: string
    content: string
    logId: string
}

/** 이메일 큐 Port — 암호화는 어댑터 내부에서 처리 */
export interface IEmailQueue {
    /** 이메일 발송 작업을 큐에 추가 (암호화 포함) */
    enqueue(data: EmailJobData): Promise<void>
}
