import type { AlignmentItem } from "./ai-analysis-result.interface"

/**
 * AI 분석 피드백 구조
 *
 * AI 서비스에서 반환하는 피드백 데이터의 인터페이스.
 * 향후 AI 서비스 확장 시 필드 추가를 위해 인덱스 시그니처 포함.
 */
export interface IAnalysisFeedback {
    /** 유사도 점수 (0~1) */
    similarity?: number
    /** 정렬 분석 결과 (단어별 상태 + 음소 상세) */
    alignment?: AlignmentItem[]
    /** Forced Alignment 전체 점수 (0~1) */
    fa_score?: number
    /** 음소 정확도 (0~1) */
    phoneme_accuracy?: number
    /** 향후 확장 대비 */
    [key: string]: unknown
}
