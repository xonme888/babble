/**
 * 타입 안전 Mock 팩토리 모듈
 *
 * Unit 테스트에서 `as any` 캐스팅 없이 의존성 mock을 생성한다.
 * 생성자 시그니처 변경 시 컴파일 에러가 발생하여 런타임 실패를 방지한다.
 */
import type { IRedisService } from "@shared/core/redis-service.interface"
import type { ILogger } from "@shared/core/logger.interface"
import type { ITokenProvider } from "@features/auth/domain/token-provider.interface"
import type { IPasswordHasher } from "@shared/core/password-hasher.interface"
import type { TokenRotationService } from "@features/auth/application/token-rotation.service"
import type { IDomainEventDispatcher } from "@shared/core/domain-event-dispatcher.interface"
import type { UserRepository } from "@features/user/infrastructure/user.repository"
import type { AssessmentRepository } from "@features/assessment/infrastructure/assessment.repository"
import type { ScriptRepository } from "@features/script/infrastructure/script.repository"
import type { NotificationService } from "@features/notification/application/notification.service"
import type { ConfigService } from "@shared/infra/config/config.service"
import type { LoginStrategyFactory } from "@features/auth/application/login-strategy.factory"
import type { ILoginStrategy } from "@features/auth/application/login-strategy.interface"
import type { EventDispatcher } from "@shared/lib/events/event-dispatcher"
import type { ScriptService } from "@features/script/application/script.service"
import type { AssessmentAnalysisService } from "@features/assessment/application/assessment-analysis.service"
import type { AnalysisResultProcessor } from "@features/assessment/application/analysis-result-processor"
import type { ChapterProgressService } from "@features/script/application/chapter-progress.service"
import type { ContentVersionService } from "@features/script/application/content-version.service"
import type { GamificationService } from "@features/gamification/application/gamification.service"
import type { LearningRecordService } from "@features/learning/application/learning-record.service"
import type { UserStatsService } from "@features/user/application/user-stats.service"
import type { GameConfigRepository } from "@features/gamification/infrastructure/game-config.repository"
import type { GameConfigService } from "@features/gamification/application/game-config.service"
import type { GameScriptCompletionRepository } from "@features/game/infrastructure/game-script-completion.repository"
import type { GameWordResultRepository } from "@features/game/infrastructure/game-word-result.repository"
import type { GameXpCalculator } from "@features/game/domain/game-xp-calculator"
import type { GameScriptSelector } from "@features/script/application/game-script-selector"
import type { XpService } from "@features/gamification/application/xp.service"
import type { XpTransactionRepository } from "@features/gamification/infrastructure/xp-transaction.repository"
import type { LearningRecordRepository } from "@features/learning/infrastructure/learning-record.repository"
import type { DailyGoalLogRepository } from "@features/learning/infrastructure/daily-goal-log.repository"
import type { GameSessionRepository } from "@features/game/infrastructure/game-session.repository"
import type { CompletionProcessor } from "@features/game/application/completion-processor"
import type { BadgeConditionEvaluator } from "@features/gamification/domain/badge-condition-evaluator"
import type { ChapterUnlockPolicy } from "@features/script/domain/chapter-unlock-policy"
import type { StreakCalculator } from "@features/learning/domain/streak-calculator"
import type { Assessment, AssessmentStatus } from "@features/assessment/domain/assessment.entity"
import type { IAnalysisQueue } from "@shared/core/queue.interface"
import type { IEmailQueue, IPushQueue } from "@shared/core/queue.interface"
import type { IConfigService } from "@shared/core/config.interface"
import type { DataSource, Repository } from "typeorm"
import type { VerificationService } from "@features/auth/application/verification.service"
import type { PasswordResetService } from "@features/auth/application/password-reset.service"
import type { DailyChallengeRepository } from "@features/game/infrastructure/daily-challenge.repository"
import type { ChallengeParticipationRepository } from "@features/game/infrastructure/challenge-participation.repository"
import type { SkillProfileCalculator } from "@features/difficulty/domain/skill-profile-calculator"
import type { SkillProfileService } from "@features/difficulty/application/skill-profile.service"
import type { PronunciationErrorPatternRepository } from "@features/phoneme/infrastructure/pronunciation-error-pattern.repository"
import type { UserErrorPatternRepository } from "@features/phoneme/infrastructure/user-error-pattern.repository"
import type { PhonemeScoreRepository } from "@features/phoneme/infrastructure/phoneme-score.repository"
import type { MinimalPairRepository } from "@features/phoneme/infrastructure/minimal-pair.repository"
import type { MinimalPairService } from "@features/phoneme/application/minimal-pair.service"
import type { SRSItemRepository } from "@features/srs/infrastructure/srs-item.repository"
import type { SrsService } from "@features/srs/application/srs.service"
import type { ISrsProvider } from "@features/srs/domain/srs-provider.interface"
import type { PhonemeScoreService } from "@features/phoneme/application/phoneme-score.service"
import type { DeviceTokenRepository } from "@features/notification/infrastructure/device-token.repository"
import type { NotificationPreferenceRepository } from "@features/notification/infrastructure/notification-preference.repository"
import type { DeviceTokenService } from "@features/notification/application/device-token.service"
import type { NotificationPreferenceService } from "@features/notification/application/notification-preference.service"
import type { PushNotificationService } from "@features/notification/application/push-notification.service"
import type { IPushNotificationSender } from "@features/notification/domain/push-notification-sender.interface"
import type { IDeviceTokenReader } from "@features/notification/domain/device-token-reader.interface"
import type { WeeklyReportRepository } from "@features/weekly-report/infrastructure/weekly-report.repository"
import type { WeeklyReportService } from "@features/weekly-report/application/weekly-report.service"
import type { ScenarioRepository } from "@features/scenario/infrastructure/scenario.repository"
import type { DialogueLineRepository } from "@features/scenario/infrastructure/dialogue-line.repository"
import type { ScenarioSessionRepository } from "@features/scenario/infrastructure/scenario-session.repository"
import type { ScenarioLineResultRepository } from "@features/scenario/infrastructure/scenario-line-result.repository"
import type { ScenarioAdminService } from "@features/scenario/application/scenario-admin.service"
import type { ScenarioService } from "@features/scenario/application/scenario.service"
import type { BreathingExerciseRepository } from "@features/therapy/infrastructure/breathing-exercise.repository"
import type { TherapyProgressRepository } from "@features/therapy/infrastructure/therapy-progress.repository"
import type { TherapySessionRepository } from "@features/therapy/infrastructure/therapy-session.repository"
import type { TherapyService } from "@features/therapy/application/therapy.service"
import type { TherapistClientRepository } from "@features/therapy/infrastructure/therapist-client.repository"
import type { TherapistAssignmentRepository } from "@features/therapy/infrastructure/therapist-assignment.repository"
import type { SlpDashboardService } from "@features/therapy/application/slp-dashboard.service"
import type { IPhonemeScoreReader } from "@features/phoneme/domain/phoneme-score-reader.interface"
import type { IConsecutiveErrorTracker } from "@features/therapy/domain/consecutive-error-tracker.interface"
import type { OralMotorExerciseRepository } from "@features/therapy/infrastructure/oral-motor-exercise.repository"
import type { ClinicalNormRepository } from "@features/therapy/infrastructure/clinical-norm.repository"
import type { PhaseProgressionRuleRepository } from "@features/therapy/infrastructure/phase-progression-rule.repository"
import type { IAssessmentStatsProvider } from "@features/assessment/domain/assessment-stats-provider.interface"
import type { TherapyRecommendationService } from "@features/therapy/application/therapy-recommendation.service"

