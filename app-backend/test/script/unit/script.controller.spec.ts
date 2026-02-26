import "reflect-metadata"
import { ScriptController } from "@features/script/presentation/script.controller"
import { Script } from "@features/script/domain/script.entity"
import { Request, Response, NextFunction } from "express"
import {
    createMockScriptService,
    createMockChapterProgressService,
} from "../../utils/mock-factories"

import type { ScriptService } from "@features/script/application/script.service"
import type { ChapterProgressService } from "@features/script/application/chapter-progress.service"

describe("ScriptController (스크립트 컨트롤러)", () => {
    let scriptController: ScriptController
    let scriptService: jest.Mocked<ScriptService>
    let chapterProgressService: jest.Mocked<ChapterProgressService>
    let req: Partial<Request>
    let res: Partial<Response> & { _headers?: Record<string, string> }
    let next: NextFunction

    beforeEach(() => {
        scriptService = createMockScriptService()
        chapterProgressService = createMockChapterProgressService()
        scriptController = new ScriptController(scriptService, chapterProgressService)
        req = { user: { id: 1 } as unknown }
        const headers: Record<string, string> = {}
        res = {
            _headers: headers,
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            set: jest.fn((key: string, value: string) => {
                headers[key] = value
                return res as Response
            }),
            end: jest.fn().mockReturnThis(),
        }
        next = jest.fn()
    })

    describe("getScripts (스크립트 목록 조회)", () => {
        it("200 상태와 함께 페이지네이션된 스크립트 목록을 반환해야 한다", async () => {
            const mockScripts = [{ id: 1, title: "Test" }]
            scriptService.getScripts.mockResolvedValue({
                items: mockScripts,
                total: 1,
            } as unknown)
            req.query = {}

            await scriptController.getScripts(req as Request, res as Response)

            expect(res.status).toHaveBeenCalledWith(200)
            const calledWith = (res.json as jest.Mock).mock.calls[0][0]
            expect(calledWith.success).toBe(true)
            expect(calledWith.data.items).toHaveLength(1)
            expect(calledWith.data.items[0]).toHaveProperty("id", 1)
            expect(calledWith.data.total).toBe(1)
            expect(calledWith.data).toHaveProperty("limit")
            expect(calledWith.data).toHaveProperty("offset")
        })
    })

    describe("createScript (스크립트 생성)", () => {
        it("스크립트를 생성하고 201 상태를 반환해야 한다", async () => {
            const data = { title: "New Script", content: "Content" }
            const createdScript = { id: 1, ...data }
            scriptService.createScript.mockResolvedValue(createdScript as unknown)
            req.body = data

            await scriptController.createScript(req as Request, res as Response)

            expect(res.status).toHaveBeenCalledWith(201)
            const calledWith = (res.json as jest.Mock).mock.calls[0][0]
            expect(calledWith.success).toBe(true)
            expect(calledWith.data).toHaveProperty("id", 1)
        })
    })

    describe("getScript (스크립트 조회)", () => {
        it("스크립트와 200 상태를 반환해야 한다", async () => {
            const mockScript = { id: 1, title: "Test" }
            scriptService.getScript.mockResolvedValue(mockScript as unknown)
            req.params = { id: "1" }

            await scriptController.getScriptById(req as Request, res as Response)

            expect(res.status).toHaveBeenCalledWith(200)
            const calledWith = (res.json as jest.Mock).mock.calls[0][0]
            expect(calledWith.success).toBe(true)
            expect(calledWith.data).toHaveProperty("id", 1)
        })
    })

    describe("getWordGameScriptsToday (오늘의 워드게임 스크립트)", () => {
        it("200과 함께 스크립트 배열을 반환한다", async () => {
            // Given
            const mockData = [
                {
                    scriptId: 1,
                    title: "T1",
                    content: "C1",
                    difficulty: "EASY",
                    isFirstPlay: true,
                    lastPlayedAt: null,
                    recommendedBlanks: null,
                    todayScore: 90,
                },
            ]
            scriptService.selectTodayGameScripts.mockResolvedValue(mockData as unknown)
            req.query = {}

            // When
            await scriptController.getWordGameScriptsToday(req as Request, res as Response)

            // Then
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: mockData,
            })
        })

        it("count 쿼리 파라미터를 50개로 제한한다", async () => {
            // Given
            scriptService.selectTodayGameScripts.mockResolvedValue([])
            req.query = { count: "100" }

            // When
            await scriptController.getWordGameScriptsToday(req as Request, res as Response)

            // Then
            expect(scriptService.selectTodayGameScripts).toHaveBeenCalledWith(1, 50)
        })
    })

    describe("getWordGameScripts (워드게임 스크립트 — ETag)", () => {
        const mockScripts = [
            Object.assign(new Script(), { id: 1, content: "ㄱ 발음 연습" }),
            Object.assign(new Script(), { id: 2, content: "ㄴ 발음 연습" }),
        ]

        it("If-None-Match가 현재 checksum과 일치하면 304를 반환한다", async () => {
            // Given
            const checksum = "a1b2c3d4e5f6g7h8"
            scriptService.getContentVersion.mockResolvedValue({
                checksum,
                updatedAt: new Date(),
            })
            req.headers = { "if-none-match": `"${checksum}"` }
            req.query = {}

            // When
            await scriptController.getWordGameScripts(req as Request, res as Response)

            // Then
            expect(res.status).toHaveBeenCalledWith(304)
            expect(res.end).toHaveBeenCalled()
            expect(res.json).not.toHaveBeenCalled()
            expect(scriptService.findUnlockedScriptsForGame).not.toHaveBeenCalled()
        })

        it("If-None-Match가 없으면 200 + ETag 헤더를 반환한다", async () => {
            // Given
            const checksum = "a1b2c3d4e5f6g7h8"
            scriptService.getContentVersion.mockResolvedValue({
                checksum,
                updatedAt: new Date(),
            })
            scriptService.findUnlockedScriptsForGame.mockResolvedValue(mockScripts)
            req.headers = {}
            req.query = {}

            // When
            await scriptController.getWordGameScripts(req as Request, res as Response)

            // Then
            expect(res.set).toHaveBeenCalledWith("ETag", `"${checksum}"`)
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: mockScripts,
            })
        })

        it("If-None-Match가 다르면 200 + 새 ETag 헤더를 반환한다", async () => {
            // Given
            const currentChecksum = "newchecksum12345"
            scriptService.getContentVersion.mockResolvedValue({
                checksum: currentChecksum,
                updatedAt: new Date(),
            })
            scriptService.findUnlockedScriptsForGame.mockResolvedValue(mockScripts)
            req.headers = { "if-none-match": `"oldchecksum12345"` }
            req.query = {}

            // When
            await scriptController.getWordGameScripts(req as Request, res as Response)

            // Then
            expect(res.set).toHaveBeenCalledWith("ETag", `"${currentChecksum}"`)
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.json).toHaveBeenCalled()
        })

        it("콘텐츠 버전이 없으면 ETag 없이 200을 반환한다", async () => {
            // Given
            scriptService.getContentVersion.mockResolvedValue(null)
            scriptService.findUnlockedScriptsForGame.mockResolvedValue(mockScripts)
            req.headers = {}
            req.query = {}

            // When
            await scriptController.getWordGameScripts(req as Request, res as Response)

            // Then
            expect(res.set).not.toHaveBeenCalled()
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: mockScripts,
            })
        })

        it("count 쿼리 파라미터를 200개로 제한한다", async () => {
            // Given
            scriptService.getContentVersion.mockResolvedValue(null)
            scriptService.findUnlockedScriptsForGame.mockResolvedValue([])
            req.headers = {}
            req.query = { count: "500" }

            // When
            await scriptController.getWordGameScripts(req as Request, res as Response)

            // Then
            expect(scriptService.findUnlockedScriptsForGame).toHaveBeenCalledWith(1, 200)
        })
    })
})
