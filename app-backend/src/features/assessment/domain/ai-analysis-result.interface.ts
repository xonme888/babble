/**
 * AI 분석 결과 페이로드 인터페이스
 * Python AI 서버에서 Redis Pub/Sub으로 전달되는 분석 결과 구조
 * analysis-result.subscriber.ts, stuck-assessment-cleaner.ts 공용
 *
 * snake_case — AI 경계 전용. 도메인 저장 시 camelCase로 변환한다.
 */
export interface AIAnalysisResult {
    jobId?: string
    assessmentId: number
    success: boolean
    message?: string
    traceId?: string
    type?: string
    score?: number
    transcribed_text?: string
    similarity?: number
    alignment?: AIAlignmentItem[]
    pitch_data?: { t: number; f0: number }[]
    speaking_rate?: number
    fa_score?: number           // Forced Alignment 전체 점수 (0~1)
    phoneme_accuracy?: number   // 음소 정확도 (0~1)
    fluency_score?: number      // 유창성 종합 점수 (0~100)
    fluency_detail?: AIFluencyDetail | null
    voice_quality?: AIVoiceQuality | null
    monotone?: AIMonotoneDetail | null
    stuttering?: AIStutteringDetail | null
}

// ─── AI 경계 타입 (snake_case — Redis 수신 전용) ───

/** AI 유창성 분석 상세 결과 (snake_case) */
export interface AIFluencyDetail {
    pause_score: number
    stability_score: number
    intonation_score: number
    unnatural_pauses: { after_word_index: number; duration: number }[]
    mean_spm: number
    cv: number
    chunk_rates: number[]
    sentence_intonations: {
        type: string
        expected_trend: string
        actual_trend: string
        score: number
    }[]
}

/** AI 자모 비교 결과 (snake_case) */
export interface AIJamoComparison {
    expected: string
    actual: string
    match: boolean
}

/** AI 음절 단위 차이 분석 (snake_case) */
export interface AISyllableDiffItem {
    expected: string
    actual: string
    initial?: AIJamoComparison
    medial?: AIJamoComparison
    final?: AIJamoComparison
    fa_confidence?: number
}

/** AI 단어 단위 음소 상세 분석 (snake_case) */
export interface AIPhonemeDetailItem {
    syllable_diffs: AISyllableDiffItem[]
    phoneme_accuracy: number
}

/** AI 음질 분석 결과 (snake_case) */
export interface AIVoiceQuality {
    hnr: number | null
    jitter_percent: number | null
    shimmer_percent: number | null
    hnr_severity: string
    jitter_severity: string
    shimmer_severity: string
    voice_quality_score: number
}

/** AI 단음조 분석 결과 (snake_case) */
export interface AIMonotoneDetail {
    f0_mean: number | null
    f0_stdev: number | null
    f0_range: number | null
    f0_cv: number | null
    severity: string
    monotone_score: number
}

/** AI 말더듬 비유창성 이벤트 (snake_case) */
export interface AIStutteringEvent {
    type: "repetition" | "prolongation" | "block"
    word_index: number
    word: string
    duration: number
    detail: string
}

/** AI 말더듬 분석 결과 (snake_case) */
export interface AIStutteringDetail {
    total_syllables: number
    total_disfluencies: number
    repetition_count: number
    prolongation_count: number
    block_count: number
    disfluency_rate: number
    severity: string
    stuttering_score: number
    events: AIStutteringEvent[]
}

/** AI 정렬 분석 항목 (snake_case) */
export interface AIAlignmentItem {
    text: string
    spoken?: string
    status: "correct" | "incorrect" | "missed" | "extra"
    fa_confidence?: number
    phoneme_detail?: AIPhonemeDetailItem
}

// ─── 도메인 타입 (camelCase — DB 저장 및 API 응답용) ───

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
    faConfidence?: number
}

/** 단어 단위 음소 상세 분석 */
export interface PhonemeDetailItem {
    syllableDiffs: SyllableDiffItem[]
    phonemeAccuracy: number
}

/** 정렬 분석 항목 */
export interface AlignmentItem {
    text: string
    spoken?: string
    status: "correct" | "incorrect" | "missed" | "extra"
    faConfidence?: number
    phonemeDetail?: PhonemeDetailItem
}

/** 유창성 분석 상세 결과 */
export interface IFluencyDetail {
    pauseScore: number
    stabilityScore: number
    intonationScore: number
    unnaturalPauses: { afterWordIndex: number; duration: number }[]
    meanSpm: number
    cv: number
    chunkRates: number[]
    sentenceIntonations: {
        type: string
        expectedTrend: string
        actualTrend: string
        score: number
    }[]
}