/** IRedisService mock — graceful + required 메서드 전체 */
export function createMockRedisService(
    overrides?: Partial<jest.Mocked<IRedisService>>
): jest.Mocked<IRedisService> {
    return {
        set: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
        ttl: jest.fn(),
        increment: jest.fn(),
        exists: jest.fn(),
        rpush: jest.fn(),
        blpop: jest.fn().mockResolvedValue(null),
        lpop: jest.fn(),
        llen: jest.fn(),
        publish: jest.fn().mockResolvedValue(0),
        getDuplicateClient: jest.fn(),
        setRequired: jest.fn(),
        getRequired: jest.fn(),
        deleteRequired: jest.fn(),
        getAndDeleteRequired: jest.fn(),
        incrementRequired: jest.fn(),
        incrWithExpire: jest.fn(),
        existsRequired: jest.fn(),
        isAvailable: jest.fn().mockReturnValue(true),
        ping: jest.fn().mockResolvedValue("PONG"),
        acquireLock: jest.fn().mockResolvedValue(jest.fn()),
        ...overrides,
    }
}

/** ILogger mock — 콘솔 출력 억제 */
export function createMockLogger(overrides?: Partial<jest.Mocked<ILogger>>): jest.Mocked<ILogger> {
    return {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        ...overrides,
    }
}

/** ITokenProvider mock — JWT 토큰 생성/검증 */
export function createMockTokenProvider(
    overrides?: Partial<jest.Mocked<ITokenProvider>>
): jest.Mocked<ITokenProvider> {
    return {
        generateAccessToken: jest.fn(),
        generateRefreshToken: jest.fn(),
        verifyToken: jest.fn(),
        ...overrides,
    }
}

/** IPasswordHasher mock — 기본값: hash → '$2a$10$hashedpassword', compare → true */
export function createMockPasswordHasher(
    overrides?: Partial<jest.Mocked<IPasswordHasher>>
): jest.Mocked<IPasswordHasher> {
    return {
        hash: jest.fn().mockResolvedValue("$2a$10$hashedpassword"),
        compare: jest.fn().mockResolvedValue(true),
        ...overrides,
    }
}

/** IDomainEventDispatcher mock — 도메인 이벤트 디스패처 인터페이스 */
export function createMockDomainEventDispatcher(
    overrides?: Partial<jest.Mocked<IDomainEventDispatcher>>
): jest.Mocked<IDomainEventDispatcher> {
    return {
        register: jest.fn(),
        dispatch: jest.fn(),
        dispatchAll: jest.fn(),
        dispatchAsync: jest.fn(),
        publishFromAggregate: jest.fn(),
        ...overrides,
    }
}

/** EventDispatcher mock — 구현 클래스 (dispatch, publishFromAggregate 등) */
export function createMockEventDispatcher(
    overrides?: Partial<jest.Mocked<EventDispatcher>>
): jest.Mocked<EventDispatcher> {
    return {
        register: jest.fn(),
        dispatch: jest.fn(),
        dispatchAsync: jest.fn(),
        dispatchAll: jest.fn(),
        dispatchAllAsync: jest.fn(),
        publishFromAggregate: jest.fn(),
        ...overrides,
    } as jest.Mocked<EventDispatcher>
}

/** UserRepository mock — 전체 public 메서드 */
export function createMockUserRepository(
    overrides?: Partial<jest.Mocked<UserRepository>>
): jest.Mocked<UserRepository> {
    return {
        save: jest.fn(),
        saveAll: jest.fn().mockImplementation(async (users) => users),
        findById: jest.fn(),
        findByIds: jest.fn().mockResolvedValue([]),
        findByIdOrThrow: jest.fn(),
        findByEmail: jest.fn(),
        findByEmailWithPassword: jest.fn(),
        findAll: jest.fn(),
        delete: jest.fn(),
        existsByEmail: jest.fn(),
        countActive: jest.fn(),
        findGuestByDeviceId: jest.fn(),
        findUpgradedUserByDeviceId: jest.fn(),
        findInactiveGuests: jest.fn(),
        findNoConsentGuests: jest.fn(),
        softDelete: jest.fn(),
        softDeleteBatch: jest.fn(),
        hardDelete: jest.fn(),
        hardDeleteBatch: jest.fn(),
        mergeGuestData: jest.fn(),
        ...overrides,
    } as jest.Mocked<UserRepository>
}

/** AssessmentRepository mock — 전체 public 메서드 */
export function createMockAssessmentRepository(
    overrides?: Partial<jest.Mocked<AssessmentRepository>>
): jest.Mocked<AssessmentRepository> {
    return {
        save: jest.fn(),
        saveAll: jest.fn().mockImplementation(async (assessments) => assessments),
        findById: jest.fn(),
        findByIdLight: jest.fn(),
        findByIdOrThrow: jest.fn(),
        findByIdLightOrThrow: jest.fn(),
        findByUserId: jest.fn(),
        findAll: jest.fn(),
        getStatsByUserId: jest.fn(),
        getAssessmentDates: jest.fn(),
        hasScoreAbove: jest.fn(),
        getTodayCompletedCount: jest.fn(),
        getWeeklyActivity: jest.fn(),
        getScriptProgress: jest.fn().mockResolvedValue({
            completedScriptIds: [],
            bestScores: {},
            lastPracticedAt: {},
        }),
        findTodayCompletedByUser: jest.fn().mockResolvedValue([]),
        findStuckAssessments: jest.fn().mockResolvedValue([]),
        getScoresByArticulationPlace: jest.fn().mockResolvedValue([]),
        getScoreTrends: jest.fn().mockResolvedValue([]),
        ...overrides,
    } as jest.Mocked<AssessmentRepository>
}

/** ScriptRepository mock — Script + Chapter 메서드 */
export function createMockScriptRepository(
    overrides?: Partial<jest.Mocked<ScriptRepository>>
): jest.Mocked<ScriptRepository> {
    return {
        save: jest.fn(),
        findById: jest.fn(),
        findByIdOrThrow: jest.fn(),
        findByIdIncludeDeleted: jest.fn(),
        findAll: jest.fn(),
        findRandom: jest.fn(),
        findRandomByChapterIds: jest.fn().mockResolvedValue([]),
        findByIds: jest.fn().mockResolvedValue([]),
        getScript: jest.fn(),
        delete: jest.fn(),
        saveAll: jest.fn().mockImplementation(async (scripts) => scripts),
        saveChapter: jest.fn(),
        findChapterById: jest.fn(),
        findChapterByIdOrThrow: jest.fn(),
        findChapterByIdIncludeDeleted: jest.fn(),
        findAllChapters: jest.fn(),
        deleteChapter: jest.fn(),
        ...overrides,
    } as jest.Mocked<ScriptRepository>
}

/** NotificationService mock */
export function createMockNotificationService(
    overrides?: Partial<jest.Mocked<NotificationService>>
): jest.Mocked<NotificationService> {
    return {
        send: jest.fn(),
        ...overrides,
    } as jest.Mocked<NotificationService>
}

/** ConfigService mock — 기본 auth 설정 포함 */
export function createMockConfigService(
    overrides?: Partial<jest.Mocked<ConfigService>>
): jest.Mocked<ConfigService> {
    return {
        config: {
            auth: {
                verificationCodeTTL: 600,
                resetCodeTTL: 600,
                refreshTokenTTL: 604800,
                refreshTokenMaxAge: 604800000,
            },
        },
        ...overrides,
    } as jest.Mocked<ConfigService>
}

