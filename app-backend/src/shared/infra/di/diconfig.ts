import "reflect-metadata"
import { container } from "tsyringe"

// Shared - Core
import { DI_TOKENS } from "@shared/core/di-tokens"
import { DOMAIN_EVENT_TYPES, type DomainEventType } from "@shared/core/constants/domain-event-types"
import { ILogger } from "@shared/core/logger.interface"
import { RedisService } from "@shared/infra/persistence/redis/redis-service"
import { PinoLogger } from "@shared/infra/logging/pino-logger"
import { RateLimitService } from "@shared/core/rate-limit.service"
import { ConfigService } from "@shared/infra/config/config.service"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { EventDispatcher } from "@shared/lib/events/event-dispatcher"
import { AnalysisQueueAdapter } from "@shared/infra/queue/analysis-queue.adapter"
import { EmailQueueAdapter } from "@shared/infra/queue/email-queue.adapter"
import { QueueCrypto } from "@shared/utils/queue-crypto.utils"

// Features - Auth
import { AuthController } from "@features/auth/presentation/auth.controller"
import { AuthService } from "@features/auth/application/auth.service"
import { VerificationService } from "@features/auth/application/verification.service"
import { PasswordResetService } from "@features/auth/application/password-reset.service"
import { TokenRefreshPolicy } from "@features/auth/domain/token-refresh-policy"
import { TokenRotationService } from "@features/auth/application/token-rotation.service"
import { LoginStrategyFactory } from "@features/auth/application/login-strategy.factory"
import { EmailLoginStrategy } from "@features/auth/application/email-login.strategy"
import { JwtTokenProvider } from "@features/auth/infrastructure/crypto/jwt-token-provider"
import { BcryptPasswordHasher } from "@features/auth/infrastructure/crypto/bcrypt-password-hasher"

// Features - User
import { UserController } from "@features/user/presentation/user.controller"
import { UserStatsService } from "@features/user/application/user-stats.service"
import { UserService } from "@features/user/application/user.service"
import { EmailVerifiedEventHandler } from "@features/user/handlers/email-verified-event.handler"
import { AssessmentCompletedStatsHandler } from "@features/user/handlers/assessment-completed-stats.handler"

// Features - Assessment
import { AssessmentController } from "@features/assessment/presentation/assessment.controller"
import { AssessmentService } from "@features/assessment/application/assessment.service"
import { AssessmentAnalysisService } from "@features/assessment/application/assessment-analysis.service"
import { AnalysisResultProcessor } from "@features/assessment/application/analysis-result-processor"
import { StuckAssessmentCleaner } from "@features/assessment/cron/stuck-assessment-cleaner"
import { GuestAccountCleaner } from "@features/user/cron/guest-account-cleaner"
import { DLQMonitor } from "@features/assessment/cron/dlq-monitor"

// Features - Script
import { ScriptController } from "@features/script/presentation/script.controller"
import { ScriptService } from "@features/script/application/script.service"
import { GameScriptSelector } from "@features/script/application/game-script-selector"
import { ScriptRepository } from "@features/script/infrastructure/script.repository"
import { ChapterUnlockPolicy } from "@features/script/domain/chapter-unlock-policy"
import { ChapterProgressService } from "@features/script/application/chapter-progress.service"
import { ContentVersionService } from "@features/script/application/content-version.service"

// Features - Learning
import { LearningRecordRepository } from "@features/learning/infrastructure/learning-record.repository"
import { DailyGoalLogRepository } from "@features/learning/infrastructure/daily-goal-log.repository"
import { StreakCalculator } from "@features/learning/domain/streak-calculator"
import { LearningRecordService } from "@features/learning/application/learning-record.service"
import { LearningRecordController } from "@features/learning/presentation/learning-record.controller"
import { AssessmentCompletedLearningHandler } from "@features/learning/handlers/assessment-completed-learning.handler"

