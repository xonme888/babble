/**
 * OpenAPI spec 정적 파일 생성 스크립트
 *
 * app.ts의 swaggerJsdoc 설정을 재사용하여 openapi.json을 생성한다.
 * 코드 생성(Admin 타입, Flutter 모델)과 계약 검증의 입력으로 사용된다.
 */
import swaggerJsdoc from "swagger-jsdoc"
import fs from "fs"
import path from "path"
import type { OpenAPISpec } from "@shared/core/types/raw-query.types"

const spec = swaggerJsdoc({
    definition: {
        openapi: "3.0.3",
        info: {
            title: "Babble API",
            version: "1.0.0",
            description: "Babble API — 발음 연습 서비스",
        },
        servers: [{ url: "/api/v1" }],
        components: {
            securitySchemes: {
                bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
            },
            schemas: {
                SuccessResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        data: { type: "object" },
                        message: { type: "string" },
                    },
                },
                ApiErrorResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: false },
                        message: { type: "string" },
                        errorCode: { type: "string" },
                        errorKey: { type: "string" },
                    },
                },
                PaginatedResponse: {
                    type: "object",
                    properties: {
                        items: { type: "array", items: {} },
                        total: { type: "integer" },
                        limit: { type: "integer" },
                        offset: { type: "integer" },
                    },
                },
                UserRole: {
                    type: "string",
                    enum: ["USER", "ADMIN"],
                },
                AssessmentStatus: {
                    type: "string",
                    enum: ["PENDING", "ANALYZING", "COMPLETED", "FAILED", "MAX_RETRY_EXCEEDED"],
                },
                ScriptDifficulty: {
                    type: "string",
                    enum: ["EASY", "MEDIUM", "HARD"],
                },
                User: {
                    type: "object",
                    properties: {
                        id: { type: "integer" },
                        email: { type: "string", format: "email" },
                        firstName: { type: "string" },
                        lastName: { type: "string", nullable: true },
                        role: { $ref: "#/components/schemas/UserRole" },
                        isVerified: { type: "boolean" },
                        isActive: { type: "boolean" },
                        weeklyGoal: { type: "integer" },
                        createdAt: { type: "string", format: "date-time" },
                    },
                },
                Assessment: {
                    type: "object",
                    properties: {
                        id: { type: "integer" },
                        userId: { type: "integer" },
                        audioUrl: { type: "string" },
                        duration: { type: "integer" },
                        scriptText: { type: "string", nullable: true },
                        transcribedText: { type: "string", nullable: true },
                        scriptId: { type: "integer", nullable: true },
                        status: { $ref: "#/components/schemas/AssessmentStatus" },
                        retryCount: { type: "integer" },
                        score: { type: "number", nullable: true },
                        feedback: { type: "string", nullable: true },
                        speakingRate: { type: "number", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                    },
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: [
        path.join(__dirname, "../features/**/dtos/*.ts"),
        path.join(__dirname, "../features/**/*.routes.ts"),
    ],
})

const outputPath = path.join(__dirname, "../../openapi.json")
fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2))

const specObj = spec as OpenAPISpec
console.log(`OpenAPI spec generated: ${outputPath}`)
console.log(`  Paths: ${Object.keys(specObj.paths || {}).length}`)
console.log(`  Schemas: ${Object.keys(specObj.components?.schemas || {}).length}`)
