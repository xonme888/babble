/**
 * 큐 Port 인터페이스
 *
 * Application 계층이 BullMQ 등 인프라 의존 없이 큐를 사용할 수 있도록 추상화한다.
 */

/** AI 분석 작업 유형 — 큐 내부 전용 (HTTP API 미노출) */
export enum AnalysisType {
    SCRIPT = "SCRIPT",
    WORD = "WORD",
    BREATHING = "BREATHING",
    FREE_SPEECH = "FREE_SPEECH",
}

interface BaseAnalysisJobData {
    analysisType: AnalysisType
    assessmentId: number
    audioUrl: string
    traceId?: string
}

export interface ScriptAnalysisJobData extends BaseAnalysisJobData {
    analysisType: AnalysisType.SCRIPT
    scriptContent: string
}

export interface WordAnalysisJobData extends BaseAnalysisJobData {
    analysisType: AnalysisType.WORD
    scriptContent: string
}

export interface BreathingAnalysisJobData extends BaseAnalysisJobData {
    analysisType: AnalysisType.BREATHING
}

export interface FreeSpeechAnalysisJobData extends BaseAnalysisJobData {
    analysisType: AnalysisType.FREE_SPEECH
}

export type AnalysisJobData =
    | ScriptAnalysisJobData
    | WordAnalysisJobData
    | BreathingAnalysisJobData
    | FreeSpeechAnalysisJobData

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

import type { NotificationPreferenceKey } from "@features/notification/domain/notification-preference.types"

/** 푸시 알림 큐에 전달할 데이터 */
export interface PushJobData {
    userId: number
    title: string
    body: string
    preferenceKey?: NotificationPreferenceKey
    data?: Record<string, string>
}

/** 푸시 알림 큐 Port */
export interface IPushQueue {
    /** 푸시 알림 발송 작업을 큐에 추가 */
    enqueue(data: PushJobData): Promise<void>
    /** 여러 푸시 알림을 한 번에 큐에 추가 (BullMQ addBulk) */
    enqueueBatch(items: PushJobData[]): Promise<void>
}