// Features - Game
import { GameSessionRepository } from "@features/game/infrastructure/game-session.repository"
import { GameScriptCompletionRepository } from "@features/game/infrastructure/game-script-completion.repository"
import { GameWordResultRepository } from "@features/game/infrastructure/game-word-result.repository"
import { GameXpCalculator } from "@features/game/domain/game-xp-calculator"
import { GameSlotCalculator } from "@features/game/domain/game-slot-calculator"
import { CompletionSnapshot } from "@features/game/domain/completion-snapshot"
import { CompletionProcessor } from "@features/game/application/completion-processor"
import { GameSessionService } from "@features/game/application/game-session.service"
import { GameSessionController } from "@features/game/presentation/game-session.controller"
import { DailyChallengeRepository } from "@features/game/infrastructure/daily-challenge.repository"
import { ChallengeParticipationRepository } from "@features/game/infrastructure/challenge-participation.repository"
import { DailyChallengeService } from "@features/game/application/daily-challenge.service"
import { DailyChallengeController } from "@features/game/presentation/daily-challenge.controller"
import { DailyChallengeGenerator } from "@features/game/worker/daily-challenge-generator"

// Features - Gamification (XP + Level)
import { XpTransactionRepository } from "@features/gamification/infrastructure/xp-transaction.repository"
import { UserLevelRepository } from "@features/gamification/infrastructure/user-level.repository"
import { XpService } from "@features/gamification/application/xp.service"
import {
    AssessmentXpHandler,
    DailyGoalXpHandler,
} from "@features/gamification/handlers/xp.handler"
import { BadgeRepository } from "@features/gamification/infrastructure/badge.repository"
import { UserBadgeRepository } from "@features/gamification/infrastructure/user-badge.repository"
import { BadgeConditionEvaluator } from "@features/gamification/domain/badge-condition-evaluator"
import { BadgeService } from "@features/gamification/application/badge.service"
import {
    AssessmentBadgeHandler,
    GameSessionBadgeHandler,
    LevelUpBadgeHandler,
} from "@features/gamification/handlers/badge.handler"
import { GamificationService } from "@features/gamification/application/gamification.service"
import { GamificationController } from "@features/gamification/presentation/gamification.controller"
import { GameConfigRepository } from "@features/gamification/infrastructure/game-config.repository"
import { GameConfigService } from "@features/gamification/application/game-config.service"
import { GameConfigController } from "@features/gamification/presentation/game-config.controller"

// Features - Notification
import { NodemailerMailProvider } from "@features/notification/infrastructure/mail/nodemailer-mail-provider"
import { SendGridMailProvider } from "@features/notification/infrastructure/mail/sendgrid-mail-provider"
import { NotificationLogRepository } from "@features/notification/infrastructure/notification-log.repository"
import { NotificationService } from "@features/notification/application/notification.service"

// Features - User (Repository)
import { UserRepository } from "@features/user/infrastructure/user.repository"

// Features - Assessment (Repository)
import { AssessmentRepository } from "@features/assessment/infrastructure/assessment.repository"

// Shared - SSE Realtime Notifications
import { SSENotificationService } from "@shared/infra/notifications/sse-notification.service"

/**
 * 의존성 주입 컨테이너 등록
 */
