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
import { PushQueueAdapter } from "@shared/infra/queue/push-queue.adapter"
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

// Features - Difficulty (SkillProfile)
import { SkillProfileCalculator } from "@features/difficulty/domain/skill-profile-calculator"
import { SkillProfileService } from "@features/difficulty/application/skill-profile.service"

// Features - Phoneme
import { PhonemeScoreRepository } from "@features/phoneme/infrastructure/phoneme-score.repository"
import { PhonemeScoreService } from "@features/phoneme/application/phoneme-score.service"
import { PhonemeController } from "@features/phoneme/presentation/phoneme.controller"
import { AssessmentCompletedPhonemeHandler } from "@features/phoneme/handlers/assessment-completed-phoneme.handler"
import { PronunciationErrorPatternRepository } from "@features/phoneme/infrastructure/pronunciation-error-pattern.repository"
import { UserErrorPatternRepository } from "@features/phoneme/infrastructure/user-error-pattern.repository"
import { CorrectionService } from "@features/phoneme/application/correction.service"
import { CorrectionController } from "@features/phoneme/presentation/correction.controller"
import { ErrorPatternAdminController } from "@features/phoneme/presentation/error-pattern-admin.controller"
import { MinimalPairRepository } from "@features/phoneme/infrastructure/minimal-pair.repository"
import { MinimalPairService } from "@features/phoneme/application/minimal-pair.service"
import { MinimalPairController } from "@features/phoneme/presentation/minimal-pair.controller"
import { MinimalPairAdminController } from "@features/phoneme/presentation/minimal-pair-admin.controller"
import { DiscriminationSessionRepository } from "@features/phoneme/infrastructure/discrimination-session.repository"
import { DiscriminationService } from "@features/phoneme/application/discrimination.service"
import { DiscriminationController } from "@features/phoneme/presentation/discrimination.controller"

// Features - Analytics
import { AnalyticsService } from "@features/analytics/application/analytics.service"
import { AnalyticsAdminController } from "@features/analytics/presentation/analytics-admin.controller"

// Features - Reports (Admin)
import { ReportsAdminController } from "@features/weekly-report/presentation/reports-admin.controller"

// Features - Scenario
import { ScenarioRepository } from "@features/scenario/infrastructure/scenario.repository"
import { DialogueLineRepository } from "@features/scenario/infrastructure/dialogue-line.repository"
import { ScenarioSessionRepository } from "@features/scenario/infrastructure/scenario-session.repository"
import { ScenarioLineResultRepository } from "@features/scenario/infrastructure/scenario-line-result.repository"
import { ScenarioAdminService } from "@features/scenario/application/scenario-admin.service"
import { ScenarioAdminController } from "@features/scenario/presentation/scenario-admin.controller"
import { ScenarioService } from "@features/scenario/application/scenario.service"
import { ScenarioController } from "@features/scenario/presentation/scenario.controller"
import { AbandonedSessionCleaner } from "@features/scenario/worker/abandoned-session-cleaner.cron"

// Features - Weekly Report
import { WeeklyReportRepository } from "@features/weekly-report/infrastructure/weekly-report.repository"
import { WeeklyReportService } from "@features/weekly-report/application/weekly-report.service"
import { WeeklyReportController } from "@features/weekly-report/presentation/weekly-report.controller"
import { WeeklyReportGeneratorCron } from "@features/weekly-report/worker/weekly-report-generator.cron"

// Features - SRS
import { SRSItemRepository } from "@features/srs/infrastructure/srs-item.repository"
import { SrsService } from "@features/srs/application/srs.service"
import { SrsController } from "@features/srs/presentation/srs.controller"
import { AssessmentCompletedSrsHandler } from "@features/srs/handlers/assessment-completed-srs.handler"

