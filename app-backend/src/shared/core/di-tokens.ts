/**
 * DI 컨테이너 토큰 상수 — 문자열 토큰 중앙화
 *
 * 모든 @inject("...") 및 container.register("...") 에서 이 상수를 참조한다.
 */
export const DI_TOKENS = {
    ILogger: "ILogger",
    IRedisService: "IRedisService",
    ITokenProvider: "ITokenProvider",
    IPasswordHasher: "IPasswordHasher",
    IDomainEventDispatcher: "IDomainEventDispatcher",
    IConfigService: "IConfigService",
    IAnalysisQueue: "IAnalysisQueue",
    IEmailQueue: "IEmailQueue",
    INotificationProvider: "INotificationProvider",
    IRealtimeNotifier: "IRealtimeNotifier",
    IGameConfigProvider: "IGameConfigProvider",
    IUserRepository: "IUserRepository",
    IAssessmentStatsProvider: "IAssessmentStatsProvider",
    IScriptProvider: "IScriptProvider",
    IChapterProgressChecker: "IChapterProgressChecker",
    IXpAwarder: "IXpAwarder",
    ILearningRecordProvider: "ILearningRecordProvider",
    INotificationSender: "INotificationSender",
    ISessionTokenManager: "ISessionTokenManager",
    IGamificationProvider: "IGamificationProvider",
    IUserStatsUpdater: "IUserStatsUpdater",
    IGameCompletionReader: "IGameCompletionReader",
    DataSource: "DataSource",
} as const