/** LoginStrategyFactory mock — 선택적으로 기본 전략을 주입 */
export function createMockLoginStrategyFactory(
    mockStrategy?: jest.Mocked<ILoginStrategy>
): jest.Mocked<LoginStrategyFactory> {
    return {
        registerStrategy: jest.fn(),
        getStrategy: jest.fn().mockReturnValue(mockStrategy ?? createMockLoginStrategy()),
        getAvailableStrategies: jest.fn(),
    } as unknown as jest.Mocked<LoginStrategyFactory>
}

/** ILoginStrategy mock */
export function createMockLoginStrategy(
    overrides?: Partial<jest.Mocked<ILoginStrategy>>
): jest.Mocked<ILoginStrategy> {
    return {
        getName: jest.fn(),
        login: jest.fn(),
        ...overrides,
    }
}

/** ScriptService mock — 컨트롤러 테스트용 */
export function createMockScriptService(
    overrides?: Partial<jest.Mocked<ScriptService>>
): jest.Mocked<ScriptService> {
    return {
        createScript: jest.fn(),
        getScript: jest.fn(),
        getScripts: jest.fn(),
        getRandomScripts: jest.fn(),
        findRandomUnlockedScripts: jest.fn(),
        getNextScriptForUser: jest.fn(),
        findUnlockedScriptsForGame: jest.fn(),
        selectTodayGameScripts: jest.fn().mockResolvedValue([]),
        updateScript: jest.fn(),
        deleteScript: jest.fn(),
        restoreScript: jest.fn(),
        createChapter: jest.fn(),
        getChapter: jest.fn(),
        getChapters: jest.fn(),
        updateChapter: jest.fn(),
        deleteChapter: jest.fn(),
        restoreChapter: jest.fn(),
        getContentVersion: jest.fn(),
        ...overrides,
    } as jest.Mocked<ScriptService>
}

/** ContentVersionService mock */
export function createMockContentVersionService(
    overrides?: Partial<jest.Mocked<ContentVersionService>>
): jest.Mocked<ContentVersionService> {
    return {
        createVersion: jest.fn(),
        getLatestVersion: jest.fn(),
        ...overrides,
    } as jest.Mocked<ContentVersionService>
}

/** GamificationService mock */
export function createMockGamificationService(
    overrides?: Partial<jest.Mocked<GamificationService>>
): jest.Mocked<GamificationService> {
    return {
        getProfile: jest.fn(),
        getBadgesRaw: jest.fn().mockResolvedValue({ allBadges: [], unlockedBadges: [] }),
        getLeaderboard: jest.fn(),
        getAchievements: jest.fn().mockResolvedValue([]),
        ...overrides,
    } as jest.Mocked<GamificationService>
}

/** LearningRecordService mock */
export function createMockLearningRecordService(
    overrides?: Partial<jest.Mocked<LearningRecordService>>
): jest.Mocked<LearningRecordService> {
    return {
        recordActivity: jest.fn(),
        getStreak: jest.fn().mockResolvedValue({ currentStreak: 0, longestStreak: 0 }),
        getDailyGoal: jest
            .fn()
            .mockResolvedValue({ completedCount: 0, dailyGoalTarget: 3, isGoalAchieved: false }),
        isOvertime: jest.fn().mockResolvedValue(false),
        hasActivityOnDate: jest.fn().mockResolvedValue(false),
        getUserIdsWithActivityOnDate: jest.fn().mockResolvedValue(new Set()),
        ...overrides,
    } as jest.Mocked<LearningRecordService>
}

/** UserStatsService mock — 사용자 통계 집계 서비스 */
export function createMockUserStatsService(
    overrides?: Partial<jest.Mocked<UserStatsService>>
): jest.Mocked<UserStatsService> {
    return {
        getStats: jest.fn().mockResolvedValue({
            userId: 1,
            user: {},
            stats: { totalLessons: 0, completedLessons: 0, averageScore: 0, totalPracticeSeconds: 0 },
            todayCompleted: 0,
            weeklyData: [],
            streaks: { currentStreak: 0, longestStreak: 0 },
            dailyGoal: { completedCount: 0, dailyGoalTarget: 3, isGoalAchieved: false },
        }),
        getScriptProgress: jest.fn().mockResolvedValue({ completedScriptIds: [], bestScores: {} }),
        ...overrides,
    } as jest.Mocked<UserStatsService>
}

/** ChapterProgressService mock — 챕터 해금 서비스 */
export function createMockChapterProgressService(
    overrides?: Partial<jest.Mocked<ChapterProgressService>>
): jest.Mocked<ChapterProgressService> {
    return {
        getUnlockedChapterIds: jest.fn().mockResolvedValue([]),
        isChapterUnlocked: jest.fn().mockResolvedValue(true),
        isScriptUnlocked: jest.fn().mockResolvedValue(true),
        getNextScriptWithProgress: jest.fn().mockResolvedValue(null),
        getOverallProgress: jest.fn().mockResolvedValue({ completedChapters: 0, totalChapters: 0 }),
        getBundlesForChapter: jest.fn().mockResolvedValue([]),
        checkBundleCompletion: jest.fn().mockResolvedValue({
            bundleCompleted: false,
            bundleIndex: 0,
            chapterCompleted: false,
            nextBundleUnlocked: false,
            nextChapterUnlocked: false,
        }),
        getChaptersWithBundles: jest.fn().mockResolvedValue([]),
        getBundleSize: jest.fn().mockReturnValue(5),
        invalidateChaptersCache: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    } as jest.Mocked<ChapterProgressService>
}

/** AssessmentAnalysisService mock */
export function createMockAssessmentAnalysisService(
    overrides?: Partial<jest.Mocked<AssessmentAnalysisService>>
): jest.Mocked<AssessmentAnalysisService> {
    return {
        analyzeAssessment: jest.fn(),
        ...overrides,
    } as jest.Mocked<AssessmentAnalysisService>
}

/** AnalysisResultProcessor mock — 분석 결과 처리기 */
export function createMockAnalysisResultProcessor(
    overrides?: Partial<jest.Mocked<AnalysisResultProcessor>>
): jest.Mocked<AnalysisResultProcessor> {
    return {
        process: jest.fn(),
        ...overrides,
    } as jest.Mocked<AnalysisResultProcessor>
}

/** IAnalysisQueue mock — AI 분석 큐 Port */
export function createMockAnalysisQueue(
    overrides?: Partial<jest.Mocked<IAnalysisQueue>>
): jest.Mocked<IAnalysisQueue> {
    return {
        enqueue: jest.fn(),
        ...overrides,
    }
}

/** IEmailQueue mock — 이메일 큐 Port */
export function createMockEmailQueue(
    overrides?: Partial<jest.Mocked<IEmailQueue>>
): jest.Mocked<IEmailQueue> {
    return {
        enqueue: jest.fn(),
        ...overrides,
    }
}

/** IPushQueue mock */
export function createMockPushQueue(
    overrides?: Partial<jest.Mocked<IPushQueue>>
): jest.Mocked<IPushQueue> {
    return {
        enqueue: jest.fn(),
        enqueueBatch: jest.fn(),
        ...overrides,
    }
}

/** IConfigService mock — ConfigService Port */
export function createMockIConfigService(
    overrides?: Partial<jest.Mocked<IConfigService>>
): jest.Mocked<IConfigService> {
    return {
        config: {
            auth: {
                verificationCodeTTL: 600,
                resetCodeTTL: 600,
                refreshTokenTTL: 604800,
                refreshTokenMaxAge: 604800000,
            },
        },
        ...overrides,
    } as jest.Mocked<IConfigService>
}

