import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1700000000000 implements MigrationInterface {
    name = 'InitialSchema1700000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('GUEST', 'USER', 'ADMIN')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "firstName" character varying(100) NOT NULL, "lastName" character varying(100), "email" character varying(255) NOT NULL, "password" character varying NOT NULL, "isVerified" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "weeklyGoal" integer NOT NULL DEFAULT '35', "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER', "termsAgreedAt" TIMESTAMP, "deviceId" character varying(255), "serviceConsentAt" TIMESTAMP WITH TIME ZONE, "serviceConsentVersion" character varying(50), "voiceConsentAt" TIMESTAMP WITH TIME ZONE, "voiceConsentVersion" character varying(50), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."assessments_status_enum" AS ENUM('PENDING', 'ANALYZING', 'COMPLETED', 'FAILED', 'MAX_RETRY_EXCEEDED')`);
        await queryRunner.query(`CREATE TABLE "assessments" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "audioUrl" character varying(500) NOT NULL, "duration" integer NOT NULL DEFAULT '0', "scriptText" text, "transcribedText" text, "scriptId" integer, "status" "public"."assessments_status_enum" NOT NULL DEFAULT 'PENDING', "retryCount" integer NOT NULL DEFAULT '0', "lastError" text, "score" double precision, "feedback" text, "pitchData" text, "speakingRate" double precision, "scriptSnapshot" text, "userId" integer, CONSTRAINT "PK_a3442bd80a00e9111cefca57f6c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ed8dd3a7f6658ea6855ffa0645" ON "assessments" ("userId", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_4de7612d07afc379079d68fc0e" ON "assessments" ("userId", "status", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_f6957bb44a54ff23b7e4ef0158" ON "assessments" ("status", "updatedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_bbf68572b4a189540acc419516" ON "assessments" ("userId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_5b842a1a16b55c8fa677fd4510" ON "assessments" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_18904497714587c1df720c5a8e" ON "assessments" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6aab0d30090866bb9cc0c61c7" ON "assessments" ("userId") `);
        await queryRunner.query(`CREATE TYPE "public"."assessment_analysis_logs_status_enum" AS ENUM('SUCCESS', 'FAIL')`);
        await queryRunner.query(`CREATE TABLE "assessment_analysis_logs" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "assessmentId" integer NOT NULL, "status" "public"."assessment_analysis_logs_status_enum" NOT NULL, "errorMessage" text, "attemptNumber" integer NOT NULL, "durationMs" integer, CONSTRAINT "PK_cc9451d197477ec7e85803edc66" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."scripts_difficulty_enum" AS ENUM('EASY', 'MEDIUM', 'HARD')`);
        await queryRunner.query(`CREATE TYPE "public"."scripts_articulationplace_enum" AS ENUM('BILABIAL', 'ALVEOLAR', 'VELAR', 'PALATAL', 'GLOTTAL', 'MIXED', 'NONE')`);
        await queryRunner.query(`CREATE TABLE "scripts" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "title" character varying(500) NOT NULL, "content" text NOT NULL, "category" character varying(200) NOT NULL DEFAULT 'practice', "difficulty" "public"."scripts_difficulty_enum" NOT NULL DEFAULT 'EASY', "articulationPlace" "public"."scripts_articulationplace_enum" NOT NULL DEFAULT 'MIXED', "targetConsonants" text, "description" text, "isActive" boolean NOT NULL DEFAULT true, "chapterId" integer, "orderIndex" integer NOT NULL DEFAULT '0', "deletedAt" TIMESTAMP, CONSTRAINT "PK_399d1c469ffd6bac4e061e5fd8c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9ee6c1bfbd7c97f5f6eba92646" ON "scripts" ("deletedAt", "chapterId") `);
        await queryRunner.query(`CREATE INDEX "IDX_263f9a129ffbb860b5e3f40559" ON "scripts" ("deletedAt") `);
        await queryRunner.query(`CREATE TABLE "chapters" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "title" character varying(200) NOT NULL, "description" text, "orderIndex" integer NOT NULL DEFAULT '0', "deletedAt" TIMESTAMP, CONSTRAINT "PK_a2bbdbb4bdc786fe0cb0fcfc4a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a75adede33d7f70f760badb811" ON "chapters" ("deletedAt") `);
        await queryRunner.query(`CREATE TABLE "user_goal_logs" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer NOT NULL, "previousGoal" integer, "newGoal" integer, CONSTRAINT "PK_428caccd5c5ef3cdebff7e22122" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."notification_logs_status_enum" AS ENUM('PENDING', 'SENT', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "notification_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" integer, "recipient" character varying(255) NOT NULL, "subject" character varying(500) NOT NULL, "content" text, "status" "public"."notification_logs_status_enum" NOT NULL DEFAULT 'PENDING', "errorMessage" text, "sentAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_19c524e644cdeaebfcffc284871" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_feb65e9636ac2c4e59a863c3a3" ON "notification_logs" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_d348e06bb339e4439d60b1480d" ON "notification_logs" ("userId") `);
        await queryRunner.query(`CREATE TABLE "content_versions" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "checksum" character varying(64) NOT NULL, "reason" text, CONSTRAINT "PK_77046b137eb8001947fc332e594" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."learning_records_activitytype_enum" AS ENUM('ASSESSMENT', 'GAME')`);
        await queryRunner.query(`CREATE TABLE "learning_records" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer NOT NULL, "activityType" "public"."learning_records_activitytype_enum" NOT NULL, "activityDate" date NOT NULL, "referenceId" integer, "score" double precision, "duration" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_3060e4316a49c5f57e21a02f8b1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ea6960e0cbda54c6ab5dc73db9" ON "learning_records" ("userId", "activityType", "referenceId") WHERE "referenceId" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_311dea598b319bdf2a88b3da59" ON "learning_records" ("userId", "activityDate") `);
        await queryRunner.query(`CREATE INDEX "IDX_607525bbde0b3ef4b482f06e18" ON "learning_records" ("userId") `);
        await queryRunner.query(`CREATE TABLE "daily_goal_logs" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "version" integer NOT NULL DEFAULT '1', "date" date NOT NULL, "completedCount" integer NOT NULL DEFAULT '0', "isGoalAchieved" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_570b358de97ce12eeec1e98dbf6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_932f1f24d079b264b2d4d79f90" ON "daily_goal_logs" ("userId", "date") `);
        await queryRunner.query(`CREATE TYPE "public"."game_sessions_gametype_enum" AS ENUM('WORD_MATCH', 'PRONUNCIATION_QUIZ', 'SPEED_READ')`);
        await queryRunner.query(`CREATE TYPE "public"."game_sessions_difficulty_enum" AS ENUM('EASY', 'MEDIUM', 'HARD')`);
        await queryRunner.query(`CREATE TABLE "game_sessions" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer NOT NULL, "gameType" "public"."game_sessions_gametype_enum" NOT NULL, "difficulty" "public"."game_sessions_difficulty_enum" NOT NULL, "correctCount" integer NOT NULL DEFAULT '0', "totalCount" integer NOT NULL DEFAULT '0', "duration" integer NOT NULL DEFAULT '0', "score" integer NOT NULL DEFAULT '0', "comboMaxStreak" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_e25fa82d55744e55000c3288fdc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1c97243c62cc3eaf5af53542a3" ON "game_sessions" ("userId", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_6fafb2f50848b51f214a1cbce2" ON "game_sessions" ("userId") `);
        await queryRunner.query(`CREATE TYPE "public"."daily_challenges_status_enum" AS ENUM('ACTIVE', 'COMPLETED')`);
        await queryRunner.query(`CREATE TABLE "daily_challenges" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "challengeDate" date NOT NULL, "status" "public"."daily_challenges_status_enum" NOT NULL DEFAULT 'ACTIVE', "scriptIds" text NOT NULL, "participantCount" integer NOT NULL DEFAULT '0', "rewardsSettled" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_bdffde6b0cd1b5933043dc38ae1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_994ccee62e6a0e11a4c94e1afa" ON "daily_challenges" ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_58ebd1e68b05ac5abb12882b0f" ON "daily_challenges" ("challengeDate") `);
        await queryRunner.query(`CREATE TABLE "challenge_participations" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "challengeId" integer NOT NULL, "userId" integer NOT NULL, "gameSessionId" integer, "correctCount" integer NOT NULL DEFAULT '0', "totalCount" integer NOT NULL DEFAULT '0', "duration" integer NOT NULL DEFAULT '0', "comboMaxStreak" integer NOT NULL DEFAULT '0', "compositeScore" integer NOT NULL DEFAULT '0', "finalRank" integer, "rewardXp" integer, CONSTRAINT "PK_0189680b469e66abe5de8cb6d8c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3ff280f2d6124ecfe44d6066ab" ON "challenge_participations" ("userId", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_a61f4a91479386266c5f534929" ON "challenge_participations" ("challengeId", "compositeScore") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fd6fe5d6b0ada750665b905e25" ON "challenge_participations" ("challengeId", "userId") `);
        await queryRunner.query(`CREATE TABLE "game_script_completions" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "scriptId" integer, "scriptTitle" character varying(500), "version" integer NOT NULL DEFAULT '1', "firstClearedAt" TIMESTAMP NOT NULL, "lastPlayedAt" TIMESTAMP NOT NULL, "playCount" integer NOT NULL DEFAULT '1', "bestAccuracy" double precision NOT NULL DEFAULT '0', "totalCorrect" integer NOT NULL DEFAULT '0', "totalWrong" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_6e9a0ffb3e33a8fb796efb55641" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_81966869c5f6560b9243fec65b" ON "game_script_completions" ("userId", "lastPlayedAt") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1aefe28d6c8b09ef2e2cff2ece" ON "game_script_completions" ("userId", "scriptId") `);
        await queryRunner.query(`CREATE TABLE "game_word_results" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "gameSessionId" integer NOT NULL, "userId" integer NOT NULL, "scriptId" integer NOT NULL, "word" character varying(100) NOT NULL, "wordIndex" integer NOT NULL, "isCorrect" boolean NOT NULL, "attempts" integer NOT NULL DEFAULT '1', "hintUsed" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_10172c6a0a0a0daf4bacce4a4b6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0fa2d8f7aef3affb32691db6b0" ON "game_word_results" ("userId", "word") `);
        await queryRunner.query(`CREATE INDEX "IDX_079c5943f54317be296ea3d180" ON "game_word_results" ("userId", "scriptId") `);
        await queryRunner.query(`CREATE INDEX "IDX_610cc26ff657d3e74e690d5ca5" ON "game_word_results" ("gameSessionId") `);
        await queryRunner.query(`CREATE TYPE "public"."xp_transactions_source_enum" AS ENUM('ASSESSMENT', 'GAME', 'DAILY_GOAL', 'STREAK_BONUS', 'CHALLENGE')`);
        await queryRunner.query(`CREATE TABLE "xp_transactions" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer NOT NULL, "amount" integer NOT NULL, "source" "public"."xp_transactions_source_enum" NOT NULL, "referenceId" integer, "description" text, CONSTRAINT "PK_143e97bb9eccbc09ac6a341f2cc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2206c7835f80cebb5ae11178fa" ON "xp_transactions" ("userId", "source", "referenceId") WHERE "referenceId" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_91e766ef0647533cdc44628d50" ON "xp_transactions" ("userId", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_0c00e30c10daa7e964c6220672" ON "xp_transactions" ("userId") `);
        await queryRunner.query(`CREATE TABLE "user_levels" ("id" SERIAL NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer NOT NULL, "version" integer NOT NULL DEFAULT '1', "level" integer NOT NULL DEFAULT '1', "totalXp" integer NOT NULL DEFAULT '0', "lastSeenLevel" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_27517134ee9bccf5427621978ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_824fc8fd8bb94765661a1be549" ON "user_levels" ("userId") `);
        await queryRunner.query(`CREATE TYPE "public"."badges_category_enum" AS ENUM('STREAK', 'SCORE', 'COUNT', 'LEVEL', 'SPECIAL')`);
        await queryRunner.query(`CREATE TABLE "badges" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "code" character varying(50) NOT NULL, "title" character varying(100) NOT NULL, "description" text NOT NULL, "iconName" character varying(100) NOT NULL, "category" "public"."badges_category_enum" NOT NULL, "condition" text NOT NULL, "orderIndex" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_48fe47e292737e09162b08c4f7c" UNIQUE ("code"), CONSTRAINT "PK_8a651318b8de577e8e217676466" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_badges" ("id" SERIAL NOT NULL, "unlockedAt" TIMESTAMP NOT NULL DEFAULT now(), "seenAt" TIMESTAMP, "userId" integer NOT NULL, "badgeId" integer NOT NULL, CONSTRAINT "PK_0ca139216824d745a930065706a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_76e9ac35f4d56715c688a345fe" ON "user_badges" ("userId", "badgeId") `);
        await queryRunner.query(`CREATE TABLE "game_configs" ("id" SERIAL NOT NULL, "key" character varying(100) NOT NULL, "value" text NOT NULL, "description" text NOT NULL, "category" character varying(50) NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedBy" integer, CONSTRAINT "UQ_944f485adb861a0baee12def6f4" UNIQUE ("key"), CONSTRAINT "PK_7d7ef60da2cd850d7676c290dcf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8bc4caf80829becb7c0ee34567" ON "game_configs" ("category") `);
        await queryRunner.query(`CREATE TABLE "game_config_history" ("id" SERIAL NOT NULL, "configId" integer NOT NULL, "key" character varying(100) NOT NULL, "oldValue" text, "newValue" text NOT NULL, "changedBy" integer NOT NULL, "changedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3c13e5defe44bfd4c9bc2e4d925" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cc1f0760ee2e0c670fc59f88e5" ON "game_config_history" ("changedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_483ef0dc233ac06db0642f35e4" ON "game_config_history" ("configId") `);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_1a9d263435754abceefe5130b5f" FOREIGN KEY ("scriptId") REFERENCES "scripts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_a6aab0d30090866bb9cc0c61c72" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessment_analysis_logs" ADD CONSTRAINT "FK_b151d856cd8846dff3433b83e27" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scripts" ADD CONSTRAINT "FK_8c2e4b4edafb535b54f872f1fc6" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_goal_logs" ADD CONSTRAINT "FK_a5f2cc3c69577e9b6199a633aa4" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "learning_records" ADD CONSTRAINT "FK_607525bbde0b3ef4b482f06e188" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "daily_goal_logs" ADD CONSTRAINT "FK_23323dcd339d63379880406fbfe" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "game_sessions" ADD CONSTRAINT "FK_6fafb2f50848b51f214a1cbce2f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "challenge_participations" ADD CONSTRAINT "FK_0acc4946500104abe9b62c4d088" FOREIGN KEY ("challengeId") REFERENCES "daily_challenges"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "challenge_participations" ADD CONSTRAINT "FK_aad195a4744629c3acbe6fad106" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "challenge_participations" ADD CONSTRAINT "FK_92cdb005399b27354dbf2451946" FOREIGN KEY ("gameSessionId") REFERENCES "game_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "game_script_completions" ADD CONSTRAINT "FK_33499fffec4306956a95278fd7b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "game_script_completions" ADD CONSTRAINT "FK_3a9f2d2a340fb0ccd9c404ba26c" FOREIGN KEY ("scriptId") REFERENCES "scripts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "game_word_results" ADD CONSTRAINT "FK_610cc26ff657d3e74e690d5ca5f" FOREIGN KEY ("gameSessionId") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "game_word_results" ADD CONSTRAINT "FK_bc41c557b2b93c565ba4b5355f5" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "xp_transactions" ADD CONSTRAINT "FK_0c00e30c10daa7e964c62206729" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_levels" ADD CONSTRAINT "FK_824fc8fd8bb94765661a1be549b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_badges" ADD CONSTRAINT "FK_7043fd1cb64ec3f5ebdb878966c" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_badges" ADD CONSTRAINT "FK_bd34ef334baea6f589a53438a1e" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        // === Seed: badges (15개) ===
        await queryRunner.query(`
            INSERT INTO "badges" ("code", "title", "description", "iconName", "category", "condition", "orderIndex") VALUES
            ('STREAK_3',  '꾸준한 시작',     '3일 연속 학습 달성',         'flame',            'STREAK',  '{"type":"streak","value":3}',  1),
            ('STREAK_7',  '일주일 연속',     '7일 연속 학습 달성',         'fire',             'STREAK',  '{"type":"streak","value":7}',  2),
            ('STREAK_14', '2주 마라톤',      '14일 연속 학습 달성',        'running',          'STREAK',  '{"type":"streak","value":14}', 3),
            ('STREAK_30', '한 달 챌린저',    '30일 연속 학습 달성',        'medal',            'STREAK',  '{"type":"streak","value":30}', 4),
            ('SCORE_80',  '우수한 발음',     '발음 진단 80점 이상 달성',   'star',             'SCORE',   '{"type":"score","value":80}',  10),
            ('SCORE_90',  '뛰어난 발음',     '발음 진단 90점 이상 달성',   'star-half',        'SCORE',   '{"type":"score","value":90}',  11),
            ('SCORE_95',  '완벽한 발음',     '발음 진단 95점 이상 달성',   'trophy',           'SCORE',   '{"type":"score","value":95}',  12),
            ('COUNT_1',   '첫 걸음',         '첫 번째 발음 진단 완료',     'footsteps',        'COUNT',   '{"type":"count","value":1}',   20),
            ('COUNT_10',  '열 번의 도전',    '발음 진단 10회 완료',        'repeat',           'COUNT',   '{"type":"count","value":10}',  21),
            ('COUNT_50',  '반백 달성',       '발음 진단 50회 완료',        'ribbon',           'COUNT',   '{"type":"count","value":50}',  22),
            ('COUNT_100', '백전백승',        '발음 진단 100회 완료',       'shield-checkmark', 'COUNT',   '{"type":"count","value":100}', 23),
            ('LEVEL_5',   '레벨 5 달성',     '레벨 5에 도달했습니다',      'arrow-up-circle',  'LEVEL',   '{"type":"level","value":5}',   30),
            ('LEVEL_10',  '레벨 10 달성',    '레벨 10에 도달했습니다',     'trending-up',      'LEVEL',   '{"type":"level","value":10}',  31),
            ('LEVEL_20',  '레벨 20 달성',    '레벨 20에 도달했습니다',     'rocket',           'LEVEL',   '{"type":"level","value":20}',  32),
            ('LEVEL_50',  '최고 레벨 달성',  '최고 레벨에 도달했습니다',   'diamond',          'LEVEL',   '{"type":"level","value":50}',  33)
            ON CONFLICT ("code") DO NOTHING
        `);

        // === Seed: game_configs (24개) ===
        await queryRunner.query(`
            INSERT INTO "game_configs" ("key", "value", "category", "description") VALUES
            ('xp.game.firstClear',                    '20',                              'xp',       '구절 최초 클리어 시 기본 XP'),
            ('xp.game.repeat',                        '5',                               'xp',       '이미 클리어한 구절 재도전 시 XP'),
            ('xp.game.perfectBonus',                  '10',                              'xp',       '오답 0 퍼펙트 클리어 보너스'),
            ('xp.game.reviewBonus',                   '15',                              'xp',       '3일 이후 복습 보너스 XP'),
            ('xp.game.reviewCooldownDays',            '3',                               'xp',       '복습 보너스 재발동 쿨다운 (일)'),
            ('xp.game.sessionCap',                    '60',                              'xp',       '게임 세션당 최대 획득 XP (인플레이션 방지)'),
            ('xp.assessment.base',                    '50',                              'xp',       '낭독 완료 시 기본 XP'),
            ('xp.assessment.highScoreThreshold',      '90',                              'xp',       '높은 점수 보너스 기준'),
            ('xp.assessment.highScoreBonus',          '25',                              'xp',       '높은 점수 보너스 XP'),
            ('xp.dailyGoal.achieved',                 '20',                              'xp',       '일일 목표 달성 XP'),
            ('xp.overtime.enabled',                   'true',                            'xp',       '일일 목표 초과 시 열공 보너스 활성화'),
            ('xp.overtime.multiplier',                '1.2',                             'xp',       '열공 보너스 배율'),
            ('xp.combo.multipliers',                  '[1.0,1.2,1.5,2.0]',              'combo',    '콤보 단계별 배율 (0~3+ 연속 정답)'),
            ('xp.combo.resetOnWrong',                 'true',                            'combo',    '오답 시 콤보 리셋 여부'),
            ('game.todayFirstRatio',                  '0.7',                             'game',     '워드게임에서 당일 학습 구절 비율 (70%)'),
            ('game.adaptiveDifficulty.enabled',       'true',                            'game',     '적응형 난이도 활성화 여부'),
            ('game.adaptiveDifficulty.highScoreThreshold', '85',                         'game',     '빈칸 확대 기준 낭독 점수'),
            ('game.adaptiveDifficulty.highScoreBlanks',    '{"min":5,"max":8}',          'game',     '고점수 구절 빈칸 범위'),
            ('game.adaptiveDifficulty.lowScoreBlanks',     '{"min":1,"max":3}',          'game',     '저점수 구절 빈칸 범위 (핵심 단어 위주)'),
            ('hint.maxPerSentence',                   '2',                               'hint',     '문장당 최대 힌트 사용 횟수'),
            ('hint.xpPenalty',                        '5',                               'hint',     '힌트 사용 시 XP 감소량'),
            ('hint.types',                            '["firstLetter","translation","audio"]', 'hint', '사용 가능한 힌트 타입'),
            ('hint.autoShowAfterWrong',               '2',                               'hint',     'N회 연속 오답 시 자동 힌트 표시'),
            ('bundle.size',                           '5',                               'learning', '번들당 구절 수 (챕터 내 해금 단위)'),
            ('bundle.completionCelebration',          'true',                            'learning', '번들 완료 시 축하 UI 표시 여부')
            ON CONFLICT ("key") DO NOTHING
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_badges" DROP CONSTRAINT "FK_bd34ef334baea6f589a53438a1e"`);
        await queryRunner.query(`ALTER TABLE "user_badges" DROP CONSTRAINT "FK_7043fd1cb64ec3f5ebdb878966c"`);
        await queryRunner.query(`ALTER TABLE "user_levels" DROP CONSTRAINT "FK_824fc8fd8bb94765661a1be549b"`);
        await queryRunner.query(`ALTER TABLE "xp_transactions" DROP CONSTRAINT "FK_0c00e30c10daa7e964c62206729"`);
        await queryRunner.query(`ALTER TABLE "game_word_results" DROP CONSTRAINT "FK_bc41c557b2b93c565ba4b5355f5"`);
        await queryRunner.query(`ALTER TABLE "game_word_results" DROP CONSTRAINT "FK_610cc26ff657d3e74e690d5ca5f"`);
        await queryRunner.query(`ALTER TABLE "game_script_completions" DROP CONSTRAINT "FK_3a9f2d2a340fb0ccd9c404ba26c"`);
        await queryRunner.query(`ALTER TABLE "game_script_completions" DROP CONSTRAINT "FK_33499fffec4306956a95278fd7b"`);
        await queryRunner.query(`ALTER TABLE "challenge_participations" DROP CONSTRAINT "FK_92cdb005399b27354dbf2451946"`);
        await queryRunner.query(`ALTER TABLE "challenge_participations" DROP CONSTRAINT "FK_aad195a4744629c3acbe6fad106"`);
        await queryRunner.query(`ALTER TABLE "challenge_participations" DROP CONSTRAINT "FK_0acc4946500104abe9b62c4d088"`);
        await queryRunner.query(`ALTER TABLE "game_sessions" DROP CONSTRAINT "FK_6fafb2f50848b51f214a1cbce2f"`);
        await queryRunner.query(`ALTER TABLE "daily_goal_logs" DROP CONSTRAINT "FK_23323dcd339d63379880406fbfe"`);
        await queryRunner.query(`ALTER TABLE "learning_records" DROP CONSTRAINT "FK_607525bbde0b3ef4b482f06e188"`);
        await queryRunner.query(`ALTER TABLE "user_goal_logs" DROP CONSTRAINT "FK_a5f2cc3c69577e9b6199a633aa4"`);
        await queryRunner.query(`ALTER TABLE "scripts" DROP CONSTRAINT "FK_8c2e4b4edafb535b54f872f1fc6"`);
        await queryRunner.query(`ALTER TABLE "assessment_analysis_logs" DROP CONSTRAINT "FK_b151d856cd8846dff3433b83e27"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_a6aab0d30090866bb9cc0c61c72"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_1a9d263435754abceefe5130b5f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_483ef0dc233ac06db0642f35e4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cc1f0760ee2e0c670fc59f88e5"`);
        await queryRunner.query(`DROP TABLE "game_config_history"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8bc4caf80829becb7c0ee34567"`);
        await queryRunner.query(`DROP TABLE "game_configs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_76e9ac35f4d56715c688a345fe"`);
        await queryRunner.query(`DROP TABLE "user_badges"`);
        await queryRunner.query(`DROP TABLE "badges"`);
        await queryRunner.query(`DROP TYPE "public"."badges_category_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_824fc8fd8bb94765661a1be549"`);
        await queryRunner.query(`DROP TABLE "user_levels"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0c00e30c10daa7e964c6220672"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_91e766ef0647533cdc44628d50"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2206c7835f80cebb5ae11178fa"`);
        await queryRunner.query(`DROP TABLE "xp_transactions"`);
        await queryRunner.query(`DROP TYPE "public"."xp_transactions_source_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_610cc26ff657d3e74e690d5ca5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_079c5943f54317be296ea3d180"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0fa2d8f7aef3affb32691db6b0"`);
        await queryRunner.query(`DROP TABLE "game_word_results"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1aefe28d6c8b09ef2e2cff2ece"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_81966869c5f6560b9243fec65b"`);
        await queryRunner.query(`DROP TABLE "game_script_completions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fd6fe5d6b0ada750665b905e25"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a61f4a91479386266c5f534929"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3ff280f2d6124ecfe44d6066ab"`);
        await queryRunner.query(`DROP TABLE "challenge_participations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_58ebd1e68b05ac5abb12882b0f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_994ccee62e6a0e11a4c94e1afa"`);
        await queryRunner.query(`DROP TABLE "daily_challenges"`);
        await queryRunner.query(`DROP TYPE "public"."daily_challenges_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6fafb2f50848b51f214a1cbce2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1c97243c62cc3eaf5af53542a3"`);
        await queryRunner.query(`DROP TABLE "game_sessions"`);
        await queryRunner.query(`DROP TYPE "public"."game_sessions_difficulty_enum"`);
        await queryRunner.query(`DROP TYPE "public"."game_sessions_gametype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_932f1f24d079b264b2d4d79f90"`);
        await queryRunner.query(`DROP TABLE "daily_goal_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_607525bbde0b3ef4b482f06e18"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_311dea598b319bdf2a88b3da59"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ea6960e0cbda54c6ab5dc73db9"`);
        await queryRunner.query(`DROP TABLE "learning_records"`);
        await queryRunner.query(`DROP TYPE "public"."learning_records_activitytype_enum"`);
        await queryRunner.query(`DROP TABLE "content_versions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d348e06bb339e4439d60b1480d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_feb65e9636ac2c4e59a863c3a3"`);
        await queryRunner.query(`DROP TABLE "notification_logs"`);
        await queryRunner.query(`DROP TYPE "public"."notification_logs_status_enum"`);
        await queryRunner.query(`DROP TABLE "user_goal_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a75adede33d7f70f760badb811"`);
        await queryRunner.query(`DROP TABLE "chapters"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_263f9a129ffbb860b5e3f40559"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9ee6c1bfbd7c97f5f6eba92646"`);
        await queryRunner.query(`DROP TABLE "scripts"`);
        await queryRunner.query(`DROP TYPE "public"."scripts_articulationplace_enum"`);
        await queryRunner.query(`DROP TYPE "public"."scripts_difficulty_enum"`);
        await queryRunner.query(`DROP TABLE "assessment_analysis_logs"`);
        await queryRunner.query(`DROP TYPE "public"."assessment_analysis_logs_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a6aab0d30090866bb9cc0c61c7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_18904497714587c1df720c5a8e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5b842a1a16b55c8fa677fd4510"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bbf68572b4a189540acc419516"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f6957bb44a54ff23b7e4ef0158"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4de7612d07afc379079d68fc0e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ed8dd3a7f6658ea6855ffa0645"`);
        await queryRunner.query(`DROP TABLE "assessments"`);
        await queryRunner.query(`DROP TYPE "public"."assessments_status_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