// Features - Therapy
import { BreathingExerciseRepository } from "@features/therapy/infrastructure/breathing-exercise.repository"
import { TherapyProgressRepository } from "@features/therapy/infrastructure/therapy-progress.repository"
import { TherapySessionRepository } from "@features/therapy/infrastructure/therapy-session.repository"
import { TherapistClientRepository } from "@features/therapy/infrastructure/therapist-client.repository"
import { TherapistAssignmentRepository } from "@features/therapy/infrastructure/therapist-assignment.repository"
import { TherapyService } from "@features/therapy/application/therapy.service"
import { TherapyController } from "@features/therapy/presentation/therapy.controller"
import { SlpDashboardService } from "@features/therapy/application/slp-dashboard.service"
import { SlpDashboardController } from "@features/therapy/presentation/slp-dashboard.controller"
import { ConsecutiveErrorTrackerService } from "@features/therapy/application/consecutive-error-tracker.service"
import { TherapyRecommendationService } from "@features/therapy/application/therapy-recommendation.service"
import { AssessmentCompletedTherapyHandler } from "@features/therapy/handlers/assessment-completed-therapy.handler"
import { OralMotorExerciseRepository } from "@features/therapy/infrastructure/oral-motor-exercise.repository"
import { ClinicalNormRepository } from "@features/therapy/infrastructure/clinical-norm.repository"
import { PhaseProgressionRuleRepository } from "@features/therapy/infrastructure/phase-progression-rule.repository"

// Features - Notification
import { NodemailerMailProvider } from "@features/notification/infrastructure/mail/nodemailer-mail-provider"
import { SendGridMailProvider } from "@features/notification/infrastructure/mail/sendgrid-mail-provider"
import { NotificationLogRepository } from "@features/notification/infrastructure/notification-log.repository"
import { NotificationService } from "@features/notification/application/notification.service"
import { DeviceTokenRepository } from "@features/notification/infrastructure/device-token.repository"
import { NotificationPreferenceRepository } from "@features/notification/infrastructure/notification-preference.repository"
import { DeviceTokenService } from "@features/notification/application/device-token.service"
import { NotificationPreferenceService } from "@features/notification/application/notification-preference.service"
import { PushNotificationService } from "@features/notification/application/push-notification.service"
import { FirebasePushSender } from "@features/notification/infrastructure/push/firebase-push-sender"
import { NotificationController } from "@features/notification/presentation/notification.controller"
import { StreakReminderCron } from "@features/notification/worker/streak-reminder.cron"
import { ReviewReminderCron } from "@features/notification/worker/review-reminder.cron"

// Features - User (Repository)
import { UserRepository } from "@features/user/infrastructure/user.repository"

// Features - Assessment (Repository)
import { AssessmentRepository } from "@features/assessment/infrastructure/assessment.repository"

// Shared - SSE Realtime Notifications
import { SSENotificationService } from "@shared/infra/notifications/sse-notification.service"

// Features - Difficulty
import { DifficultyProfileRepository } from "@features/difficulty/infrastructure/difficulty-profile.repository"
import { DifficultyDecisionRepository } from "@features/difficulty/infrastructure/difficulty-decision.repository"
import { DifficultyService } from "@features/difficulty/application/difficulty.service"
import { DifficultyController } from "@features/difficulty/presentation/difficulty.controller"
import {
    AssessmentCompletedDifficultyHandler,
    GameSessionCompletedDifficultyHandler,
} from "@features/difficulty/handlers/difficulty-cache-invalidation.handler"
import { VoiceDiaryAnalyzedDifficultyHandler } from "@features/difficulty/handlers/voice-diary-analyzed-difficulty.handler"

// Features - Voice Diary
import { VoiceDiaryRepository } from "@features/voice-diary/infrastructure/voice-diary.repository"
import { VoiceDiaryService } from "@features/voice-diary/application/voice-diary.service"
import { VoiceDiaryController } from "@features/voice-diary/presentation/voice-diary.controller"
import { VoiceDiaryCreatedXpHandler } from "@features/gamification/handlers/voice-diary-xp.handler"
import { VoiceDiaryCreatedLearningHandler } from "@features/learning/handlers/voice-diary-created-learning.handler"

// Features - Research
import { ResearchQueryRepository } from "@features/research/infrastructure/research-query.repository"
import { ExportAuditLogRepository } from "@features/research/infrastructure/export-audit-log.repository"
import { AnonymizationService } from "@features/research/infrastructure/anonymization.service"
import { TreatmentEffectService } from "@features/research/application/treatment-effect.service"
import { CohortStatisticsService } from "@features/research/application/cohort-statistics.service"
import { ResearchExportService } from "@features/research/application/research-export.service"
import { ResearchAdminController } from "@features/research/presentation/research-admin.controller"

