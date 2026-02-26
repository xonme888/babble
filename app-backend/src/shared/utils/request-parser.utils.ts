/**
 * 요청 파라미터 파싱 유틸리티
 */

/**
 * 문자열을 정수로 파싱, 실패 시 기본값 반환
 * @param min 최소값 (기본 0) — 음수 offset/limit 방어
 */
export function parseIntOrDefault(value: string | undefined, defaultValue: number, min = 0): number {
    if (!value) return defaultValue
    const parsed = parseInt(value, 10)
    return isNaN(parsed) ? defaultValue : Math.max(min, parsed)
}

import { MAX_PAGE_LIMIT, DEFAULT_PAGE_LIMIT } from "@shared/core/constants/pagination.constants"

/**
 * 페이지네이션 limit/offset을 파싱하고 MAX_PAGE_LIMIT 보호를 적용
 */
export function parsePaginationParams(
    query: { limit?: string; offset?: string },
    defaultLimit: number = DEFAULT_PAGE_LIMIT
): { limit: number; offset: number } {
    const limit = Math.min(parseIntOrDefault(query.limit, defaultLimit), MAX_PAGE_LIMIT)
    const offset = parseIntOrDefault(query.offset, 0)
    return { limit, offset }
}

/**
 * 문자열을 정수로 파싱, 실패 시 null 반환
 */
export function parseRequiredInt(value: string | undefined): number | null {
    if (!value) return null
    const parsed = parseInt(value, 10)
    return isNaN(parsed) ? null : parsed
}

/**
 * 쿼리 파라미터를 enum 값으로 파싱, 유효하지 않으면 undefined 반환
 * enum 화이트리스트 검증 — 정의되지 않은 값의 서비스 전파 방지
 */
export function parseEnumParam<T extends Record<string, string>>(
    value: unknown,
    enumObj: T
): T[keyof T] | undefined {
    if (typeof value !== "string" || !value) return undefined
    const values = Object.values(enumObj) as string[]
    return values.includes(value) ? (value as T[keyof T]) : undefined
}
