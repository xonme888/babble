import "reflect-metadata"
import path from "path"
import { DataSource, type LoggerOptions } from "typeorm"
import { addTransactionalDataSource, initializeTransactionalContext } from "typeorm-transactional"

// CLI(migration:run 등)에서 이 파일만 직접 로드할 때도 동작하도록 보장
initializeTransactionalContext()
import { User } from "@features/user/domain/user.entity"
import { Assessment } from "@features/assessment/domain/assessment.entity"
import { AssessmentAnalysisLog } from "@features/assessment/domain/assessment-analysis-log.entity"
import { Script } from "@features/script/domain/script.entity"
import { Chapter } from "@features/script/domain/chapter.entity"
import { UserGoalLog } from "@features/user/domain/user-goal-log.entity"
import { NotificationLog } from "@features/notification/domain/notification-log.entity"
import { ContentVersion } from "@features/script/domain/content-version.entity"
import { LearningRecord } from "@features/learning/domain/learning-record.entity"
import { DailyGoalLog } from "@features/learning/domain/daily-goal-log.entity"
import { GameSession } from "@features/game/domain/game-session.entity"
import { DailyChallenge } from "@features/game/domain/daily-challenge.entity"
import { ChallengeParticipation } from "@features/game/domain/challenge-participation.entity"
import { GameScriptCompletion } from "@features/game/domain/game-script-completion.entity"
import { GameWordResult } from "@features/game/domain/game-word-result.entity"
import { XpTransaction } from "@features/gamification/domain/xp-transaction.entity"
import { UserLevel } from "@features/gamification/domain/user-level.entity"
import { Badge } from "@features/gamification/domain/badge.entity"
import { UserBadge } from "@features/gamification/domain/user-badge.entity"
import { GameConfig } from "@features/gamification/domain/game-config.entity"
import { GameConfigHistory } from "@features/gamification/domain/game-config-history.entity"
import { configurations } from "@shared/infra/config/configurations"
import { TypeOrmPinoLogger } from "@shared/infra/logging/typeorm-logger"

const dbConfig = configurations().database

// 개발: 전체 쿼리 로깅, 프로덕션: 에러+슬로우쿼리+스키마+마이그레이션만
const loggingOption: LoggerOptions = (dbConfig.logging || process.env.NODE_ENV === "development")
    ? "all"
    : ["error", "warn", "migration", "schema", "query-slow"] as LoggerOptions

export const AppDataSource = addTransactionalDataSource(
    new DataSource({
        type: "postgres",
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
        synchronize: false,
        migrationsRun: true,
        logging: loggingOption,
        logger: new TypeOrmPinoLogger(),
        maxQueryExecutionTime: dbConfig.maxQueryExecutionTime > 0
            ? dbConfig.maxQueryExecutionTime
            : undefined,
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
            DailyChallenge,
            ChallengeParticipation,
            GameScriptCompletion,
            GameWordResult,
            XpTransaction,
            UserLevel,
            Badge,
            UserBadge,
            GameConfig,
            GameConfigHistory,
        ],
        migrations: [path.join(__dirname, "migrations", "*.{ts,js}")],
        subscribers: [],
        extra: {
            min: dbConfig.pool?.min ?? 2,
            max: dbConfig.pool?.max ?? 20,
            idleTimeoutMillis: dbConfig.pool?.idleTimeoutMillis ?? 30000,
        },
    })
)
