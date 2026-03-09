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
import { PhonemeScore } from "@features/phoneme/domain/phoneme-score.entity"
import { PronunciationErrorPattern } from "@features/phoneme/domain/pronunciation-error-pattern.entity"
import { UserErrorPattern } from "@features/phoneme/domain/user-error-pattern.entity"
import { MinimalPair } from "@features/phoneme/domain/minimal-pair.entity"
import { DiscriminationSession } from "@features/phoneme/domain/discrimination-session.entity"
import { SRSItem } from "@features/srs/domain/srs-item.entity"
import { DeviceToken } from "@features/notification/domain/device-token.entity"
import { NotificationPreference } from "@features/notification/domain/notification-preference.entity"
import { WeeklyReport } from "@features/weekly-report/domain/weekly-report.entity"
import { Scenario } from "@features/scenario/domain/scenario.entity"
import { DialogueLine } from "@features/scenario/domain/dialogue-line.entity"
import { ScenarioSession } from "@features/scenario/domain/scenario-session.entity"
import { ScenarioLineResult } from "@features/scenario/domain/scenario-line-result.entity"
import { BreathingExercise } from "@features/therapy/domain/breathing-exercise.entity"
import { TherapyProgress } from "@features/therapy/domain/therapy-progress.entity"
import { TherapySession } from "@features/therapy/domain/therapy-session.entity"
import { TherapistClient } from "@features/therapy/domain/therapist-client.entity"
import { TherapistAssignment } from "@features/therapy/domain/therapist-assignment.entity"
import { OralMotorExercise } from "@features/therapy/domain/oral-motor-exercise.entity"
import { ClinicalNorm } from "@features/therapy/domain/clinical-norm.entity"
import { PhaseProgressionRule } from "@features/therapy/domain/phase-progression-rule.entity"
import { ExportAuditLog } from "@features/research/domain/export-audit-log.entity"
import { VoiceDiary } from "@features/voice-diary/domain/voice-diary.entity"
import { DifficultyProfile } from "@features/difficulty/domain/difficulty-profile.entity"
import { DifficultyDecision } from "@features/difficulty/domain/difficulty-decision.entity"
import { FamilyLink } from "@features/family/domain/family-link.entity"
import { configurations } from "@shared/infra/config/configurations"
import { TypeOrmPinoLogger } from "@shared/infra/logging/typeorm-logger"
import { SnakeNamingStrategy } from "./snake-naming-strategy"

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
        namingStrategy: new SnakeNamingStrategy(),
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
            PhonemeScore,
            PronunciationErrorPattern,
            UserErrorPattern,
            MinimalPair,
            DiscriminationSession,
            SRSItem,
            DeviceToken,
            NotificationPreference,
            WeeklyReport,
            Scenario,
            DialogueLine,
            ScenarioSession,
            ScenarioLineResult,
            BreathingExercise,
            TherapyProgress,
            TherapySession,
            TherapistClient,
            TherapistAssignment,
            OralMotorExercise,
            ClinicalNorm,
            PhaseProgressionRule,
            ExportAuditLog,
            VoiceDiary,
            DifficultyProfile,
            DifficultyDecision,
            FamilyLink,
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