/** GameConfigRepository mock */
export function createMockGameConfigRepository(
    overrides?: Partial<jest.Mocked<GameConfigRepository>>
): jest.Mocked<GameConfigRepository> {
    return {
        findAll: jest.fn().mockResolvedValue([]),
        findByKey: jest.fn().mockResolvedValue(null),
        findByKeyOrThrow: jest.fn(),
        findByCategory: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation(async (c) => c),
        update: jest.fn(),
        saveHistory: jest.fn().mockImplementation(async (h) => h),
        findHistoryByKey: jest.fn().mockResolvedValue([]),
        ...overrides,
    } as jest.Mocked<GameConfigRepository>
}

/** GameConfigService mock */
export function createMockGameConfigService(
    overrides?: Partial<jest.Mocked<GameConfigService>>
): jest.Mocked<GameConfigService> {
    return {
        loadAll: jest.fn(),
        get: jest.fn().mockReturnValue(null),
        getByCategory: jest.fn().mockReturnValue({}),
        getConfigVersion: jest.fn().mockReturnValue("abc123"),
        update: jest.fn(),
        getAll: jest.fn().mockResolvedValue([]),
        getHistory: jest.fn().mockResolvedValue([]),
        ...overrides,
    } as jest.Mocked<GameConfigService>
}

/** GameScriptCompletionRepository mock */
export function createMockGameScriptCompletionRepository(
    overrides?: Partial<jest.Mocked<GameScriptCompletionRepository>>
): jest.Mocked<GameScriptCompletionRepository> {
    return {
        findByUserAndScript: jest.fn().mockResolvedValue(null),
        findByUserAndScripts: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation(async (c) => c),
        saveAll: jest.fn().mockImplementation(async (completions) => completions),
        findWeakScripts: jest.fn().mockResolvedValue([]),
        ...overrides,
    } as jest.Mocked<GameScriptCompletionRepository>
}

/** GameWordResultRepository mock */
export function createMockGameWordResultRepository(
    overrides?: Partial<jest.Mocked<GameWordResultRepository>>
): jest.Mocked<GameWordResultRepository> {
    return {
        saveBatch: jest.fn().mockImplementation(async (r) => r),
        findMostMissedWords: jest.fn().mockResolvedValue([]),
        findMostMissedWordsBatch: jest.fn().mockResolvedValue(new Map()),
        ...overrides,
    } as jest.Mocked<GameWordResultRepository>
}

/** GameXpCalculator mock */
export function createMockGameXpCalculator(
    overrides?: Partial<jest.Mocked<GameXpCalculator>>
): jest.Mocked<GameXpCalculator> {
    return {
        calculate: jest.fn().mockReturnValue({
            scripts: [],
            rawTotal: 0,
            sessionCap: 60,
            cappedTotal: 0,
            overtimeMultiplier: 1,
            finalXp: 0,
        }),
        ...overrides,
    } as jest.Mocked<GameXpCalculator>
}

/** GameScriptSelector mock — 게임 스크립트 선택 오케스트레이션 */
export function createMockGameScriptSelector(
    overrides?: Partial<jest.Mocked<GameScriptSelector>>
): jest.Mocked<GameScriptSelector> {
    return {
        selectScripts: jest.fn().mockResolvedValue([]),
        ...overrides,
    } as jest.Mocked<GameScriptSelector>
}

/** XpService mock */
export function createMockXpService(
    overrides?: Partial<jest.Mocked<XpService>>
): jest.Mocked<XpService> {
    return {
        awardXp: jest.fn(),
        getWeeklyXp: jest.fn().mockResolvedValue(0),
        ...overrides,
    } as jest.Mocked<XpService>
}

/** GameSessionRepository mock */
export function createMockGameSessionRepository(
    overrides?: Partial<jest.Mocked<GameSessionRepository>>
): jest.Mocked<GameSessionRepository> {
    return {
        save: jest.fn().mockImplementation(async (s) => ({ ...s, id: s.id ?? 1 })),
        findById: jest.fn().mockResolvedValue(null),
        findByUserId: jest.fn().mockResolvedValue({ items: [], total: 0 }),
        ...overrides,
    } as jest.Mocked<GameSessionRepository>
}

/** TypeORM DataSource mock — getRepository 지원 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockDataSource<T extends Record<string, any>>(
    mockRepository?: jest.Mocked<Repository<T>>
): jest.Mocked<DataSource> {
    return {
        getRepository: jest.fn().mockReturnValue(mockRepository ?? {}),
    } as unknown as jest.Mocked<DataSource>
}

/** ConfigService mock — googleMail 설정 포함 (Nodemailer 테스트용) */
export function createMockConfigServiceWithMail(
    overrides?: {
        user?: string
        password?: string
    }
): jest.Mocked<ConfigService> {
    const hasUser = overrides !== undefined && "user" in overrides
    const hasPassword = overrides !== undefined && "password" in overrides
    return {
        config: {
            googleMail: {
                user: hasUser ? overrides.user : "test@gmail.com",
                password: hasPassword ? overrides.password : "password123",
            },
        },
    } as jest.Mocked<ConfigService>
}

/** CompletionProcessor mock -- 완료 처리기 */
export function createMockCompletionProcessor(
    overrides?: Partial<jest.Mocked<CompletionProcessor>>
): jest.Mocked<CompletionProcessor> {
    return {
        saveWordResults: jest.fn(),
        upsertCompletions: jest.fn().mockResolvedValue(new Map()),
        ...overrides,
    } as jest.Mocked<CompletionProcessor>
}

/** Assessment 테스트 엔티티 생성 팩토리 */
export function createTestAssessment(
    overrides?: Partial<{
        id: number
        audioUrl: string
        status: AssessmentStatus
        retryCount: number
        scriptSnapshotContent: string
        assessmentType: string
    }>
): Assessment {
    // 동적 import 없이 런타임에 Assessment 인스턴스 구성
    const { Assessment: AssessmentClass, AssessmentStatus: Status } =
        require("@features/assessment/domain/assessment.entity")
    const { AssessmentType } = require("@shared/core/constants/api-contract")
    const assessment = new AssessmentClass()
    assessment.id = overrides?.id ?? 1
    assessment.audioUrl = overrides?.audioUrl ?? "test.wav"
    assessment.status = overrides?.status ?? Status.PENDING
    assessment.retryCount = overrides?.retryCount ?? 0
    assessment.origin = "MOBILE"
    assessment.referenceText = null
    assessment.assessmentType = overrides?.assessmentType ?? AssessmentType.SCRIPT_READING
    if (overrides?.scriptSnapshotContent !== undefined) {
        assessment.scriptSnapshot = { content: overrides.scriptSnapshotContent }
    }
    return assessment
}

/** BadgeConditionEvaluator mock — 뱃지 조건 평가 도메인 서비스 */
export function createMockBadgeConditionEvaluator(
    overrides?: Partial<jest.Mocked<BadgeConditionEvaluator>>
): jest.Mocked<BadgeConditionEvaluator> {
    return {
        evaluate: jest.fn().mockReturnValue(false),
        ...overrides,
    } as jest.Mocked<BadgeConditionEvaluator>
}

/** ChapterUnlockPolicy mock — 챕터/번들 해금 도메인 서비스 */
export function createMockChapterUnlockPolicy(
    overrides?: Partial<jest.Mocked<ChapterUnlockPolicy>>
): jest.Mocked<ChapterUnlockPolicy> {
    return {
        getActiveScripts: jest.fn().mockReturnValue([]),
        computeUnlockedChapterIds: jest.fn().mockReturnValue([]),
        countCompletedChapters: jest.fn().mockReturnValue(0),
        computeBundles: jest.fn().mockReturnValue([]),
        findNextScript: jest.fn().mockReturnValue(null),
        toBundleScriptInfos: jest.fn().mockReturnValue([]),
        ...overrides,
    } as jest.Mocked<ChapterUnlockPolicy>
}

