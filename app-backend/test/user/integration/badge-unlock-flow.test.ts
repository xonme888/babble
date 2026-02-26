import "reflect-metadata"
import request from "supertest"
import { Express } from "express"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { container } from "tsyringe"
import { initializeTestApp, cleanupDatabase } from "../../utils/e2e-helper"
import { User, UserRole } from "@features/user/domain/user.entity"
import { Assessment, AssessmentStatus } from "@features/assessment/domain/assessment.entity"
import { Badge } from "@features/gamification/domain/badge.entity"
import { BADGE_SEEDS } from "@features/gamification/infrastructure/seed/badge-seed"
import { BadgeService } from "@features/gamification/application/badge.service"
import os from "os"
import fs from "fs"
import path from "path"
import { extractVerificationCode } from "../../utils/db-test-setup"

describe("배지 획득 통합 흐름 (BDD)", () => {
    let app: Express
    let accessToken: string
    let testUserId: number
    const tempAudioPath = path.join(os.tmpdir(), `badge_test_audio_${Date.now()}.wav`)

    const testUser = {
        email: "badge_hunter@example.com",
        password: "TestPassword123!",
        firstName: "Badge",
        lastName: "Hunter",
        agreedToTerms: true,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentTestUser: any
    let testScriptId: number

    beforeAll(async () => {
        app = await initializeTestApp()

        // 뱃지 시드 삽입
        const badgeRepo = AppDataSource.getRepository(Badge)
        for (const seed of BADGE_SEEDS) {
            await badgeRepo.save(badgeRepo.create(seed))
        }

        currentTestUser = {
            ...testUser,
            email: `badge_hunter_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`,
        }

        fs.writeFileSync(tempAudioPath, "fake audio content")

        // 스크립트 생성을 위해 회원가입 & 인증 & 관리자로 로그인
        const regRes = await request(app)
            .post("/api/v1/auth/register")
            .send(currentTestUser)
            .expect(201)
        testUserId = regRes.body.data.id
        const code = extractVerificationCode()
        await request(app)
            .post("/api/v1/auth/verify-email")
            .send({ email: currentTestUser.email, code })
            .expect(200)

        const userRepository = AppDataSource.getRepository(User)
        await userRepository.update(testUserId, { role: UserRole.ADMIN })

        const loginRes = await request(app)
            .post("/api/v1/auth/login")
            .send({ email: currentTestUser.email, password: currentTestUser.password })
            .expect(200)
        accessToken = loginRes.body.data.accessToken

        // 진단용 구절 생성
        const scriptRes = await request(app)
            .post("/api/v1/scripts")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({
                title: "Badge Test Script",
                content: "perfect speech",
                category: "test",
                difficulty: "EASY",
            })
            .expect(201)
        testScriptId = scriptRes.body.data.id
    })

    afterAll(async () => {
        await cleanupDatabase()
        if (fs.existsSync(tempAudioPath)) {
            fs.unlinkSync(tempAudioPath)
        }
    })

    describe("시나리오: 사용자가 첫 번째 업적을 달성함", () => {
        it("첫 번째 진단 완료 후 '첫 걸음' 배지를 획득해야 한다", async () => {
            // 1. 초기 상태: 해금된 배지 없음
            const initialAchRes = await request(app)
                .get("/api/v1/users/achievements")
                .set("Authorization", `Bearer ${accessToken}`)
            const initialBadges = initialAchRes.body.data.filter((a: any) => a.isUnlocked)
            expect(initialBadges.length).toBe(0)

            // 2. 평가 제출
            const submitRes = await request(app)
                .post("/api/v1/assessments")
                .set("Authorization", `Bearer ${accessToken}`)
                .field("scriptId", testScriptId.toString())
                .field("duration", "10")
                .attach("audio", tempAudioPath)
                .expect(201)

            const assessmentId = submitRes.body.data.id

            // 3. 수동으로 평가 완료 트리거 (백그라운드 워커 시뮬레이션)
            const assessmentRepo = AppDataSource.getRepository(Assessment)
            const assessment = await assessmentRepo.findOneBy({ id: assessmentId })
            if (assessment) {
                assessment.status = AssessmentStatus.ANALYZING
                await assessmentRepo.save(assessment)
                assessment.completeAnalysis({
                    score: 100,
                    transcribedText: "perfect speech",
                    feedback: { message: "Excellent" },
                })
                await assessmentRepo.save(assessment)
            }

            // 4. 뱃지 평가 수동 트리거 (이벤트 핸들러는 수동 DB 조작으로 발동 안 됨)
            const badgeService = container.resolve(BadgeService)
            await badgeService.evaluateAndUnlock(testUserId)

            // 5. 배지 확인: '첫 걸음' (COUNT_1) 및 '완벽한 발음' (SCORE_95) 포함
            const finalAchRes = await request(app)
                .get("/api/v1/users/achievements")
                .set("Authorization", `Bearer ${accessToken}`)
            const unlockedTitles = finalAchRes.body.data
                .filter((a: any) => a.isUnlocked)
                .map((a: Record<string, unknown>) => a.title)

            expect(unlockedTitles).toContain("첫 걸음")
            expect(unlockedTitles).toContain("완벽한 발음")
        })
    })
})
