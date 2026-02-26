/**
 * API 계약 검증 스크립트
 *
 * TypeScript의 enum/const 객체와 openapi.json의 enum 값이 일치하는지 검증한다.
 * 불일치 시 빌드를 실패시켜 계약 드리프트를 방지한다.
 */
import fs from "fs"
import path from "path"
import {
    AssessmentStatus,
    ScriptDifficulty,
    UserRole,
    GameType,
    BadgeCategory,
} from "../shared/core/constants/api-contract"
import type { OpenAPISpec, OpenAPISchema } from "@shared/core/types/raw-query.types"

const specPath = path.join(__dirname, "../../openapi.json")

if (!fs.existsSync(specPath)) {
    console.error("❌ openapi.json not found. Run `npm run openapi:generate` first.")
    process.exit(1)
}

const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"))
let hasError = false

function assertEnumMatch(name: string, tsValues: readonly string[], schemaPath: string) {
    // OpenAPI spec에서 enum 값 추출 (점 표기법으로 탐색)
    const parts = schemaPath.split(".")
    let current: Record<string, unknown> = spec
    for (const part of parts) {
        current = (current?.[part] ?? undefined) as Record<string, unknown>
    }

    if (!current || !Array.isArray(current)) {
        console.warn(`⚠️  ${name}: OpenAPI spec에서 enum을 찾을 수 없음 (${schemaPath})`)
        return
    }

    const specValues = current as string[]
    const tsSet = new Set(tsValues)
    const specSet = new Set(specValues)

    // TS에만 있는 값
    const onlyInTs = tsValues.filter((v) => !specSet.has(v))
    // Spec에만 있는 값
    const onlyInSpec = specValues.filter((v) => !tsSet.has(v))

    if (onlyInTs.length > 0 || onlyInSpec.length > 0) {
        hasError = true
        console.error(`❌ ${name} enum 불일치:`)
        if (onlyInTs.length > 0) {
            console.error(`   TypeScript에만 존재: [${onlyInTs.join(", ")}]`)
        }
        if (onlyInSpec.length > 0) {
            console.error(`   OpenAPI에만 존재: [${onlyInSpec.join(", ")}]`)
        }
    } else {
        console.log(`✅ ${name}: ${tsValues.length}개 값 일치`)
    }
}

console.log("🔍 API 계약 검증 시작...\n")

// 각 enum 검증 — OpenAPI spec 내 enum 위치를 직접 탐색
const schemas = spec.components?.schemas || {}

// AssessmentStatus enum 찾기
for (const [schemaName, schema] of Object.entries(schemas)) {
    const props = (schema as OpenAPISchema)?.properties
    if (!props) continue

    if (props.status?.enum) {
        const statusValues = props.status.enum as string[]
        // AssessmentStatus에 해당하는지 확인 (PENDING, ANALYZING 등이 포함된 경우)
        if (statusValues.includes("PENDING") && statusValues.includes("ANALYZING")) {
            assertEnumMatch(
                `AssessmentStatus (in ${schemaName}.status)`,
                Object.values(AssessmentStatus),
                `components.schemas.${schemaName}.properties.status.enum`
            )
        }
    }

    if (props.difficulty?.enum) {
        const diffValues = props.difficulty.enum as string[]
        if (diffValues.includes("EASY") && diffValues.includes("MEDIUM")) {
            assertEnumMatch(
                `ScriptDifficulty (in ${schemaName}.difficulty)`,
                Object.values(ScriptDifficulty),
                `components.schemas.${schemaName}.properties.difficulty.enum`
            )
        }
    }

    if (props.role?.enum) {
        const roleValues = props.role.enum as string[]
        if (roleValues.includes("USER") && roleValues.includes("ADMIN")) {
            assertEnumMatch(
                `UserRole (in ${schemaName}.role)`,
                Object.values(UserRole),
                `components.schemas.${schemaName}.properties.role.enum`
            )
        }
    }

    if (props.gameType?.enum) {
        const gameTypeValues = props.gameType.enum as string[]
        if (gameTypeValues.includes("WORD_MATCH")) {
            assertEnumMatch(
                `GameType (in ${schemaName}.gameType)`,
                Object.values(GameType),
                `components.schemas.${schemaName}.properties.gameType.enum`
            )
        }
    }

    if (props.category?.enum) {
        const categoryValues = props.category.enum as string[]
        if (categoryValues.includes("STREAK") && categoryValues.includes("SCORE")) {
            assertEnumMatch(
                `BadgeCategory (in ${schemaName}.category)`,
                Object.values(BadgeCategory),
                `components.schemas.${schemaName}.properties.category.enum`
            )
        }
    }
}

console.log("")
if (hasError) {
    console.error("❌ 계약 검증 실패 — TypeScript enum과 OpenAPI spec이 불일치합니다.")
    process.exit(1)
} else {
    console.log("✅ 모든 계약 검증 통과")
}
