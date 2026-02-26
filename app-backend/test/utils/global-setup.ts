import path from "path"
import { Client } from "pg"

/**
 * Jest globalSetup — E2E/통합 테스트 전용
 *
 * 1. PostgreSQL 연결 가능 여부 확인 (미실행 시 안내 메시지 출력 후 종료)
 * 2. myapp_test DB 존재 여부 확인, 없으면 자동 생성
 */
export default async function globalSetup(): Promise<void> {
    // preload.js가 globalSetup보다 먼저 실행되지 않으므로 수동으로 .env.test 로드
    require("dotenv").config({ path: path.join(__dirname, "../../.env.test") })

    const host = process.env.DATABASE_HOST || "localhost"
    const port = parseInt(process.env.DATABASE_PORT || "5433", 10)
    const user = process.env.DATABASE_USERNAME || "postgres"
    const password = process.env.DATABASE_PASSWORD || "postgres"
    const dbName = process.env.DATABASE_DATABASE || "myapp_test"

    // 1. postgres 기본 DB에 연결하여 테스트 DB 존재 여부 확인
    const adminClient = new Client({
        host,
        port,
        user,
        password,
        database: "postgres",
    })

    try {
        await adminClient.connect()
    } catch {
        console.error(
            "\n❌ PostgreSQL 미실행. 다음 명령어로 시작하세요:\n" +
                "  cd app-infrastructure && docker compose up postgres redis -d\n"
        )
        process.exit(1)
    }

    // 2. 테스트 DB 자동 생성
    try {
        const result = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [
            dbName,
        ])
        if (result.rowCount === 0) {
            await adminClient.query(`CREATE DATABASE "${dbName}"`)
            console.log(`✅ 테스트 DB "${dbName}" 생성 완료`)
        }
    } finally {
        await adminClient.end()
    }
}
