/**
 * GameConfig 시드 데이터 — PRD-006 섹션 2.1의 22개 기본 규칙
 */
export const GAME_CONFIG_SEEDS = [
    // ===== XP 카테고리 =====
    {
        key: "xp.game.firstClear",
        value: 20,
        category: "xp",
        description: "구절 최초 클리어 시 기본 XP",
    },
    {
        key: "xp.game.repeat",
        value: 5,
        category: "xp",
        description: "이미 클리어한 구절 재도전 시 XP",
    },
    {
        key: "xp.game.perfectBonus",
        value: 10,
        category: "xp",
        description: "오답 0 퍼펙트 클리어 보너스",
    },
    {
        key: "xp.game.reviewBonus",
        value: 15,
        category: "xp",
        description: "3일 이후 복습 보너스 XP",
    },
    {
        key: "xp.game.reviewCooldownDays",
        value: 3,
        category: "xp",
        description: "복습 보너스 재발동 쿨다운 (일)",
    },
    {
        key: "xp.game.sessionCap",
        value: 60,
        category: "xp",
        description: "게임 세션당 최대 획득 XP (인플레이션 방지)",
    },
    {
        key: "xp.assessment.base",
        value: 50,
        category: "xp",
        description: "낭독 완료 시 기본 XP",
    },
    {
        key: "xp.assessment.highScoreThreshold",
        value: 90,
        category: "xp",
        description: "높은 점수 보너스 기준",
    },
    {
        key: "xp.assessment.highScoreBonus",
        value: 25,
        category: "xp",
        description: "높은 점수 보너스 XP",
    },
    {
        key: "xp.dailyGoal.achieved",
        value: 20,
        category: "xp",
        description: "일일 목표 달성 XP",
    },
    {
        key: "xp.overtime.enabled",
        value: true,
        category: "xp",
        description: "일일 목표 초과 시 열공 보너스 활성화",
    },
    {
        key: "xp.overtime.multiplier",
        value: 1.2,
        category: "xp",
        description: "열공 보너스 배율",
    },

    // ===== COMBO 카테고리 =====
    {
        key: "xp.combo.multipliers",
        value: [1.0, 1.2, 1.5, 2.0],
        category: "combo",
        description: "콤보 단계별 배율 (0~3+ 연속 정답)",
    },
    {
        key: "xp.combo.resetOnWrong",
        value: true,
        category: "combo",
        description: "오답 시 콤보 리셋 여부",
    },

    // ===== GAME 카테고리 =====
    {
        key: "game.todayFirstRatio",
        value: 0.7,
        category: "game",
        description: "워드게임에서 당일 학습 구절 비율 (70%)",
    },
    {
        key: "game.adaptiveDifficulty.enabled",
        value: true,
        category: "game",
        description: "적응형 난이도 활성화 여부",
    },
    {
        key: "game.adaptiveDifficulty.highScoreThreshold",
        value: 85,
        category: "game",
        description: "빈칸 확대 기준 낭독 점수",
    },
    {
        key: "game.adaptiveDifficulty.highScoreBlanks",
        value: { min: 5, max: 8 },
        category: "game",
        description: "고점수 구절 빈칸 범위",
    },
    {
        key: "game.adaptiveDifficulty.lowScoreBlanks",
        value: { min: 1, max: 3 },
        category: "game",
        description: "저점수 구절 빈칸 범위 (핵심 단어 위주)",
    },

    // ===== HINT 카테고리 =====
    {
        key: "hint.maxPerSentence",
        value: 2,
        category: "hint",
        description: "문장당 최대 힌트 사용 횟수",
    },
    {
        key: "hint.xpPenalty",
        value: 5,
        category: "hint",
        description: "힌트 사용 시 XP 감소량",
    },
    {
        key: "hint.types",
        value: ["firstLetter", "translation", "audio"],
        category: "hint",
        description: "사용 가능한 힌트 타입",
    },
    {
        key: "hint.autoShowAfterWrong",
        value: 2,
        category: "hint",
        description: "N회 연속 오답 시 자동 힌트 표시",
    },

    // ===== LEARNING 카테고리 =====
    {
        key: "bundle.size",
        value: 5,
        category: "learning",
        description: "번들당 구절 수 (챕터 내 해금 단위)",
    },
    {
        key: "bundle.completionCelebration",
        value: true,
        category: "learning",
        description: "번들 완료 시 축하 UI 표시 여부",
    },
]