/** StreakCalculator mock — 스트릭 계산 도메인 서비스 */
export function createMockStreakCalculator(
    overrides?: Partial<jest.Mocked<StreakCalculator>>
): jest.Mocked<StreakCalculator> {
    return {
        calculate: jest.fn().mockReturnValue({ currentStreak: 0, longestStreak: 0 }),
        ...overrides,
    } as jest.Mocked<StreakCalculator>
}

/** TokenRotationService mock — 토큰 갱신/로그아웃 서비스 */
export function createMockTokenRotationService(
    overrides?: Partial<jest.Mocked<TokenRotationService>>
): jest.Mocked<TokenRotationService> {
    return {
        refresh: jest.fn().mockResolvedValue({ accessToken: "mock-access", refreshToken: "mock-refresh" }),
        revoke: jest.fn(),
        revokeAll: jest.fn(),
        clearAllClientTokens: jest.fn(),
        ...overrides,
    } as jest.Mocked<TokenRotationService>
}

/** VerificationService mock — 이메일 인증 서비스 */
export function createMockVerificationService(
    overrides?: Partial<jest.Mocked<VerificationService>>
): jest.Mocked<VerificationService> {
    return {
        verifyEmail: jest.fn().mockResolvedValue({ success: true, message: "auth.email_verified_success" }),
        resendVerificationCode: jest.fn(),
        sendVerificationEmail: jest.fn(),
        ...overrides,
    } as jest.Mocked<VerificationService>
}

/** PasswordResetService mock — 비밀번호 재설정 서비스 */
export function createMockPasswordResetService(
    overrides?: Partial<jest.Mocked<PasswordResetService>>
): jest.Mocked<PasswordResetService> {
    return {
        requestPasswordReset: jest.fn(),
        resetPassword: jest.fn(),
        ...overrides,
    } as jest.Mocked<PasswordResetService>
}

/** XpTransactionRepository mock */
export function createMockXpTransactionRepository(
    overrides?: Partial<jest.Mocked<XpTransactionRepository>>
): jest.Mocked<XpTransactionRepository> {
    return {
        save: jest.fn().mockImplementation(async (tx) => tx),
        getWeeklyXp: jest.fn().mockResolvedValue(0),
        findRecentByUserId: jest.fn().mockResolvedValue([]),
        existsBySourceAndReference: jest.fn().mockResolvedValue(false),
        ...overrides,
    } as jest.Mocked<XpTransactionRepository>
}

/** LearningRecordRepository mock */
export function createMockLearningRecordRepository(
    overrides?: Partial<jest.Mocked<LearningRecordRepository>>
): jest.Mocked<LearningRecordRepository> {
    return {
        save: jest.fn().mockImplementation(async (r) => r),
        getActivityDates: jest.fn().mockResolvedValue([]),
        findByUserId: jest.fn().mockResolvedValue({ items: [], total: 0 }),
        existsByReference: jest.fn().mockResolvedValue(false),
        findByReference: jest.fn().mockResolvedValue(null),
        existsByDate: jest.fn().mockResolvedValue(false),
        findUserIdsWithActivityOnDate: jest.fn().mockResolvedValue(new Set()),
        ...overrides,
    } as jest.Mocked<LearningRecordRepository>
}

/** DailyGoalLogRepository mock */
export function createMockDailyGoalLogRepository(
    overrides?: Partial<jest.Mocked<DailyGoalLogRepository>>
): jest.Mocked<DailyGoalLogRepository> {
    return {
        findOrCreateForToday: jest.fn(),
        findByUserAndDate: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation(async (l) => l),
        ...overrides,
    } as jest.Mocked<DailyGoalLogRepository>
}

/** DailyChallengeRepository mock */
export function createMockDailyChallengeRepository(
    overrides?: Partial<jest.Mocked<DailyChallengeRepository>>
): jest.Mocked<DailyChallengeRepository> {
    return {
        save: jest.fn().mockImplementation(async (c) => ({ ...c, id: c.id ?? 1 })),
        findByDate: jest.fn().mockResolvedValue(null),
        findActiveByDate: jest.fn().mockResolvedValue(null),
        findUnsettledBefore: jest.fn().mockResolvedValue([]),
        incrementParticipantCount: jest.fn(),
        ...overrides,
    } as jest.Mocked<DailyChallengeRepository>
}

/** ChallengeParticipationRepository mock */
export function createMockChallengeParticipationRepository(
    overrides?: Partial<jest.Mocked<ChallengeParticipationRepository>>
): jest.Mocked<ChallengeParticipationRepository> {
    return {
        save: jest.fn().mockImplementation(async (p) => ({ ...p, id: p.id ?? 1 })),
        saveMany: jest.fn().mockImplementation(async (ps) => ps),
        existsByUserAndChallenge: jest.fn().mockResolvedValue(false),
        findByUserAndChallenge: jest.fn().mockResolvedValue(null),
        getLeaderboard: jest.fn().mockResolvedValue([]),
        countAboveScore: jest.fn().mockResolvedValue(0),
        findAllByChallenge: jest.fn().mockResolvedValue([]),
        ...overrides,
    } as jest.Mocked<ChallengeParticipationRepository>
}

/** SkillProfileCalculator mock */
export function createMockSkillProfileCalculator(
    overrides?: Partial<jest.Mocked<SkillProfileCalculator>>
): jest.Mocked<SkillProfileCalculator> {
    return {
        computeSkillScores: jest.fn().mockReturnValue(new Map()),
        findWeakestSkills: jest.fn().mockReturnValue([]),
        ...overrides,
    } as jest.Mocked<SkillProfileCalculator>
}

/** SkillProfileService mock */
export function createMockSkillProfileService(
    overrides?: Partial<jest.Mocked<SkillProfileService>>
): jest.Mocked<SkillProfileService> {
    return {
        getSkillProfile: jest.fn().mockResolvedValue({
            userId: 1,
            scores: [],
            overallAverage: 0,
            weakestAreas: [],
            strongestAreas: [],
            lastUpdatedAt: new Date(),
        }),
        invalidateCache: jest.fn(),
        ...overrides,
    } as jest.Mocked<SkillProfileService>
}

/** PronunciationErrorPatternRepository mock */
export function createMockErrorPatternRepository(
    overrides?: Partial<jest.Mocked<PronunciationErrorPatternRepository>>
): jest.Mocked<PronunciationErrorPatternRepository> {
    return {
        findAll: jest.fn().mockResolvedValue([]),
        findActive: jest.fn().mockResolvedValue([]),
        findActiveByCategory: jest.fn().mockResolvedValue([]),
        findById: jest.fn().mockResolvedValue(null),
        findByCode: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation(async (e) => ({ ...e, id: e.id ?? 1 })),
        remove: jest.fn(),
        ...overrides,
    } as jest.Mocked<PronunciationErrorPatternRepository>
}

/** UserErrorPatternRepository mock */
export function createMockUserErrorPatternRepository(
    overrides?: Partial<jest.Mocked<UserErrorPatternRepository>>
): jest.Mocked<UserErrorPatternRepository> {
    return {
        findByUserId: jest.fn().mockResolvedValue([]),
        findByUserAndPattern: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation(async (e) => e),
        saveMany: jest.fn().mockImplementation(async (e) => e),
        ...overrides,
    } as jest.Mocked<UserErrorPatternRepository>
}

