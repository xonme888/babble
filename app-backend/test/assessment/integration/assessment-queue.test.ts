import "reflect-metadata"
import { extractVerificationCode } from "../../utils/db-test-setup"

import request from "supertest"
import { initializeTestApp, cleanupDatabase } from "../../utils/e2e-helper"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { User, UserRole } from "@features/user/domain/user.entity"
import path from "path"
import os from "os"
import fs from "fs"
import { assessmentAnalysisQueue } from "@shared/infra/queue/analysis.queue"

describe("Assessment BullMQ Queue Integration Test", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let app: any
    let accessToken: string
    let testUserId: number
    let testScriptId: number
    const tempAudioPath = path.join(os.tmpdir(), `queue_test_audio_${Date.now()}.wav`)

    beforeAll(async () => {
        app = await initializeTestApp()

        // 테스트 데이터 준비
        const testUser = {
            email: `queue_tester_${Date.now()}@example.com`,
            password: "Password123!",
            firstName: "Queue",
            lastName: "Tester",
            agreedToTerms: true,
        }

        const regRes = await request(app).post("/api/v1/auth/register").send(testUser).expect(201)
        testUserId = regRes.body.data.id

        // 인증 코드 추출
        const code = extractVerificationCode()
        await request(app)
            .post("/api/v1/auth/verify-email")
            .send({ email: testUser.email, code })
            .expect(200)

        // 관리자 권한 부여 (스크립트 생성용)
        await AppDataSource.getRepository(User).update(testUserId, { role: UserRole.ADMIN })

        const loginRes = await request(app)
            .post("/api/v1/auth/login")
            .send({ email: testUser.email, password: testUser.password })
            .expect(200)
        accessToken = loginRes.body.data.accessToken

        // 스크립트 생성
        const scriptRes = await request(app)
            .post("/api/v1/scripts")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({
                title: "Queue Test Script",
                content: "This is a test script for queueing.",
                category: "TEST",
                difficulty: "EASY",
                articulationPlace: "MIXED",
            })
            .expect(201)
        testScriptId = scriptRes.body.data.id

        fs.writeFileSync(tempAudioPath, "fake audio content")
    })

    afterAll(async () => {
        await cleanupDatabase()
        if (fs.existsSync(tempAudioPath)) {
            fs.unlinkSync(tempAudioPath)
        }
    })

    it("should queue an assessment analysis job when a new assessment is uploaded", async () => {
        const mockAdd = assessmentAnalysisQueue.add as jest.Mock

        const response = await request(app)
            .post("/api/v1/assessments")
            .set("Authorization", `Bearer ${accessToken}`)
            .field("scriptId", testScriptId.toString())
            .field("duration", "5")
            .attach("audio", tempAudioPath)
            .expect(201)

        const assessmentId = response.body.data.id
        expect(response.body.data.status).toBe("PENDING")

        // BullMQ Queue.add가 비동기로 호출되므로 대기 (EventDispatcher.dispatchAsync가 setImmediate를 사용함)
        let attempts = 0
        while (mockAdd.mock.calls.length === 0 && attempts < 20) {
            await new Promise((resolve) => setTimeout(resolve, 50))
            attempts++
        }

        // BullMQ Queue.add가 호출되었는지 확인
        expect(mockAdd).toHaveBeenCalledWith(
            "analyze",
            expect.objectContaining({
                assessmentId: assessmentId,
            }),
            expect.any(Object)
        )
    })
})
