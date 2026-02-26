/**
 * Offset 기반 페이지네이션 결과 (관리자 웹 — 페이지 번호 방식)
 * Controller에서 limit/offset을 추가하여 API 응답으로 변환한다.
 */
export interface PaginatedResult<T> {
    items: T[]
    total: number
}

/**
 * Cursor 기반 페이지네이션 결과 (모바일 — 무한 스크롤 방식)
 * nextCursor가 null이면 마지막 페이지이다.
 */
export interface CursorPaginatedResult<T> {
    items: T[]
    nextCursor: string | null
    hasMore: boolean
}