/** PhonemeScoreRepository mock */
export function createMockPhonemeScoreRepository(
    overrides?: Partial<jest.Mocked<PhonemeScoreRepository>>
): jest.Mocked<PhonemeScoreRepository> {
    return {
        findByUserId: jest.fn().mockResolvedValue([]),
        findWeakest: jest.fn().mockResolvedValue([]),
        findByPhoneme: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation(async (e) => e),
        saveMany: jest.fn().mockImplementation(async (e) => e),
        getPhonemeHistory: jest.fn().mockResolvedValue([]),
        ...overrides,
    } as jest.Mocked<PhonemeScoreRepository>
}

/** MinimalPairRepository mock */
export function createMockMinimalPairRepository(
    overrides?: Partial<jest.Mocked<MinimalPairRepository>>
): jest.Mocked<MinimalPairRepository> {
    return {
        findAll: jest.fn().mockResolvedValue([]),
        findActive: jest.fn().mockResolvedValue([]),
        findByContrastType: jest.fn().mockResolvedValue([]),
        findByPhoneme: jest.fn().mockResolvedValue([]),
        findById: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation(async (e) => ({ ...e, id: e.id ?? 1 })),
        remove: jest.fn(),
        ...overrides,
    } as jest.Mocked<MinimalPairRepository>
}

/** PhonemeScoreService mock */
export function createMockPhonemeScoreService(
    overrides?: Partial<jest.Mocked<PhonemeScoreService>>
): jest.Mocked<PhonemeScoreService> {
    return {
        getScoresByUser: jest.fn().mockResolvedValue([]),
        getWeakPhonemes: jest.fn().mockResolvedValue([]),
        getScoresByPhoneme: jest.fn().mockResolvedValue([]),
        processAlignment: jest.fn(),
        updateSingleScore: jest.fn(),
        ...overrides,
    } as jest.Mocked<PhonemeScoreService>
}

/** MinimalPairService mock */
export function createMockMinimalPairService(
    overrides?: Partial<jest.Mocked<MinimalPairService>>
): jest.Mocked<MinimalPairService> {
    return {
        getMinimalPairs: jest.fn().mockResolvedValue([]),
        submitPractice: jest.fn().mockResolvedValue({ isCorrect: true, correctWord: "가", xpAwarded: 5 }),
        ...overrides,
    } as jest.Mocked<MinimalPairService>
}

/** SRSItemRepository mock */
export function createMockSrsItemRepository(
    overrides?: Partial<jest.Mocked<SRSItemRepository>>
): jest.Mocked<SRSItemRepository> {
    return {
        findDueItems: jest.fn().mockResolvedValue([]),
        findByUserAndItem: jest.fn().mockResolvedValue(null),
        findById: jest.fn().mockResolvedValue(null),
        findByUserId: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation(async (e) => ({ ...e, id: e.id ?? 1 })),
        countDueItems: jest.fn().mockResolvedValue(0),
        countDueItemsBatch: jest.fn().mockResolvedValue(new Map()),
        getStats: jest.fn().mockResolvedValue({ totalActive: 0, totalSuspended: 0, totalGraduated: 0, dueToday: 0 }),
        ...overrides,
    } as jest.Mocked<SRSItemRepository>
}

/** SrsService mock */
export function createMockSrsService(
    overrides?: Partial<jest.Mocked<SrsService>>
): jest.Mocked<SrsService> {
    return {
        getTodayQueue: jest.fn().mockResolvedValue([]),
        submitReview: jest.fn().mockResolvedValue({ id: 1, quality: 4, easeFactor: 2.5, interval: 3, nextReviewAt: new Date(), graduated: false, xpAwarded: 3 }),
        getStats: jest.fn().mockResolvedValue({ totalActive: 0, totalSuspended: 0, totalGraduated: 0, dueToday: 0, estimatedMinutes: 0 }),
        updateStatus: jest.fn(),
        createOrUpdateItem: jest.fn(),
        getSrsStats: jest.fn().mockResolvedValue({ totalActive: 0, totalSuspended: 0, totalGraduated: 0, dueToday: 0 }),
        hasDueItems: jest.fn().mockResolvedValue(false),
        getDueItemCount: jest.fn().mockResolvedValue(0),
        getDueItemCountBatch: jest.fn().mockResolvedValue(new Map()),
        ...overrides,
    } as jest.Mocked<SrsService>
}

/** ISrsProvider mock — cross-feature Port 인터페이스 */
export function createMockSrsProvider(
    overrides?: Partial<jest.Mocked<ISrsProvider>>
): jest.Mocked<ISrsProvider> {
    return {
        createOrUpdateItem: jest.fn(),
        getSrsStats: jest.fn().mockResolvedValue({ totalActive: 0, totalSuspended: 0, totalGraduated: 0, dueToday: 0 }),
        hasDueItems: jest.fn().mockResolvedValue(false),
        getDueItemCount: jest.fn().mockResolvedValue(0),
        getDueItemCountBatch: jest.fn().mockResolvedValue(new Map()),
        ...overrides,
    }
}

/** IPushNotificationSender mock */
export function createMockPushNotificationSender(
    overrides?: Partial<jest.Mocked<IPushNotificationSender>>
): jest.Mocked<IPushNotificationSender> {
    return {
        sendToDevice: jest.fn().mockResolvedValue(true),
        ...overrides,
    }
}

/** DeviceTokenRepository mock */
export function createMockDeviceTokenRepository(
    overrides?: Partial<jest.Mocked<DeviceTokenRepository>>
): jest.Mocked<DeviceTokenRepository> {
    return {
        findActiveByUserId: jest.fn().mockResolvedValue([]),
        findByUserAndToken: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation(async (e) => e),
        deactivateToken: jest.fn(),
        removeByUserAndToken: jest.fn(),
        findAllActiveUserIds: jest.fn().mockResolvedValue([]),
        ...overrides,
    } as jest.Mocked<DeviceTokenRepository>
}

/** IDeviceTokenReader mock — cross-feature Port 인터페이스 */
export function createMockDeviceTokenReader(
    overrides?: Partial<jest.Mocked<IDeviceTokenReader>>
): jest.Mocked<IDeviceTokenReader> {
    return {
        findAllActiveUserIds: jest.fn().mockResolvedValue([]),
        ...overrides,
    }
}

/** NotificationPreferenceRepository mock */
export function createMockNotificationPreferenceRepository(
    overrides?: Partial<jest.Mocked<NotificationPreferenceRepository>>
): jest.Mocked<NotificationPreferenceRepository> {
    return {
        findByUserId: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation(async (e) => e),
        findOrCreate: jest.fn().mockImplementation(async (userId: number) => {
            const { NotificationPreference } = require("@features/notification/domain/notification-preference.entity")
            return NotificationPreference.createDefault(userId)
        }),
        ...overrides,
    } as jest.Mocked<NotificationPreferenceRepository>
}

/** DeviceTokenService mock */
export function createMockDeviceTokenService(
    overrides?: Partial<jest.Mocked<DeviceTokenService>>
): jest.Mocked<DeviceTokenService> {
    return {
        registerToken: jest.fn(),
        removeToken: jest.fn(),
        getActiveTokens: jest.fn().mockResolvedValue([]),
        deactivateToken: jest.fn(),
        ...overrides,
    } as jest.Mocked<DeviceTokenService>
}

/** NotificationPreferenceService mock */
export function createMockNotificationPreferenceService(
    overrides?: Partial<jest.Mocked<NotificationPreferenceService>>
): jest.Mocked<NotificationPreferenceService> {
    return {
        getPreference: jest.fn().mockImplementation(async (userId: number) => {
            const { NotificationPreference } = require("@features/notification/domain/notification-preference.entity")
            return NotificationPreference.createDefault(userId)
        }),
        updatePreference: jest.fn(),
        ...overrides,
    } as jest.Mocked<NotificationPreferenceService>
}