// Features - Family
import { FamilyLinkRepository } from "@features/family/infrastructure/family-link.repository"
import { FamilyService } from "@features/family/application/family.service"
import { FamilyDashboardService } from "@features/family/application/family-dashboard.service"
import { FamilyController } from "@features/family/presentation/family.controller"

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
    container.register(DI_TOKENS.IPushQueue, { useClass: PushQueueAdapter })

    // 도메인 이벤트 디스패처 등록 (싱글톤)
    container.registerSingleton(EventDispatcher)
    container.register(DI_TOKENS.IDomainEventDispatcher, { useToken: EventDispatcher })

    // Features - Notification (Email)
    container.registerSingleton(NotificationLogRepository)
    container.registerSingleton(NotificationService)

    // Features - Notification (Push)
    container.registerSingleton(DeviceTokenRepository)
    container.registerSingleton(NotificationPreferenceRepository)
    container.registerSingleton(FirebasePushSender)
    container.register(DI_TOKENS.IPushNotificationSender, { useToken: FirebasePushSender })
    container.registerSingleton(DeviceTokenService)
    container.registerSingleton(NotificationPreferenceService)
    container.registerSingleton(PushNotificationService)
    container.registerSingleton(NotificationController)
    container.registerSingleton(StreakReminderCron)
    container.registerSingleton(ReviewReminderCron)

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

    // Features - Difficulty (SkillProfile Domain)
    container.registerSingleton(SkillProfileCalculator)

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
    container.register(DI_TOKENS.IUserAnalyticsReader, { useToken: UserRepository })
    container.register(DI_TOKENS.IAssessmentAnalyticsReader, { useToken: AssessmentRepository })
    container.register(DI_TOKENS.IWeeklyReportReader, { useToken: WeeklyReportRepository })
    container.register(DI_TOKENS.IPhonemeScoreReader, { useToken: PhonemeScoreRepository })
    container.register(DI_TOKENS.IDeviceTokenReader, { useToken: DeviceTokenRepository })

    // Features - Difficulty (SkillProfile Port 바인딩)
    container.registerSingleton(SkillProfileService)
    container.register(DI_TOKENS.ISkillProfileProvider, { useToken: SkillProfileService })

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

    // Features - SRS (Phoneme, Scenario에서 의존하므로 먼저 등록)
    container.registerSingleton(SRSItemRepository)
    container.registerSingleton(SrsService)
    container.register(DI_TOKENS.ISrsProvider, { useToken: SrsService })
    container.registerSingleton(SrsController)

    // Features - Phoneme
    container.registerSingleton(PhonemeScoreRepository)
    container.registerSingleton(PronunciationErrorPatternRepository)
    container.registerSingleton(UserErrorPatternRepository)
    container.registerSingleton(PhonemeScoreService)
    container.registerSingleton(CorrectionService)
    container.registerSingleton(PhonemeController)
    container.registerSingleton(CorrectionController)
    container.registerSingleton(ErrorPatternAdminController)
    container.registerSingleton(MinimalPairRepository)
    container.registerSingleton(MinimalPairService)
    container.registerSingleton(MinimalPairController)
    container.registerSingleton(MinimalPairAdminController)
    container.registerSingleton(DiscriminationSessionRepository)
    container.registerSingleton(DiscriminationService)
    container.registerSingleton(DiscriminationController)

    // Features - Weekly Report
    container.registerSingleton(WeeklyReportRepository)
    container.registerSingleton(WeeklyReportService)
    container.registerSingleton(WeeklyReportController)
    container.registerSingleton(WeeklyReportGeneratorCron)
    container.registerSingleton(ReportsAdminController)

    // Features - Analytics
    container.registerSingleton(AnalyticsService)
    container.registerSingleton(AnalyticsAdminController)

    // Features - Scenario
    container.registerSingleton(ScenarioRepository)
    container.registerSingleton(DialogueLineRepository)
    container.registerSingleton(ScenarioSessionRepository)
    container.registerSingleton(ScenarioLineResultRepository)
    container.registerSingleton(ScenarioAdminService)
    container.registerSingleton(ScenarioAdminController)
    container.registerSingleton(ScenarioService)
    container.registerSingleton(ScenarioController)
    container.registerSingleton(AbandonedSessionCleaner)

    // Features - Therapy
    container.registerSingleton(BreathingExerciseRepository)
    container.registerSingleton(OralMotorExerciseRepository)
    container.registerSingleton(ClinicalNormRepository)
    container.registerSingleton(PhaseProgressionRuleRepository)
    container.registerSingleton(TherapyProgressRepository)
    container.registerSingleton(TherapySessionRepository)
    container.registerSingleton(TherapistClientRepository)
    container.registerSingleton(TherapistAssignmentRepository)
    container.registerSingleton(TherapyService)
    container.registerSingleton(TherapyController)
    container.registerSingleton(SlpDashboardService)
    container.registerSingleton(SlpDashboardController)
    container.registerSingleton(TherapyRecommendationService)
    container.registerSingleton(ConsecutiveErrorTrackerService)
    container.register(DI_TOKENS.IConsecutiveErrorTracker, { useToken: ConsecutiveErrorTrackerService })
    container.register(DI_TOKENS.ITherapistClientChecker, { useToken: TherapistClientRepository })

    // Features - Difficulty
    container.registerSingleton(DifficultyProfileRepository)
    container.registerSingleton(DifficultyDecisionRepository)
    container.registerSingleton(DifficultyService)
    container.register(DI_TOKENS.IDifficultyProvider, { useToken: DifficultyService })
    container.registerSingleton(DifficultyController)

    // Features - Voice Diary
    container.registerSingleton(VoiceDiaryRepository)
    container.register(DI_TOKENS.IVoiceDiaryProvider, { useToken: VoiceDiaryRepository })
    container.registerSingleton(VoiceDiaryService)
    container.registerSingleton(VoiceDiaryController)

    // Features - Family
    container.registerSingleton(FamilyLinkRepository)
    container.register(DI_TOKENS.IFamilyLinkReader, { useToken: FamilyLinkRepository })
    container.registerSingleton(FamilyService)
    container.registerSingleton(FamilyDashboardService)
    container.registerSingleton(FamilyController)

    // Features - Research
    container.registerSingleton(ResearchQueryRepository)
    container.registerSingleton(ExportAuditLogRepository)
    container.registerSingleton(AnonymizationService)
    container.registerSingleton(TreatmentEffectService)
    container.registerSingleton(CohortStatisticsService)
    container.registerSingleton(ResearchExportService)
    container.registerSingleton(ResearchAdminController)

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

    // Phoneme Event Handlers
    container.registerSingleton(AssessmentCompletedPhonemeHandler)
    resolveAndRegister(AssessmentCompletedPhonemeHandler)

    // SRS Event Handlers
    container.registerSingleton(AssessmentCompletedSrsHandler)
    resolveAndRegister(AssessmentCompletedSrsHandler)

    // Badge Event Handlers
    container.registerSingleton(AssessmentBadgeHandler)
    container.registerSingleton(GameSessionBadgeHandler)
    container.registerSingleton(LevelUpBadgeHandler)
    resolveAndRegister(AssessmentBadgeHandler)
    resolveAndRegister(GameSessionBadgeHandler)
    resolveAndRegister(LevelUpBadgeHandler)

    // Difficulty Event Handlers
    container.registerSingleton(AssessmentCompletedDifficultyHandler)
    container.registerSingleton(GameSessionCompletedDifficultyHandler)
    container.registerSingleton(VoiceDiaryAnalyzedDifficultyHandler)
    resolveAndRegister(AssessmentCompletedDifficultyHandler)
    resolveAndRegister(GameSessionCompletedDifficultyHandler)
    resolveAndRegister(VoiceDiaryAnalyzedDifficultyHandler)

    // Voice Diary Event Handlers
    container.registerSingleton(VoiceDiaryCreatedXpHandler)
    container.registerSingleton(VoiceDiaryCreatedLearningHandler)
    resolveAndRegister(VoiceDiaryCreatedXpHandler)
    resolveAndRegister(VoiceDiaryCreatedLearningHandler)

    // Therapy Event Handlers
    container.registerSingleton(AssessmentCompletedTherapyHandler)
    resolveAndRegister(AssessmentCompletedTherapyHandler)

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
