/**
 * Rate Limit 정책 정의
 *
 * 각 액션별 최대 시도 횟수와 시간 윈도우를 중앙 관리한다.
 * RateLimitService에서 import하여 사용한다.
 */
import {
    GUEST_TOKEN_RATE_LIMIT,
} from "@features/assessment/domain/guest-trial-policy"

/** Rate Limiting 정책 인터페이스 */
export interface RateLimitPolicy {
    maxAttempts: number // 최대 시도 횟수
    windowSeconds: number // 시간 윈도우 (초)
}

/** 기본 Rate Limit 정책 맵 */
export const RATE_LIMIT_POLICIES: Record<string, RateLimitPolicy> = {
    "email-check": { maxAttempts: 5, windowSeconds: 300 }, // 5분에 5회
    "verification-resend": { maxAttempts: 3, windowSeconds: 300 }, // 5분에 3회
    "login-attempt": { maxAttempts: 5, windowSeconds: 900 }, // 15분에 5회
    registration: { maxAttempts: 3, windowSeconds: 600 }, // 10분에 3회
    "email-verification": { maxAttempts: 5, windowSeconds: 300 }, // 5분에 5회
    "password-reset-request": { maxAttempts: 3, windowSeconds: 600 }, // 10분에 3회
    "password-reset": { maxAttempts: 5, windowSeconds: 300 }, // 5분에 5회
    "token-refresh": { maxAttempts: 10, windowSeconds: 300 }, // 5분에 10회
    logout: { maxAttempts: 5, windowSeconds: 300 }, // 5분에 5회
    "game-config-read": { maxAttempts: 30, windowSeconds: 60 }, // 1분에 30회
    "game-config-update": { maxAttempts: 10, windowSeconds: 60 }, // 1분에 10회
    "word-game-today": { maxAttempts: 20, windowSeconds: 60 }, // 1분에 20회
    "weak-scripts": { maxAttempts: 10, windowSeconds: 60 }, // 1분에 10회
    "assessment-upload": { maxAttempts: 10, windowSeconds: 60 }, // 1분에 10회 (파일 업로드)
    "assessment-retry": { maxAttempts: 5, windowSeconds: 60 }, // 1분에 5회 (분석 재시도)
    "script-public-read": { maxAttempts: 60, windowSeconds: 60 }, // 1분에 60회 (비인증 공개 조회)
    "password-change": { maxAttempts: 3, windowSeconds: 600 }, // 10분에 3회 (비밀번호 변경)
    "account-withdraw": { maxAttempts: 2, windowSeconds: 3600 }, // 1시간에 2회 (회원 탈퇴)
    "gamification-read": { maxAttempts: 30, windowSeconds: 60 }, // 1분에 30회 (게임화 조회)
    "learning-record-read": { maxAttempts: 30, windowSeconds: 60 }, // 1분에 30회 (학습 기록 조회)
    "guest-token": GUEST_TOKEN_RATE_LIMIT,
    "diary-upload": { maxAttempts: 10, windowSeconds: 60 }, // 1분에 10회 (음성 일기 업로드)
    "diary-read": { maxAttempts: 30, windowSeconds: 60 }, // 1분에 30회 (음성 일기 조회)
    "diary-analyze": { maxAttempts: 5, windowSeconds: 60 }, // 1분에 5회 (AI 분석 요청)
    "family-read": { maxAttempts: 30, windowSeconds: 60 }, // 1분에 30회 (가족 조회)
    "family-write": { maxAttempts: 10, windowSeconds: 60 }, // 1분에 10회 (가족 초대/연결)
    "difficulty-read": { maxAttempts: 30, windowSeconds: 60 }, // 1분에 30회 (난이도 조회)
}