/** PushNotificationService mock */
export function createMockPushNotificationService(
    overrides?: Partial<jest.Mocked<PushNotificationService>>
): jest.Mocked<PushNotificationService> {
    return {
        sendToUser: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }),
        ...overrides,
    } as jest.Mocked<PushNotificationService>
}

/** WeeklyReportRepository mock */
export function createMockWeeklyReportRepository(
    overrides?: Partial<jest.Mocked<WeeklyReportRepository>>
): jest.Mocked<WeeklyReportRepository> {
    return {
        save: jest.fn().mockImplementation(async (e) => ({ ...e, id: e.id ?? 1 })),
        findByUserAndWeek: jest.fn().mockResolvedValue(null),
        findRecentByUser: jest.fn().mockResolvedValue([]),
        ...overrides,
    } as jest.Mocked<WeeklyReportRepository>
}

/** WeeklyReportService mock */
export function createMockWeeklyReportService(
    overrides?: Partial<jest.Mocked<WeeklyReportService>>
): jest.Mocked<WeeklyReportService> {
    return {
        getReports: jest.fn().mockResolvedValue([]),
        getReport: jest.fn().mockResolvedValue(null),
        generateReport: jest.fn(),
        ...overrides,
    } as jest.Mocked<WeeklyReportService>
}

/** ProgressDashboardService mock */

/** ScenarioRepository mock */
export function createMockScenarioRepository(
    overrides?: Partial<jest.Mocked<ScenarioRepository>>
): jest.Mocked<ScenarioRepository> {
    return {
        findById: jest.fn().mockResolvedValue(null),
        findByIdLight: jest.fn().mockResolvedValue(null),
        findActive: jest.fn().mockResolvedValue({ items: [], total: 0 }),
        findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
        save: jest.fn().mockImplementation(async (e) => ({ ...e, id: e.id ?? 1 })),
        countCompletedByUser: jest.fn().mockResolvedValue(0),
        ...overrides,
    } as jest.Mocked<ScenarioRepository>
}

/** DialogueLineRepository mock */
export function createMockDialogueLineRepository(
    overrides?: Partial<jest.Mocked<DialogueLineRepository>>
): jest.Mocked<DialogueLineRepository> {
    return {
        findByScenarioId: jest.fn().mockResolvedValue([]),
        findById: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation(async (e) => ({ ...e, id: e.id ?? 1 })),
        saveMany: jest.fn().mockImplementation(async (e) => e),
        remove: jest.fn(),
        ...overrides,
    } as jest.Mocked<DialogueLineRepository>
}

/** ScenarioSessionRepository mock */
export function createMockScenarioSessionRepository(
    overrides?: Partial<jest.Mocked<ScenarioSessionRepository>>
): jest.Mocked<ScenarioSessionRepository> {
    return {
        findById: jest.fn().mockResolvedValue(null),
        findByIdLight: jest.fn().mockResolvedValue(null),
        findByUser: jest.fn().mockResolvedValue({ items: [], total: 0 }),
        findAbandonedBefore: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation(async (e) => ({ ...e, id: e.id ?? 1 })),
        saveMany: jest.fn(),
        ...overrides,
    } as jest.Mocked<ScenarioSessionRepository>
}

/** ScenarioLineResultRepository mock */
export function createMockScenarioLineResultRepository(
    overrides?: Partial<jest.Mocked<ScenarioLineResultRepository>>
): jest.Mocked<ScenarioLineResultRepository> {
    return {
        findBySessionId: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation(async (e) => ({ ...e, id: e.id ?? 1 })),
        ...overrides,
    } as jest.Mocked<ScenarioLineResultRepository>
}

/** ScenarioAdminService mock */
export function createMockScenarioAdminService(
    overrides?: Partial<jest.Mocked<ScenarioAdminService>>
): jest.Mocked<ScenarioAdminService> {
    return {
        getScenarios: jest.fn().mockResolvedValue({ items: [], total: 0 }),
        getScenario: jest.fn(),
        createScenario: jest.fn(),
        updateScenario: jest.fn(),
        deleteScenario: jest.fn(),
        addLine: jest.fn(),
        updateLine: jest.fn(),
        deleteLine: jest.fn(),
        reorderLines: jest.fn(),
        ...overrides,
    } as jest.Mocked<ScenarioAdminService>
}

/** ScenarioService mock */
export function createMockScenarioService(
    overrides?: Partial<jest.Mocked<ScenarioService>>
): jest.Mocked<ScenarioService> {
    return {
        getScenarios: jest.fn().mockResolvedValue({ items: [], total: 0 }),
        getScenario: jest.fn(),
        startSession: jest.fn(),
        saveLineResult: jest.fn(),
        completeSession: jest.fn(),
        getSessionHistory: jest.fn().mockResolvedValue({ items: [], total: 0 }),
        ...overrides,
    } as jest.Mocked<ScenarioService>
}

/** BreathingExerciseRepository mock */
export function createMockBreathingExerciseRepository(
    overrides?: Partial<jest.Mocked<BreathingExerciseRepository>>
): jest.Mocked<BreathingExerciseRepository> {
    return {
        save: jest.fn().mockImplementation(async (e) => ({ ...e, id: e.id ?? 1 })),
        findByUser: jest.fn().mockResolvedValue({ items: [], total: 0 }),
        getStats: jest.fn().mockResolvedValue({ avg: 0, max: 0, min: 0, count: 0, trend: "stable" }),
        getWeeklyTrends: jest.fn().mockResolvedValue([]),
        getMultiTypeStats: jest.fn().mockResolvedValue([]),
        ...overrides,
    } as jest.Mocked<BreathingExerciseRepository>
}

/** TherapyProgressRepository mock */
export function createMockTherapyProgressRepository(
    overrides?: Partial<jest.Mocked<TherapyProgressRepository>>
): jest.Mocked<TherapyProgressRepository> {
    return {
        findByUserId: jest.fn().mockResolvedValue(null),
        findByUserIds: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation(async (e) => ({ ...e, id: e.id ?? 1 })),
        ...overrides,
    } as jest.Mocked<TherapyProgressRepository>
}

/** TherapySessionRepository mock */
export function createMockTherapySessionRepository(
    overrides?: Partial<jest.Mocked<TherapySessionRepository>>
): jest.Mocked<TherapySessionRepository> {
    return {
        save: jest.fn().mockImplementation(async (e) => ({ ...e, id: e.id ?? 1 })),
        getSummary: jest.fn().mockResolvedValue({ totalSessions: 0, totalDuration: 0, byPhase: {}, dailyGoalProgress: 0 }),
        getLastActivityDate: jest.fn().mockResolvedValue(null),
        getLastActivityDates: jest.fn().mockResolvedValue(new Map()),
        ...overrides,
    } as jest.Mocked<TherapySessionRepository>
}

