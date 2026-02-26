import { BadgeCategory } from "../../domain/badge.entity"

/**
 * 뱃지 시드 데이터 — 15개 기본 뱃지
 */
export const BADGE_SEEDS = [
    // ===== STREAK 카테고리 =====
    {
        code: "STREAK_3",
        title: "꾸준한 시작",
        description: "3일 연속 학습 달성",
        iconName: "flame",
        category: BadgeCategory.STREAK,
        condition: { type: "streak", value: 3 },
        orderIndex: 1,
    },
    {
        code: "STREAK_7",
        title: "일주일 연속",
        description: "7일 연속 학습 달성",
        iconName: "fire",
        category: BadgeCategory.STREAK,
        condition: { type: "streak", value: 7 },
        orderIndex: 2,
    },
    {
        code: "STREAK_14",
        title: "2주 마라톤",
        description: "14일 연속 학습 달성",
        iconName: "running",
        category: BadgeCategory.STREAK,
        condition: { type: "streak", value: 14 },
        orderIndex: 3,
    },
    {
        code: "STREAK_30",
        title: "한 달 챌린저",
        description: "30일 연속 학습 달성",
        iconName: "medal",
        category: BadgeCategory.STREAK,
        condition: { type: "streak", value: 30 },
        orderIndex: 4,
    },

    // ===== SCORE 카테고리 =====
    {
        code: "SCORE_80",
        title: "우수한 발음",
        description: "발음 진단 80점 이상 달성",
        iconName: "star",
        category: BadgeCategory.SCORE,
        condition: { type: "score", value: 80 },
        orderIndex: 10,
    },
    {
        code: "SCORE_90",
        title: "뛰어난 발음",
        description: "발음 진단 90점 이상 달성",
        iconName: "star-half",
        category: BadgeCategory.SCORE,
        condition: { type: "score", value: 90 },
        orderIndex: 11,
    },
    {
        code: "SCORE_95",
        title: "완벽한 발음",
        description: "발음 진단 95점 이상 달성",
        iconName: "trophy",
        category: BadgeCategory.SCORE,
        condition: { type: "score", value: 95 },
        orderIndex: 12,
    },

    // ===== COUNT 카테고리 =====
    {
        code: "COUNT_1",
        title: "첫 걸음",
        description: "첫 번째 발음 진단 완료",
        iconName: "footsteps",
        category: BadgeCategory.COUNT,
        condition: { type: "count", value: 1 },
        orderIndex: 20,
    },
    {
        code: "COUNT_10",
        title: "열 번의 도전",
        description: "발음 진단 10회 완료",
        iconName: "repeat",
        category: BadgeCategory.COUNT,
        condition: { type: "count", value: 10 },
        orderIndex: 21,
    },
    {
        code: "COUNT_50",
        title: "반백 달성",
        description: "발음 진단 50회 완료",
        iconName: "ribbon",
        category: BadgeCategory.COUNT,
        condition: { type: "count", value: 50 },
        orderIndex: 22,
    },
    {
        code: "COUNT_100",
        title: "백전백승",
        description: "발음 진단 100회 완료",
        iconName: "shield-checkmark",
        category: BadgeCategory.COUNT,
        condition: { type: "count", value: 100 },
        orderIndex: 23,
    },

    // ===== LEVEL 카테고리 =====
    {
        code: "LEVEL_5",
        title: "레벨 5 달성",
        description: "레벨 5에 도달했습니다",
        iconName: "arrow-up-circle",
        category: BadgeCategory.LEVEL,
        condition: { type: "level", value: 5 },
        orderIndex: 30,
    },
    {
        code: "LEVEL_10",
        title: "레벨 10 달성",
        description: "레벨 10에 도달했습니다",
        iconName: "trending-up",
        category: BadgeCategory.LEVEL,
        condition: { type: "level", value: 10 },
        orderIndex: 31,
    },
    {
        code: "LEVEL_20",
        title: "레벨 20 달성",
        description: "레벨 20에 도달했습니다",
        iconName: "rocket",
        category: BadgeCategory.LEVEL,
        condition: { type: "level", value: 20 },
        orderIndex: 32,
    },
    {
        code: "LEVEL_50",
        title: "최고 레벨 달성",
        description: "최고 레벨에 도달했습니다",
        iconName: "diamond",
        category: BadgeCategory.LEVEL,
        condition: { type: "level", value: 50 },
        orderIndex: 33,
    },
]
