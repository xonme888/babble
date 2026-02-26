import "reflect-metadata"
import { AssessmentService } from "@features/assessment/application/assessment.service"
import { Assessment, AssessmentStatus } from "@features/assessment/domain/assessment.entity"
import { NotFoundException, ForbiddenException } from "@shared/core/exceptions/domain-exceptions"
import {
    createMockAssessmentRepository,
    createMockDomainEventDispatcher,
    createMockAssessmentAnalysisService,
    createMockChapterProgressService,
    createMockScriptService,
    createMockLogger,
} from "../../utils/mock-factories"

import type { AssessmentRepository } from "@features/assessment/infrastructure/assessment.repository"
import type { IDomainEventDispatcher } from "@shared/core/domain-event-dispatcher.interface"
import type { ILogger } from "@shared/core/logger.interface"
import type { AssessmentAnalysisService } from "@features/assessment/application/assessment-analysis.service"
import type { ChapterProgressService } from "@features/script/application/chapter-progress.service"
import type { ScriptService } from "@features/script/application/script.service"

describe("AssessmentService (평가 서비스)", () => {
    let assessmentService: AssessmentService
    let assessmentRepository: jest.Mocked<AssessmentRepository>
    let eventDispatcher: jest.Mocked<IDomainEventDispatcher>
    let mockLogger: jest.Mocked<ILogger>
    let mockAnalysisService: jest.Mocked<AssessmentAnalysisService>
    let chapterProgressService: jest.Mocked<ChapterProgressService>
    let scriptService: jest.Mocked<ScriptService>

    beforeEach(() => {
        assessmentRepository = createMockAssessmentRepository()
        eventDispatcher = createMockDomainEventDispatcher()
        mockLogger = createMockLogger()
        mockAnalysisService = createMockAssessmentAnalysisService()
        chapterProgressService = createMockChapterProgressService()
        scriptService = createMockScriptService()

        assessmentService = new AssessmentService(
            assessmentRepository,
            eventDispatcher as any,
            mockLogger,
            mockAnalysisService,
            chapterProgressService,
            scriptService
        )
    })

    describe("createAssessment (평가 생성)", () => {
        it("평가를 생성하고 분석을 직접 호출한 뒤 이벤트를 디스패치해야 한다", async () => {
            // Given
            const userId = 1
            const audioUrl = "http://example.com/audio.mp3"
            assessmentRepository.save.mockImplementation(async (a) => {
                a.id = 1
                return a
            })

            // When
            const result = await assessmentService.createAssessment(userId, audioUrl, 120)

            // Then
            expect(result).toBeInstanceOf(Assessment)
            expect(result.userId).toBe(userId)
            expect(result.audioUrl).toBe(audioUrl)
            expect(assessmentRepository.save).toHaveBeenCalled()
            expect(mockAnalysisService.analyzeAssessment).toHaveBeenCalledWith(1)
            expect(eventDispatcher.publishFromAggregate).toHaveBeenCalled()
        })

        it("분석 서비스 실패 시 에러를 전파해야 한다", async () => {
            // Given
            assessmentRepository.save.mockImplementation(async (a) => {
                a.id = 1
                return a
            })
            mockAnalysisService.analyzeAssessment.mockRejectedValue(
                new Error("Queue connection failed")
            )

            // When & Then
            await expect(assessmentService.createAssessment(1, "audio.mp3", 60)).rejects.toThrow(
                "Queue connection failed"
            )
        })
    })

    describe("createAssessment — 챕터 접근 검증", () => {
        it("해금된 챕터의 스크립트로 Assessment 생성 성공", async () => {
            // Given
            chapterProgressService.isScriptUnlocked.mockResolvedValue(true)
            assessmentRepository.save.mockImplementation(async (a) => {
                a.id = 1
                return a
            })

            // When
            const result = await assessmentService.createAssessment(1, "audio.mp3", 60, 10)

            // Then
            expect(result).toBeInstanceOf(Assessment)
            expect(chapterProgressService.isScriptUnlocked).toHaveBeenCalledWith(1, 10)
        })

        it("잠긴 챕터의 스크립트로 Assessment 생성 시 ForbiddenException", async () => {
            // Given
            chapterProgressService.isScriptUnlocked.mockResolvedValue(false)

            // When & Then
            await expect(
                assessmentService.createAssessment(1, "audio.mp3", 60, 10)
            ).rejects.toThrow(ForbiddenException)
        })

        it("scriptId가 undefined이면 검증 스킵 (자유 연습)", async () => {
            // Given
            assessmentRepository.save.mockImplementation(async (a) => {
                a.id = 1
                return a
            })

            // When
            const result = await assessmentService.createAssessment(1, "audio.mp3", 60)

            // Then
            expect(result).toBeInstanceOf(Assessment)
            expect(chapterProgressService.isScriptUnlocked).not.toHaveBeenCalled()
        })
    })

    describe("getAssessment (평가 조회)", () => {
        it("평가를 찾았고 사용자에게 속한 경우 평가를 반환해야 한다", async () => {
            // Given
            const mockAssessment = new Assessment()
            mockAssessment.id = 1
            mockAssessment.userId = 1
            assessmentRepository.findByIdOrThrow.mockResolvedValue(mockAssessment)

            // When
            const result = await assessmentService.getAssessment(1, 1)

            // Then
            expect(result).toBe(mockAssessment)
        })

        it("평가를 찾지 못한 경우 NotFoundException을 던져야 한다", async () => {
            // Given
            assessmentRepository.findByIdOrThrow.mockRejectedValue(
                new NotFoundException("assessment.not_found")
            )

            // When & Then
            await expect(assessmentService.getAssessment(1, 1)).rejects.toThrow(NotFoundException)
        })

        it("다른 사용자의 평가인 경우 NotFoundException을 던져야 한다", async () => {
            // Given
            const mockAssessment = new Assessment()
            mockAssessment.id = 1
            mockAssessment.userId = 2 // 다른 사용자
            assessmentRepository.findByIdOrThrow.mockResolvedValue(mockAssessment)

            // When & Then
            await expect(assessmentService.getAssessment(1, 1)).rejects.toThrow(NotFoundException)
        })
    })

    describe("retryAnalysis (분석 재시도)", () => {
        it("재시도가 가능한 경우 재시도해야 한다", async () => {
            // Given
            const mockAssessment = new Assessment()
            mockAssessment.id = 1
            mockAssessment.status = AssessmentStatus.FAILED
            mockAssessment.retryCount = 0
            assessmentRepository.findByIdLightOrThrow.mockResolvedValue(mockAssessment)
            assessmentRepository.save.mockResolvedValue(mockAssessment)

            // When
            await assessmentService.retryAnalysis(1)

            // Then
            expect(mockAssessment.status).toBe(AssessmentStatus.ANALYZING)
            expect(assessmentRepository.save).toHaveBeenCalled()
            expect(eventDispatcher.publishFromAggregate).toHaveBeenCalled()
        })

        it("최대 재시도 횟수를 초과한 경우 Error를 던져야 한다", async () => {
            // Given
            const mockAssessment = new Assessment()
            mockAssessment.id = 1
            mockAssessment.status = AssessmentStatus.COMPLETED // canRetry() returns false for COMPLETED
            mockAssessment.retryCount = 3
            assessmentRepository.findByIdLightOrThrow.mockResolvedValue(mockAssessment)

            // When & Then
            await expect(assessmentService.retryAnalysis(1)).rejects.toThrow(
                "assessment.cannot_retry"
            )
        })

        it("재시도할 평가를 찾지 못한 경우 NotFoundException을 던져야 한다", async () => {
            // Given
            assessmentRepository.findByIdLightOrThrow.mockRejectedValue(
                new NotFoundException("assessment.not_found")
            )

            // When & Then
            await expect(assessmentService.retryAnalysis(1)).rejects.toThrow(NotFoundException)
        })
    })

    describe("getAssessment — userId 미지정 (관리자 조회)", () => {
        it("userId 미지정 시 권한 확인을 건너뛰고 평가를 반환해야 한다", async () => {
            // Given
            const mockAssessment = new Assessment()
            mockAssessment.id = 1
            mockAssessment.userId = 999
            assessmentRepository.findByIdOrThrow.mockResolvedValue(mockAssessment)

            // When
            const result = await assessmentService.getAssessment(1)

            // Then
            expect(result).toBe(mockAssessment)
        })
    })

    describe("getAssessmentHistory (평가 이력 조회)", () => {
        it("사용자의 평가 이력을 반환해야 한다", async () => {
            // Given
            const mockResult = { items: [new Assessment()], total: 1 }
            assessmentRepository.findByUserId.mockResolvedValue(mockResult)

            // When
            const result = await assessmentService.getAssessmentHistory(1, 10, 0)

            // Then
            expect(result).toEqual(mockResult)
            expect(assessmentRepository.findByUserId).toHaveBeenCalledWith(1, 10, 0)
        })
    })

    describe("getAllAssessments (관리자 전체 조회)", () => {
        it("필터를 적용하여 전체 평가를 반환해야 한다", async () => {
            // Given
            const mockResult = { items: [new Assessment()], total: 1 }
            assessmentRepository.findAll.mockResolvedValue(mockResult)

            // When
            const result = await assessmentService.getAllAssessments(20, 0, { status: "COMPLETED" })

            // Then
            expect(result).toEqual(mockResult)
            expect(assessmentRepository.findAll).toHaveBeenCalledWith(20, 0, {
                status: "COMPLETED",
            })
        })
    })

    describe("createAssessment — 스크립트 스냅샷", () => {
        it("스크립트 스냅샷 조회 실패 시에도 Assessment를 생성해야 한다", async () => {
            // Given
            chapterProgressService.isScriptUnlocked.mockResolvedValue(true)
            scriptService.getScript.mockRejectedValue(new Error("Script not found"))
            assessmentRepository.save.mockImplementation(async (a) => {
                a.id = 1
                return a
            })

            // When
            const result = await assessmentService.createAssessment(1, "audio.mp3", 60, 10)

            // Then
            expect(result).toBeInstanceOf(Assessment)
            expect(result.scriptSnapshot).toBeFalsy()
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("스크립트 스냅샷 조회 실패")
            )
        })
    })
})
