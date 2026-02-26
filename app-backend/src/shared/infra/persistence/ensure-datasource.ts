import { AppDataSource } from "./data-source"
import { SystemLogger } from "@shared/infra/logging/system-logger"

let dbInitPromise: Promise<void> | null = null

/**
 * DataSource 초기화 보장 — Worker/Subscriber 공용
 * 실패 시 dbInitPromise를 null로 리셋하여 재시도 가능
 */
export async function ensureDatasource(): Promise<void> {
    if (AppDataSource.isInitialized) return

    if (!dbInitPromise) {
        SystemLogger.info("Initializing Database (One-time setup)...")
        dbInitPromise = AppDataSource.initialize()
            .then(() => {
                SystemLogger.info("Database initialized.")
            })
            .catch((err: unknown) => {
                // 리셋하여 다음 호출에서 재시도 가능하게 함
                dbInitPromise = null
                throw err
            })
    }
    await dbInitPromise
}