/** 음질 분석 결과 (HNR/Jitter/Shimmer) */
export interface IVoiceQuality {
    hnr: number | null
    jitterPercent: number | null
    shimmerPercent: number | null
    hnrSeverity: string
    jitterSeverity: string
    shimmerSeverity: string
    voiceQualityScore: number
}

/** 단음조 분석 결과 (F0 변동성) */
export interface IMonotoneDetail {
    f0Mean: number | null
    f0Stdev: number | null
    f0Range: number | null
    f0Cv: number | null
    severity: string
    monotoneScore: number
}

/** 말더듬 비유창성 이벤트 */
export interface IStutteringEvent {
    type: "repetition" | "prolongation" | "block"
    wordIndex: number
    word: string
    duration: number
    detail: string
}

/** 말더듬 분석 결과 */
export interface IStutteringDetail {
    totalSyllables: number
    totalDisfluencies: number
    repetitionCount: number
    prolongationCount: number
    blockCount: number
    disfluencyRate: number
    severity: string
    stutteringScore: number
    events: IStutteringEvent[]
}

// ─── AI → 도메인 변환 함수 ───

/** AI AlignmentItem → 도메인 AlignmentItem */
function toAlignmentItem(ai: AIAlignmentItem): AlignmentItem {
    return {
        text: ai.text,
        spoken: ai.spoken,
        status: ai.status,
        faConfidence: ai.fa_confidence,
        phonemeDetail: ai.phoneme_detail ? {
            syllableDiffs: ai.phoneme_detail.syllable_diffs.map(sd => ({
                expected: sd.expected,
                actual: sd.actual,
                initial: sd.initial,
                medial: sd.medial,
                final: sd.final,
                faConfidence: sd.fa_confidence,
            })),
            phonemeAccuracy: ai.phoneme_detail.phoneme_accuracy,
        } : undefined,
    }
}

/** AI 분석 결과 → 도메인 camelCase 변환 */
export function toDomainAnalysisResult(ai: AIAnalysisResult) {
    return {
        score: ai.score ?? 0,
        transcribedText: ai.transcribed_text ?? "",
        feedback: {
            similarity: ai.similarity,
            alignment: ai.alignment?.map(toAlignmentItem),
            faScore: ai.fa_score,
            phonemeAccuracy: ai.phoneme_accuracy,
        },
        pitchData: ai.pitch_data,
        speakingRate: ai.speaking_rate,
        fluencyScore: ai.fluency_score,
        fluencyDetail: ai.fluency_detail ? {
            pauseScore: ai.fluency_detail.pause_score,
            stabilityScore: ai.fluency_detail.stability_score,
            intonationScore: ai.fluency_detail.intonation_score,
            unnaturalPauses: ai.fluency_detail.unnatural_pauses.map(p => ({
                afterWordIndex: p.after_word_index,
                duration: p.duration,
            })),
            meanSpm: ai.fluency_detail.mean_spm,
            cv: ai.fluency_detail.cv,
            chunkRates: ai.fluency_detail.chunk_rates,
            sentenceIntonations: ai.fluency_detail.sentence_intonations.map(si => ({
                type: si.type,
                expectedTrend: si.expected_trend,
                actualTrend: si.actual_trend,
                score: si.score,
            })),
        } as IFluencyDetail : undefined,
        voiceQuality: ai.voice_quality ? {
            hnr: ai.voice_quality.hnr,
            jitterPercent: ai.voice_quality.jitter_percent,
            shimmerPercent: ai.voice_quality.shimmer_percent,
            hnrSeverity: ai.voice_quality.hnr_severity,
            jitterSeverity: ai.voice_quality.jitter_severity,
            shimmerSeverity: ai.voice_quality.shimmer_severity,
            voiceQualityScore: ai.voice_quality.voice_quality_score,
        } as IVoiceQuality : undefined,
        monotone: ai.monotone ? {
            f0Mean: ai.monotone.f0_mean,
            f0Stdev: ai.monotone.f0_stdev,
            f0Range: ai.monotone.f0_range,
            f0Cv: ai.monotone.f0_cv,
            severity: ai.monotone.severity,
            monotoneScore: ai.monotone.monotone_score,
        } as IMonotoneDetail : undefined,
        stuttering: ai.stuttering ? {
            totalSyllables: ai.stuttering.total_syllables,
            totalDisfluencies: ai.stuttering.total_disfluencies,
            repetitionCount: ai.stuttering.repetition_count,
            prolongationCount: ai.stuttering.prolongation_count,
            blockCount: ai.stuttering.block_count,
            disfluencyRate: ai.stuttering.disfluency_rate,
            severity: ai.stuttering.severity,
            stutteringScore: ai.stuttering.stuttering_score,
            events: ai.stuttering.events.map(e => ({
                type: e.type,
                wordIndex: e.word_index,
                word: e.word,
                duration: e.duration,
                detail: e.detail,
            })),
        } as IStutteringDetail : undefined,
    }
}