export async function setupDI() {
    // Core 어댑터 등록
    container.register(DI_TOKENS.IPasswordHasher, { useClass: BcryptPasswordHasher })
    container.register(DI_TOKENS.ITokenProvider, { useClass: JwtTokenProvider })
    // INotificationProvider Factory
    container.register(DI_TOKENS.INotificationProvider, {
        useFactory: (c) => {
            const configService = c.resolve(ConfigService)
            const providerType = configService.config.mailProvider

            if (providerType === "sendgrid") {
                return c.resolve(SendGridMailProvider)
            } else {
                return c.resolve(NodemailerMailProvider)
            }
        },
    })
    container.registerSingleton(RedisService)
    container.register(DI_TOKENS.IRedisService, { useToken: RedisService })
    container.register(DI_TOKENS.ILogger, { useClass: PinoLogger })

    // SSE 실시간 알림 (IRealtimeNotifier 인터페이스 → SSENotificationService 구현)
    container.registerSingleton(SSENotificationService)
    container.register(DI_TOKENS.IRealtimeNotifier, { useToken: SSENotificationService })

    // DataSource 등록
    container.registerInstance(DI_TOKENS.DataSource, AppDataSource)

    // Services - Singleton
    container.registerSingleton(RateLimitService)
    container.registerSingleton(ConfigService)
    container.register(DI_TOKENS.IConfigService, { useToken: ConfigService })

    // QueueCrypto 초기화 — process.env 직접 참조 제거
    const config = container.resolve(ConfigService).config
    QueueCrypto.initialize(config.queue.encryptionKey, config.jwt.secret)

    // Queue Adapters — Application 계층에서 인터페이스로 접근
    container.register(DI_TOKENS.IAnalysisQueue, { useClass: AnalysisQueueAdapter })
    container.register(DI_TOKENS.IEmailQueue, { useClass: EmailQueueAdapter })

    // 도메인 이벤트 디스패처 등록 (싱글톤)
    container.registerSingleton(EventDispatcher)
    container.register(DI_TOKENS.IDomainEventDispatcher, { useToken: EventDispatcher })

    // Features - Notification
    container.registerSingleton(NotificationLogRepository)
    container.registerSingleton(NotificationService)

    // Features - User (Repository)
    container.registerSingleton(UserRepository)

    // Features - Assessment (Repository)
    container.registerSingleton(AssessmentRepository)

    // Features - Script (Repository + Domain + Application)
    container.registerSingleton(ScriptRepository)
    container.registerSingleton(ContentVersionService)
    container.registerSingleton(ChapterUnlockPolicy)

    // Features - Learning (Repository + Domain + Application)
    container.registerSingleton(LearningRecordRepository)
    container.registerSingleton(DailyGoalLogRepository)
    container.registerSingleton(StreakCalculator)
    container.registerSingleton(LearningRecordService)

    // Features - Game (Repository + Domain)
    container.registerSingleton(GameSessionRepository)
    container.registerSingleton(GameScriptCompletionRepository)
    container.registerSingleton(GameWordResultRepository)
    container.registerSingleton(GameXpCalculator)
    container.registerSingleton(GameSlotCalculator)
    container.registerSingleton(CompletionSnapshot)
    container.registerSingleton(CompletionProcessor)

    // Features - Gamification (Repository + Domain + Application)
    container.registerSingleton(XpTransactionRepository)
    container.registerSingleton(UserLevelRepository)
    container.registerSingleton(XpService)
    container.registerSingleton(BadgeRepository)
    container.registerSingleton(UserBadgeRepository)
    container.registerSingleton(BadgeConditionEvaluator)
    container.registerSingleton(GameConfigRepository)
    container.registerSingleton(GameConfigService)
    container.register(DI_TOKENS.IGameConfigProvider, { useToken: GameConfigService })

    // Features - Auth (Domain)
    container.registerSingleton(TokenRefreshPolicy)
    container.registerSingleton(TokenRotationService)

    // ── Port → Adapter 바인딩 (cross-feature 인터페이스) ──
    // 구현체 singleton 등록 후, 소비자 resolve 전에 배치
    container.register(DI_TOKENS.IUserRepository, { useToken: UserRepository })
    container.register(DI_TOKENS.IAssessmentStatsProvider, { useToken: AssessmentRepository })
    container.register(DI_TOKENS.IScriptProvider, { useToken: ScriptRepository })
    container.register(DI_TOKENS.IChapterProgressChecker, { useToken: ChapterProgressService })
    container.register(DI_TOKENS.IXpAwarder, { useToken: XpService })
    container.register(DI_TOKENS.ILearningRecordProvider, { useToken: LearningRecordService })
    container.register(DI_TOKENS.INotificationSender, { useToken: NotificationService })
    container.register(DI_TOKENS.ISessionTokenManager, { useToken: TokenRotationService })
    container.register(DI_TOKENS.IGamificationProvider, { useToken: GamificationService })
    container.register(DI_TOKENS.IUserStatsUpdater, { useToken: UserStatsService })
    container.register(DI_TOKENS.IGameCompletionReader, { useToken: GameScriptCompletionRepository })

    // ── 소비자 서비스 (Port 토큰에 의존) ──

    // Features - Script (Port 의존 서비스)
    container.registerSingleton(ChapterProgressService)
    container.registerSingleton(GameScriptSelector)
    container.registerSingleton(ScriptService)
    container.registerSingleton(ScriptController)

    // Features - Auth (Port 의존 서비스)
    container.registerSingleton(VerificationService)
    container.registerSingleton(PasswordResetService)
    container.registerSingleton(AuthService)
    container.registerSingleton(AuthController)

    // Auth Strategies
    container.registerSingleton(LoginStrategyFactory)
    const factory = container.resolve(LoginStrategyFactory)
    const emailStrategy = container.resolve(EmailLoginStrategy)
    factory.registerStrategy(emailStrategy)
    container.registerInstance(LoginStrategyFactory, factory)

    // Features - User (Port 의존 서비스)
    container.registerSingleton(UserStatsService)
    container.registerSingleton(UserService)
    container.registerSingleton(UserController)

    // Features - Learning (Controller)
    container.registerSingleton(LearningRecordController)

    // Features - Game (Port 의존 서비스)
    container.registerSingleton(GameSessionService)
    container.registerSingleton(GameSessionController)

    // Features - Daily Challenge
    container.registerSingleton(DailyChallengeRepository)
    container.registerSingleton(ChallengeParticipationRepository)
    container.registerSingleton(DailyChallengeService)
    container.registerSingleton(DailyChallengeController)
    container.registerSingleton(DailyChallengeGenerator)

    // Features - Gamification (Port 의존 서비스)
    container.registerSingleton(BadgeService)
    container.registerSingleton(GamificationService)
    container.registerSingleton(GamificationController)
    container.registerSingleton(GameConfigController)

    // Features - Assessment
    container.registerSingleton(AnalysisResultProcessor)
    container.registerSingleton(AssessmentService)
    container.registerSingleton(AssessmentAnalysisService)
    container.registerSingleton(AssessmentController)
    container.registerSingleton(StuckAssessmentCleaner)
    container.registerSingleton(GuestAccountCleaner)
    container.registerSingleton(DLQMonitor)

    // Event Handlers
    container.registerSingleton(EmailVerifiedEventHandler)
    container.registerSingleton(AssessmentCompletedStatsHandler)

    // Register Event Handlers to Dispatcher
    const eventDispatcher = container.resolve(EventDispatcher)

    /** 핸들러를 resolve하고 EventDispatcher에 등록하는 헬퍼 */
    function resolveAndRegister<T extends { eventType(): DomainEventType; handle(event: unknown): Promise<void> }>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DI 컨테이너가 생성자 파라미터를 동적 주입
        HandlerClass: new (...args: any[]) => T
    ): void {
        const handler = container.resolve(HandlerClass)
        eventDispatcher.register(handler.eventType(), handler)
    }

    // User Event Handlers
    resolveAndRegister(EmailVerifiedEventHandler)
    resolveAndRegister(AssessmentCompletedStatsHandler)

    // Learning Event Handlers
    container.registerSingleton(AssessmentCompletedLearningHandler)
    resolveAndRegister(AssessmentCompletedLearningHandler)

    // XP Event Handlers
    container.registerSingleton(AssessmentXpHandler)
    container.registerSingleton(DailyGoalXpHandler)
    resolveAndRegister(AssessmentXpHandler)
    resolveAndRegister(DailyGoalXpHandler)

    // Badge Event Handlers
    container.registerSingleton(AssessmentBadgeHandler)
    container.registerSingleton(GameSessionBadgeHandler)
    container.registerSingleton(LevelUpBadgeHandler)
    resolveAndRegister(AssessmentBadgeHandler)
    resolveAndRegister(GameSessionBadgeHandler)
    resolveAndRegister(LevelUpBadgeHandler)

    // 이벤트 핸들러 등록 검증 — 핸들러 누락 시 조기 감지
    const expectedEvents = Object.values(DOMAIN_EVENT_TYPES)
    for (const eventType of expectedEvents) {
        if (eventDispatcher.getHandlerCount(eventType) === 0) {
            throw new Error(`[DI] No handlers registered for ${eventType}`)
        }
    }

    const logger = container.resolve<ILogger>(DI_TOKENS.ILogger)
    logger.info("Dependencies registered successfully")
}
