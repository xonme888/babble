import "reflect-metadata"
import request from "supertest"
import { Express } from "express"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { initializeTestApp, cleanupDatabase } from "../../utils/e2e-helper"
import { User, UserRole } from "@features/user/domain/user.entity"
import { extractVerificationCode } from "../../utils/db-test-setup"

describe("스크립트 관리 통합 흐름 (BDD)", () => {
    let app: Express
    let adminToken: string
    let testUserId: number

    const adminUser = {
        email: `bdd_admin_${Date.now()}@example.com`,
        password: "AdminPassword123!",
        firstName: "BDD",
        lastName: "Admin",
        agreedToTerms: true,
    }

    let currentAdminEmail: string

    beforeAll(async () => {
        app = await initializeTestApp()
        currentAdminEmail = `admin-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`

        // 회원가입, 인증, 관리자 권한 부여
        const regRes = await request(app)
            .post("/api/v1/auth/register")
            .send({
                ...adminUser,
                email: currentAdminEmail,
            })
            .expect(201)
        testUserId = regRes.body.data.id
        const code = extractVerificationCode()
        await request(app)
            .post("/api/v1/auth/verify-email")
            .send({ email: currentAdminEmail, code })
            .expect(200)

        const userRepository = AppDataSource.getRepository(User)
        await userRepository.update(testUserId, { role: UserRole.ADMIN })

        const loginRes = await request(app)
            .post("/api/v1/auth/login")
            .send({ email: currentAdminEmail, password: adminUser.password })
            .expect(200)
        adminToken = loginRes.body.data.accessToken
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    describe("시나리오: 콘텐츠 관리자가 트레이닝 콘텐츠를 구성함", () => {
        it("관리자가 학습 경로를 구성하기 위해 챕터와 스크립트를 생성할 수 있어야 한다", async () => {
            // 챕터 생성
            const chapterRes = await request(app)
                .post("/api/v1/scripts/chapters")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    title: "BDD Chapter",
                    description: "Organizing scripts",
                    orderIndex: 1,
                })
                .expect(201)

            const chapterId = chapterRes.body.data.id

            // 스크립트 생성
            const scriptRes = await request(app)
                .post("/api/v1/scripts")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    title: "BDD Script",
                    content: "Training content",
                    category: "practice",
                    difficulty: "MEDIUM",
                    chapterId: chapterId,
                })
                .expect(201)

            expect(scriptRes.body.data.title).toBe("BDD Script")
        })

        it("사용자가 탐색할 수 있도록 챕터와 스크립트 목록을 제공해야 한다", async () => {
            // 챕터 목록
            const chaptersRes = await request(app).get("/api/v1/scripts/chapters").expect(200)
            expect(chaptersRes.body.data.length).toBeGreaterThan(0)

            // 카테고리 필터를 사용한 스크립트 목록 (페이지네이션 응답)
            const scriptsRes = await request(app)
                .get("/api/v1/scripts?category=practice")
                .expect(200)
            expect(scriptsRes.body.data.items.length).toBeGreaterThan(0)
            expect(scriptsRes.body.data.items[0].category).toBe("practice")
        })
    })

    describe("시나리오: 콘텐츠 유지보수", () => {
        it("관리자가 기존 스크립트 상세 정보를 업데이트할 수 있어야 한다", async () => {
            // 스크립트 찾기 (페이지네이션 응답)
            const listRes = await request(app).get("/api/v1/scripts")
            const scriptId = listRes.body.data.items[0].id

            // 업데이트
            const updateRes = await request(app)
                .put(`/api/v1/scripts/${scriptId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Updated BDD Title" })
                .expect(200)

            expect(updateRes.body.data.title).toBe("Updated BDD Title")
        })
    })

    describe("보안: 관리자 전용 작업 제한", () => {
        it("일반 사용자의 스크립트 생성을 거부해야 한다", async () => {
            // 일반 사용자 등록
            const user = {
                email: `normal_${Date.now()}@example.com`,
                password: "Password123!",
                firstName: "Normal",
                agreedToTerms: true,
            }
            await request(app).post("/api/v1/auth/register").send(user).expect(201)
            const code = extractVerificationCode()
            await request(app)
                .post("/api/v1/auth/verify-email")
                .send({ email: user.email, code })
                .expect(200)
            const loginRes = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: user.email, password: user.password })
                .expect(200)
            const userToken = loginRes.body.data.accessToken

            await request(app)
                .post("/api/v1/scripts")
                .set("Authorization", `Bearer ${userToken}`)
                .send({ title: "Illegal Script" })
                .expect(403)
        })
    })
})
