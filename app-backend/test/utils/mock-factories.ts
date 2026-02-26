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
import type { IEmailQueue } from "@shared/core/queue.interface"
import type { IConfigService } from "@shared/core/config.interface"
import type { DataSource, Repository } from "typeorm"
import type { VerificationService } from "@features/auth/application/verification.service"
import type { PasswordResetService } from "@features/auth/application/password-reset.service"
import type { DailyChallengeRepository } from "@features/game/infrastructure/daily-challenge.repository"
import type { ChallengeParticipationRepository } from "@features/game/infrastructure/challenge-participation.repository"

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
        hardDelete: jest.fn(),
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
        }),
        findTodayCompletedByUser: jest.fn().mockResolvedValue([]),
        findStuckAssessments: jest.fn().mockResolvedValue([]),
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
    }>
): Assessment {
    // 동적 import 없이 런타임에 Assessment 인스턴스 구성
    const { Assessment: AssessmentClass, AssessmentStatus: Status } =
        require("@features/assessment/domain/assessment.entity")
    const assessment = new AssessmentClass()
    assessment.id = overrides?.id ?? 1
    assessment.audioUrl = overrides?.audioUrl ?? "test.wav"
    assessment.status = overrides?.status ?? Status.PENDING
    assessment.retryCount = overrides?.retryCount ?? 0
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
