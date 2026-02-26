import "reflect-metadata"
import _express, { Express } from "express"
import { container } from "tsyringe"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { setupDI } from "@shared/infra/di/diconfig"
import { createApp } from "@/app"
import { ILogger } from "@shared/core/logger.interface"
import { initializeTransactionalContext } from "typeorm-transactional"

import { User } from "@features/user/domain/user.entity"
import { Assessment } from "@features/assessment/domain/assessment.entity"
import { Script } from "@features/script/domain/script.entity"
import { UserGoalLog } from "@features/user/domain/user-goal-log.entity"
import { Chapter } from "@features/script/domain/chapter.entity"
import { AssessmentAnalysisLog } from "@features/assessment/domain/assessment-analysis-log.entity"
import { NotificationLog } from "@features/notification/domain/notification-log.entity"
import { ContentVersion } from "@features/script/domain/content-version.entity"
import { LearningRecord } from "@features/learning/domain/learning-record.entity"
import { DailyGoalLog } from "@features/learning/domain/daily-goal-log.entity"
import { GameSession } from "@features/game/domain/game-session.entity"
import { GameScriptCompletion } from "@features/game/domain/game-script-completion.entity"
import { GameWordResult } from "@features/game/domain/game-word-result.entity"
import { XpTransaction } from "@features/gamification/domain/xp-transaction.entity"
import { UserLevel } from "@features/gamification/domain/user-level.entity"
import { Badge } from "@features/gamification/domain/badge.entity"
import { UserBadge } from "@features/gamification/domain/user-badge.entity"
import { GameConfig } from "@features/gamification/domain/game-config.entity"
import { GameConfigHistory } from "@features/gamification/domain/game-config-history.entity"


let transactionalContextInitialized = false

/** 모듈 레벨 Redis 모킹 스토어 — 테스트 간 clearMockRedis()로 초기화 */
const mockRedisStore = new Map<string, string>()

/** 리스트 스토어 — rpush/lpop/blpop/llen 지원 */
const mockRedisListStore = new Map<string, string[]>()

/** Redis 모킹 스토어 초기화 (beforeEach에서 호출) */
export function clearMockRedis(): void {
    mockRedisStore.clear()
    mockRedisListStore.clear()
}

/**
 * E2E 테스트를 위해 앱을 초기화합니다.
 * DB와 DI 컨테이너를 설정하고 모킹된 의존성을 주입합니다.
 */
