/**
 * AI 분석 결과 페이로드 인터페이스
 * Python AI 서버에서 Redis Pub/Sub으로 전달되는 분석 결과 구조
 * analysis-result.subscriber.ts, stuck-assessment-cleaner.ts 공용
 */
export interface AIAnalysisResult {
    jobId?: string
    assessmentId: number
    success: boolean
    message?: string
    score?: number
    transcribed_text?: string
    similarity?: number
    alignment?: AlignmentItem[]
    pitch_data?: { t: number; f0: number }[]
    speaking_rate?: number
    fa_score?: number           // Forced Alignment 전체 점수 (0~1)
    phoneme_accuracy?: number   // 음소 정확도 (0~1)
}

/** 자모 비교 결과 (초성/중성/종성) */
export interface JamoComparison {
    expected: string
    actual: string
    match: boolean
}

/** 음절 단위 차이 분석 */
export interface SyllableDiffItem {
    expected: string
    actual: string
    initial?: JamoComparison
    medial?: JamoComparison
    final?: JamoComparison
    fa_confidence?: number
}

/** 단어 단위 음소 상세 분석 */
export interface PhonemeDetailItem {
    syllable_diffs: SyllableDiffItem[]
    phoneme_accuracy: number
}

/** 정렬 분석 항목 */
export interface AlignmentItem {
    text: string
    spoken?: string
    status: "correct" | "incorrect" | "missed" | "extra"
    fa_confidence?: number
    phoneme_detail?: PhonemeDetailItem
}
