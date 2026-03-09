import "reflect-metadata"
import { Assessment, AssessmentStatus } from "@features/assessment/domain/assessment.entity"
import { AssessmentCreatedEvent } from "@features/assessment/domain/events/assessment-created.event"
import { AssessmentAnalyzingEvent } from "@features/assessment/domain/events/assessment-analyzing.event"
import { AssessmentCompletedEvent } from "@features/assessment/domain/events/assessment-completed.event"
import { AssessmentFailedEvent } from "@features/assessment/domain/events/assessment-failed.event"
import { ValidationException } from "@shared/core/exceptions/domain-exceptions"
import type { AIAnalysisResult } from "@features/assessment/domain/ai-analysis-result.interface"

describe("Assessment Entity (평가 엔티티 단위 테스트)", () => {
    describe("create (생성)", () => {
        it("초기 상태가 PENDING인 새로운 평가 인스턴스를 생성해야 한다", () => {
            // Given (주어진 조건)
            const userId = 1
            const audioUrl = "uploads/audio.mp3"
            const duration = 120
            const scriptId = 10

            // When
            const assessment = Assessment.create(userId, audioUrl, duration, scriptId)

            // Then
            expect(assessment.userId).toBe(userId)
            expect(assessment.audioUrl).toBe(audioUrl)
            expect(assessment.duration).toBe(duration)
            expect(assessment.scriptId).toBe(scriptId)
            expect(assessment.status).toBe(AssessmentStatus.PENDING)
            expect(assessment.retryCount).toBe(0)

            const events = assessment.getDomainEvents()
            expect(events.length).toBe(0) // Now explicitly emitted via emitCreatedEvent
        })
    })

    describe("emitCreatedEvent (생성 이벤트 발행)", () => {
        it("AssessmentCreatedEvent를 발행해야 한다", () => {
            const assessment = Assessment.create(1, "audio.m4a", 10)
            assessment.id = 99 // Mock ID
            assessment.emitCreatedEvent()

            const events = assessment.getDomainEvents()
            expect(events.length).toBe(1)
            expect(events[0]).toBeInstanceOf(AssessmentCreatedEvent)
        })
    })

    describe("startAnalysis (분석 시작)", () => {
        it("상태를 PENDING에서 ANALYZING으로 전환해야 한다", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.PENDING
            assessment.retryCount = 0

            // When / Then
            assessment.startAnalysis()

            // Then
            expect(assessment.status).toBe(AssessmentStatus.ANALYZING)
            expect(assessment.retryCount).toBe(1)
            expect(
                assessment.getDomainEvents().some((e) => e instanceof AssessmentAnalyzingEvent)
            ).toBe(true)
        })

        it("ANALYZING→startAnalysis() 재진입 시 retryCount를 증가시키지 않는다", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.ANALYZING
            assessment.retryCount = 1

            // When
            assessment.startAnalysis()

            // Then
            expect(assessment.status).toBe(AssessmentStatus.ANALYZING)
            expect(assessment.retryCount).toBe(1) // 미변경
        })

        it("FAILED→startAnalysis() 시 retryCount를 증가시킨다", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.FAILED
            assessment.retryCount = 1

            // When
            assessment.startAnalysis()

            // Then
            expect(assessment.status).toBe(AssessmentStatus.ANALYZING)
            expect(assessment.retryCount).toBe(2)
        })

        it("COMPLETED 상태인 경우 에러를 던져야 한다", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.COMPLETED

            // When & Then
            expect(() => assessment.startAnalysis()).toThrow(ValidationException)
        })
    })

    describe("completeAnalysis (분석 완료)", () => {
        it("상태를 ANALYZING에서 COMPLETED로 전환하고 결과를 저장해야 한다", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.ANALYZING
            const result = {
                score: 85,
                transcribedText: "Hello world",
                feedback: { issues: ["pronunciation"] },
                speakingRate: 150,
            }

            // When
            assessment.completeAnalysis(result)

            // Then
            expect(assessment.status).toBe(AssessmentStatus.COMPLETED)
            expect(assessment.score).toBe(85)
            expect(assessment.transcribedText).toBe("Hello world")
            expect(assessment.feedback).toEqual(result.feedback)
            expect(assessment.speakingRate).toBe(150)
            expect(
                assessment.getDomainEvents().some((e) => e instanceof AssessmentCompletedEvent)
            ).toBe(true)
        })
    })

    describe("failAnalysis (분석 실패)", () => {
        it("최대 재시도 횟수 미만인 경우 FAILED 상태로 전환해야 한다", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.ANALYZING
            assessment.retryCount = 1

            // When
            assessment.failAnalysis("Server error", 3)

            // Then
            expect(assessment.status).toBe(AssessmentStatus.FAILED)
            expect(assessment.lastError).toBe("Server error")
            expect(
                assessment.getDomainEvents().some((e) => e instanceof AssessmentFailedEvent)
            ).toBe(true)
        })

        it("최대 재시도 횟수에 도달하면 MAX_RETRY_EXCEEDED 상태로 전환해야 한다", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.ANALYZING
            assessment.retryCount = 3

            // When
            assessment.failAnalysis("Server error", 3)

            // Then
            expect(assessment.status).toBe(AssessmentStatus.MAX_RETRY_EXCEEDED)
        })
    })

    describe("applyAnalysisResult (AI 분석 결과 적용)", () => {
        it("성공 결과에서 faScore와 phonemeAccuracy를 feedback에 포함해야 한다", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.ANALYZING
            const result: AIAnalysisResult = {
                assessmentId: 1,
                success: true,
                score: 85,
                transcribed_text: "안녕하세요",
                similarity: 0.85,
                alignment: [{ text: "안녕하세요", status: "correct" }],
                fa_score: 0.76,
                phoneme_accuracy: 0.92,
            }

            // When
            assessment.applyAnalysisResult(result)

            // Then
            expect(assessment.status).toBe(AssessmentStatus.COMPLETED)
            expect(assessment.feedback!.faScore).toBe(0.76)
            expect(assessment.feedback!.phonemeAccuracy).toBe(0.92)
        })

        it("faScore가 없는 AI 결과도 정상 처리해야 한다 (하위 호환)", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.ANALYZING
            const result: AIAnalysisResult = {
                assessmentId: 1,
                success: true,
                score: 80,
                transcribed_text: "테스트",
            }

            // When
            assessment.applyAnalysisResult(result)

            // Then
            expect(assessment.status).toBe(AssessmentStatus.COMPLETED)
            expect(assessment.feedback!.faScore).toBeUndefined()
        })

        it("fluency 필드가 포함된 AI 결과를 정상 적용해야 한다", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.ANALYZING
            const result: AIAnalysisResult = {
                assessmentId: 1,
                success: true,
                score: 90,
                transcribed_text: "안녕하세요",
                similarity: 0.90,
                alignment: [{ text: "안녕하세요", status: "correct" }],
                fluency_score: 72.5,
                fluency_detail: {
                    pause_score: 85.0,
                    stability_score: 60.0,
                    intonation_score: 70.0,
                    unnatural_pauses: [{ after_word_index: 0, duration: 0.8 }],
                    mean_spm: 240.0,
                    cv: 0.2,
                    chunk_rates: [230, 250, 240, 240],
                    sentence_intonations: [{
                        type: "declarative",
                        expected_trend: "falling",
                        actual_trend: "falling",
                        score: 100,
                    }],
                },
            }

            // When
            assessment.applyAnalysisResult(result)

            // Then
            expect(assessment.status).toBe(AssessmentStatus.COMPLETED)
            expect(assessment.fluencyScore).toBe(72.5)
            expect(assessment.fluencyDetail).toBeDefined()
            expect(assessment.fluencyDetail!.pauseScore).toBe(85.0)
            expect(assessment.fluencyDetail!.stabilityScore).toBe(60.0)
            expect(assessment.fluencyDetail!.intonationScore).toBe(70.0)
        })

        it("fluency 필드가 없는 AI 결과도 정상 처리해야 한다 (하위 호환)", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.ANALYZING
            const result: AIAnalysisResult = {
                assessmentId: 1,
                success: true,
                score: 80,
                transcribed_text: "테스트",
            }

            // When
            assessment.applyAnalysisResult(result)

            // Then
            expect(assessment.status).toBe(AssessmentStatus.COMPLETED)
            expect(assessment.fluencyScore).toBeNull()
            expect(assessment.fluencyDetail).toBeNull()
        })

        it("voice_quality 필드가 포함된 AI 결과를 정상 적용해야 한다", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.ANALYZING
            const result: AIAnalysisResult = {
                assessmentId: 1,
                success: true,
                score: 88,
                transcribed_text: "안녕하세요",
                voice_quality: {
                    hnr: 22.5,
                    jitter_percent: 0.8,
                    shimmer_percent: 3.2,
                    hnr_severity: "normal",
                    jitter_severity: "normal",
                    shimmer_severity: "normal",
                    voice_quality_score: 90.0,
                },
            }

            // When
            assessment.applyAnalysisResult(result)

            // Then
            expect(assessment.status).toBe(AssessmentStatus.COMPLETED)
            expect(assessment.voiceQuality).toBeDefined()
            expect(assessment.voiceQuality!.hnr).toBe(22.5)
            expect(assessment.voiceQuality!.jitterPercent).toBe(0.8)
            expect(assessment.voiceQuality!.shimmerPercent).toBe(3.2)
            expect(assessment.voiceQuality!.voiceQualityScore).toBe(90.0)
        })

        it("monotone 필드가 포함된 AI 결과를 정상 적용해야 한다", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.ANALYZING
            const result: AIAnalysisResult = {
                assessmentId: 1,
                success: true,
                score: 75,
                transcribed_text: "테스트 문장입니다",
                monotone: {
                    f0_mean: 180.5,
                    f0_stdev: 35.2,
                    f0_range: 120.0,
                    f0_cv: 0.195,
                    severity: "normal",
                    monotone_score: 82.0,
                },
            }

            // When
            assessment.applyAnalysisResult(result)

            // Then
            expect(assessment.status).toBe(AssessmentStatus.COMPLETED)
            expect(assessment.monotone).toBeDefined()
            expect(assessment.monotone!.f0Mean).toBe(180.5)
            expect(assessment.monotone!.f0Stdev).toBe(35.2)
            expect(assessment.monotone!.severity).toBe("normal")
            expect(assessment.monotone!.monotoneScore).toBe(82.0)
        })

        it("stuttering 필드가 포함된 AI 결과를 정상 적용해야 한다", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.ANALYZING
            const result: AIAnalysisResult = {
                assessmentId: 1,
                success: true,
                score: 70,
                transcribed_text: "가 가 나다",
                stuttering: {
                    total_syllables: 5,
                    total_disfluencies: 2,
                    repetition_count: 1,
                    prolongation_count: 0,
                    block_count: 1,
                    disfluency_rate: 40.0,
                    severity: "moderate",
                    stuttering_score: 45.0,
                    events: [
                        {
                            type: "repetition",
                            word_index: 0,
                            word: "가",
                            duration: 0.3,
                            detail: "단어 반복",
                        },
                        {
                            type: "block",
                            word_index: 1,
                            word: "나다",
                            duration: 1.5,
                            detail: "무음 블록",
                        },
                    ],
                },
            }

            // When
            assessment.applyAnalysisResult(result)

            // Then
            expect(assessment.status).toBe(AssessmentStatus.COMPLETED)
            expect(assessment.stuttering).toBeDefined()
            expect(assessment.stuttering!.repetitionCount).toBe(1)
            expect(assessment.stuttering!.blockCount).toBe(1)
            expect(assessment.stuttering!.disfluencyRate).toBe(40.0)
            expect(assessment.stuttering!.severity).toBe("moderate")
            expect(assessment.stuttering!.events).toHaveLength(2)
            expect(assessment.stuttering!.events[0].type).toBe("repetition")
        })

        it("voice_quality/monotone/stuttering 필드가 없는 AI 결과도 정상 처리해야 한다 (하위 호환)", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.ANALYZING
            const result: AIAnalysisResult = {
                assessmentId: 1,
                success: true,
                score: 80,
                transcribed_text: "테스트",
            }

            // When
            assessment.applyAnalysisResult(result)

            // Then
            expect(assessment.status).toBe(AssessmentStatus.COMPLETED)
            expect(assessment.voiceQuality).toBeNull()
            expect(assessment.monotone).toBeNull()
            expect(assessment.stuttering).toBeNull()
        })

        it("실패 결과에서 failAnalysis를 호출해야 한다", () => {
            // Given
            const assessment = new Assessment()
            assessment.status = AssessmentStatus.ANALYZING
            assessment.retryCount = 1

            // When
            assessment.applyAnalysisResult({
                assessmentId: 1,
                success: false,
                message: "Whisper error",
            })

            // Then
            expect(assessment.status).toBe(AssessmentStatus.FAILED)
            expect(assessment.lastError).toBe("Whisper error")
        })
    })

    describe("canRetry (재시도 가능 여부)", () => {
        it("상태가 FAILED, MAX_RETRY_EXCEEDED, ANALYZING인 경우 true를 반환해야 한다", () => {
            // Given
            const assessment = new Assessment()

            // FAILED (기존 실패)
            assessment.status = AssessmentStatus.FAILED
            expect(assessment.canRetry()).toBe(true)

            // MAX_RETRY_EXCEEDED (최대 횟수 초과 후 수동 재시도)
            assessment.status = AssessmentStatus.MAX_RETRY_EXCEEDED
            expect(assessment.canRetry()).toBe(true)

            // ANALYZING (진행 중이지만 강제 재시도)
            assessment.status = AssessmentStatus.ANALYZING
            expect(assessment.canRetry()).toBe(true)

            // 실패 케이스: COMPLETED (이미 성공)
            assessment.status = AssessmentStatus.COMPLETED
            expect(assessment.canRetry()).toBe(false)

            // 실패 케이스: PENDING (이미 대기 중 - 중복 큐잉 방지)
            assessment.status = AssessmentStatus.PENDING
            expect(assessment.canRetry()).toBe(false)
        })
    })
})