/** TherapyService mock */
export function createMockTherapyService(
    overrides?: Partial<jest.Mocked<TherapyService>>
): jest.Mocked<TherapyService> {
    return {
        createBreathingExercise: jest.fn(),
        getBreathingHistory: jest.fn().mockResolvedValue({ items: [], total: 0 }),
        getBreathingStats: jest.fn().mockResolvedValue({ avg: 0, max: 0, min: 0, count: 0, trend: "stable" }),
        getProgress: jest.fn(),
        completePhase: jest.fn(),
        createSession: jest.fn(),
        getSessionSummary: jest.fn().mockResolvedValue({ totalSessions: 0, totalDuration: 0, byPhase: {} }),
        createOralMotorExercise: jest.fn(),
        getOralMotorHistory: jest.fn().mockResolvedValue({ items: [], total: 0 }),
        getOralMotorStats: jest.fn().mockResolvedValue({ avg: 0, max: 0, min: 0, count: 0 }),
        getClinicalNorms: jest.fn().mockResolvedValue([]),
        compareWithNorms: jest.fn().mockResolvedValue([]),
        getProgressionRules: jest.fn().mockResolvedValue([]),
        checkPhaseAdvancement: jest.fn().mockResolvedValue({ advanced: false }),
        aggregatePhaseMetrics: jest.fn().mockResolvedValue({}),
        getBreathingTrends: jest.fn().mockResolvedValue([]),
        getPhonemeTrends: jest.fn().mockResolvedValue([]),
        getScoreTrends: jest.fn().mockResolvedValue([]),
        getPhaseReadiness: jest.fn().mockResolvedValue({ currentPhase: "PHASE_0", nextPhase: "PHASE_1", metrics: {}, overallReadiness: 0 }),
        ...overrides,
    } as jest.Mocked<TherapyService>
}

/** TherapistClientRepository mock */
export function createMockTherapistClientRepository(
    overrides?: Partial<jest.Mocked<TherapistClientRepository>>
): jest.Mocked<TherapistClientRepository> {
    return {
        findByTherapist: jest.fn().mockResolvedValue([]),
        findTherapistsByClient: jest.fn().mockResolvedValue([]),
        isLinked: jest.fn().mockResolvedValue(false),
        findByLinkCode: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation(async (e) => ({ ...e, id: e.id ?? 1 })),
        remove: jest.fn(),
        ...overrides,
    } as jest.Mocked<TherapistClientRepository>
}

/** TherapistAssignmentRepository mock */
export function createMockTherapistAssignmentRepository(
    overrides?: Partial<jest.Mocked<TherapistAssignmentRepository>>
): jest.Mocked<TherapistAssignmentRepository> {
    return {
        findByClient: jest.fn().mockResolvedValue([]),
        findPendingByClient: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation(async (e) => ({ ...e, id: e.id ?? 1 })),
        ...overrides,
    } as jest.Mocked<TherapistAssignmentRepository>
}

/** IPhonemeScoreReader mock */
export function createMockPhonemeScoreReader(
    overrides?: Partial<jest.Mocked<IPhonemeScoreReader>>
): jest.Mocked<IPhonemeScoreReader> {
    return {
        getGlobalDifficultyByPosition: jest.fn().mockResolvedValue([]),
        findByUserId: jest.fn().mockResolvedValue([]),
        getPhonemeHistory: jest.fn().mockResolvedValue([]),
        ...overrides,
    } as jest.Mocked<IPhonemeScoreReader>
}

/** SlpDashboardService mock */
export function createMockSlpDashboardService(
    overrides?: Partial<jest.Mocked<SlpDashboardService>>
): jest.Mocked<SlpDashboardService> {
    return {
        getPatientList: jest.fn().mockResolvedValue([]),
        getPatientProgress: jest.fn().mockResolvedValue(null),
        getPatientBreathingStats: jest.fn().mockResolvedValue({ avg: 0, max: 0, min: 0, count: 0, trend: "stable" }),
        getPatientBreathingHistory: jest.fn().mockResolvedValue({ items: [], total: 0 }),
        getPatientPhonemeScores: jest.fn().mockResolvedValue([]),
        getPatientSessionSummary: jest.fn().mockResolvedValue({ totalSessions: 0, totalDuration: 0, byPhase: {} }),
        generateLinkCode: jest.fn().mockResolvedValue("ABCD1234"),
        linkClientByCode: jest.fn(),
        createAssignment: jest.fn(),
        getAssignments: jest.fn().mockResolvedValue([]),
        getPatientBreathingTrends: jest.fn().mockResolvedValue([]),
        getPatientPhonemeTrends: jest.fn().mockResolvedValue([]),
        getPatientScoreTrends: jest.fn().mockResolvedValue([]),
        getPatientPhaseReadiness: jest.fn().mockResolvedValue({ currentPhase: "PHASE_0", nextPhase: "PHASE_1", metrics: {}, overallReadiness: 0 }),
        ...overrides,
    } as jest.Mocked<SlpDashboardService>
}

/** OralMotorExerciseRepository mock */
export function createMockOralMotorExerciseRepository(
    overrides?: Partial<jest.Mocked<OralMotorExerciseRepository>>
): jest.Mocked<OralMotorExerciseRepository> {
    return {
        save: jest.fn().mockImplementation(async (e) => ({ ...e, id: e.id ?? 1 })),
        findByUser: jest.fn().mockResolvedValue({ items: [], total: 0 }),
        getStats: jest.fn().mockResolvedValue({ avg: 0, max: 0, min: 0, count: 0 }),
        ...overrides,
    } as jest.Mocked<OralMotorExerciseRepository>
}

/** ClinicalNormRepository mock */
export function createMockClinicalNormRepository(
    overrides?: Partial<jest.Mocked<ClinicalNormRepository>>
): jest.Mocked<ClinicalNormRepository> {
    return {
        findActive: jest.fn().mockResolvedValue([]),
        findByCategory: jest.fn().mockResolvedValue([]),
        findByCategoryAndMetric: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation(async (e) => e),
        saveMany: jest.fn().mockImplementation(async (e) => e),
        ...overrides,
    } as jest.Mocked<ClinicalNormRepository>
}

/** PhaseProgressionRuleRepository mock */
export function createMockPhaseProgressionRuleRepository(
    overrides?: Partial<jest.Mocked<PhaseProgressionRuleRepository>>
): jest.Mocked<PhaseProgressionRuleRepository> {
    return {
        findActiveRules: jest.fn().mockResolvedValue([]),
        findRulesForTransition: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation(async (e) => e),
        saveMany: jest.fn().mockImplementation(async (e) => e),
        ...overrides,
    } as jest.Mocked<PhaseProgressionRuleRepository>
}

/** IAssessmentStatsProvider mock */
export function createMockAssessmentStatsProvider(
    overrides?: Partial<jest.Mocked<IAssessmentStatsProvider>>
): jest.Mocked<IAssessmentStatsProvider> {
    return {
        findByIdLight: jest.fn().mockResolvedValue(null),
        getScriptProgress: jest.fn().mockResolvedValue({ completedScriptIds: [], bestScores: {}, lastPracticedAt: {} }),
        getStatsByUserId: jest.fn().mockResolvedValue({ totalLessons: 0, completedLessons: 0, averageScore: 0, totalPracticeSeconds: 0 }),
        getTodayCompletedCount: jest.fn().mockResolvedValue(0),
        getWeeklyActivity: jest.fn().mockResolvedValue([]),
        hasScoreAbove: jest.fn().mockResolvedValue(false),
        findTodayCompletedByUser: jest.fn().mockResolvedValue([]),
        getScoresByArticulationPlace: jest.fn().mockResolvedValue([]),
        getScoreTrends: jest.fn().mockResolvedValue([]),
        ...overrides,
    } as jest.Mocked<IAssessmentStatsProvider>
}

/** TherapyRecommendationService mock */
export function createMockTherapyRecommendationService(
    overrides?: Partial<jest.Mocked<TherapyRecommendationService>>
): jest.Mocked<TherapyRecommendationService> {
    return {
        getRecommendations: jest.fn().mockResolvedValue([]),
        ...overrides,
    } as jest.Mocked<TherapyRecommendationService>
}

/** IConsecutiveErrorTracker mock */
export function createMockConsecutiveErrorTracker(
    overrides?: Partial<jest.Mocked<IConsecutiveErrorTracker>>
): jest.Mocked<IConsecutiveErrorTracker> {
    return {
        trackAndAlert: jest.fn(),
        ...overrides,
    }
}