export async function initializeTestApp(): Promise<Express> {
    // Jest에서 SecurityError를 방지하기 위해 Node.js v25+의 글로벌 localStorage 비활성화
    try {
        if (typeof global !== "undefined") {
            Object.defineProperty(global, "localStorage", {
                value: undefined,
                writable: true,
                configurable: true,
            })
        }
    } catch {
        // Ignore
    }

    // 0. tsyringe 컨테이너 초기화 (중복 방지)
    container.reset()

    // typeorm-transactional 컨텍스트 초기화 (한 번만)
    if (!transactionalContextInitialized) {
        initializeTransactionalContext()
        transactionalContextInitialized = true
    }

    // 1. DB 초기화 (PostgreSQL)
    if (!AppDataSource.isInitialized) {
        AppDataSource.setOptions({
            entities: [
                User,
                Assessment,
                Script,
                Chapter,
                UserGoalLog,
                AssessmentAnalysisLog,
                NotificationLog,
                ContentVersion,
                LearningRecord,
                DailyGoalLog,
                GameSession,
                GameScriptCompletion,
                GameWordResult,
                XpTransaction,
                UserLevel,
                Badge,
                UserBadge,
                GameConfig,
                GameConfigHistory,
            ],
            migrationsRun: false, // 테스트는 synchronize()로 스키마 생성 — 마이그레이션 불필요
            synchronize: false, // initialize()에서 동기화 방지 — DROP SCHEMA 후 수동 실행
        })
        await AppDataSource.initialize()
        // 깨끗한 스키마 보장 — public 스키마 전체 재생성 (테이블 + enum 타입 포함)
        await AppDataSource.query(`DROP SCHEMA IF EXISTS public CASCADE`)
        await AppDataSource.query(`CREATE SCHEMA public`)
        await AppDataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public`)
        await AppDataSource.synchronize()
    } else {
        await truncateAllTables()
    }

    // 2. DI 컨테이너 설정
    await setupDI()

    // 3. 외부 서비스 모킹 (Mocking)
    // Redis 모킹 — 모듈 레벨 mockRedisStore 사용
    const mockRedis = {
        // Graceful 메서드
        get: jest.fn(async (key: string) => mockRedisStore.get(key) ?? null),
        set: jest.fn(async (key: string, value: string) => {
            mockRedisStore.set(key, value)
        }),
        del: jest.fn(async (key: string) => mockRedisStore.delete(key)),
        delete: jest.fn(async (key: string) => mockRedisStore.delete(key)),
        increment: jest.fn(async (key: string) => {
            const current = parseInt(mockRedisStore.get(key) ?? "0")
            const next = current + 1
            mockRedisStore.set(key, next.toString())
            return next
        }),
        ping: jest.fn().mockResolvedValue("PONG"),
        ttl: jest.fn().mockResolvedValue(100),
        exists: jest.fn(async (key: string) => mockRedisStore.has(key)),
        rpush: jest.fn(async (key: string, value: string) => {
            const list = mockRedisListStore.get(key) ?? []
            list.push(value)
            mockRedisListStore.set(key, list)
            return list.length
        }),
        lpop: jest.fn(async (key: string) => {
            const list = mockRedisListStore.get(key)
            if (!list || list.length === 0) return null
            return list.shift()!
        }),
        blpop: jest.fn(async (key: string) => {
            const list = mockRedisListStore.get(key)
            if (!list || list.length === 0) return null
            return list.shift()!
        }),
        llen: jest.fn(async (key: string) => {
            return mockRedisListStore.get(key)?.length ?? 0
        }),
        publish: jest.fn(async () => 0),
        getDuplicateClient: jest.fn().mockReturnValue({
            subscribe: jest.fn(),
            on: jest.fn(),
        }),
        connected: true,
        on: jest.fn(),
        // Required 메서드 (보안 필수)
        setRequired: jest.fn(async (key: string, value: string) => {
            mockRedisStore.set(key, value)
        }),
        getRequired: jest.fn(async (key: string) => mockRedisStore.get(key) ?? null),
        deleteRequired: jest.fn(async (key: string) => mockRedisStore.delete(key)),
        getAndDeleteRequired: jest.fn(async (key: string) => {
            const value = mockRedisStore.get(key) ?? null
            mockRedisStore.delete(key)
            return value
        }),
        incrementRequired: jest.fn(async (key: string) => {
            const current = parseInt(mockRedisStore.get(key) ?? "0")
            const next = current + 1
            mockRedisStore.set(key, next.toString())
            return next
        }),
        incrWithExpire: jest.fn(async (key: string, _ttlSeconds: number) => {
            const current = parseInt(mockRedisStore.get(key) ?? "0")
            const next = current + 1
            mockRedisStore.set(key, next.toString())
            return next
        }),
        existsRequired: jest.fn(async (key: string) => mockRedisStore.has(key)),
        acquireLock: jest.fn(async () => jest.fn()),
        isAvailable: jest.fn().mockReturnValue(true),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    container.registerInstance("IRedisService", mockRedis as any)

    // 로거 모킹 (테스트 콘솔 노이즈 제거)
    const mockLogger: ILogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    }
    container.registerInstance("ILogger", mockLogger)

    // 4. 앱 생성
    const { app } = await createApp()
    return app
}

/** 모든 테이블 TRUNCATE CASCADE — FK 순서 무관, 시퀀스 리셋 */
export async function truncateAllTables(): Promise<void> {
    const entities = AppDataSource.entityMetadatas
    const tableNames = entities.map((e) => `"${e.tableName}"`).join(", ")
    if (tableNames) {
        await AppDataSource.query(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`)
    }
}

/**
 * 테스트용 DB 정리
 */
export async function cleanupDatabase(): Promise<void> {
    if (AppDataSource.isInitialized) {
        await AppDataSource.destroy()
    }
}
