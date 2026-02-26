import { FindManyOptions, Repository, ObjectLiteral } from "typeorm"
import { PaginatedResult, CursorPaginatedResult } from "@shared/core/pagination.interface"
import { ValidationException } from "@shared/core/exceptions/domain-exceptions"

export async function paginate<T extends ObjectLiteral>(
    repo: Repository<T>,
    options: FindManyOptions<T>,
    limit: number,
    offset: number
): Promise<PaginatedResult<T>> {
    const [items, total] = await repo.findAndCount({
        ...options,
        take: limit,
        skip: offset,
    })
    return { items, total }
}

interface CursorPayload {
    id: number
    createdAt: string
}

export function decodeCursor(cursor: string): CursorPayload {
    try {
        const decoded = Buffer.from(cursor, "base64url").toString("utf-8")
        return JSON.parse(decoded)
    } catch {
        throw new ValidationException("pagination.invalid_cursor")
    }
}

export function encodeCursor(id: number, createdAt: Date): string {
    const payload: CursorPayload = { id, createdAt: createdAt.toISOString() }
    return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

export interface CursorPaginateOptions<T extends ObjectLiteral> {
    repo: Repository<T>
    limit: number
    cursor?: string
    where?: FindManyOptions<T>["where"]
    relations?: string[]
    order?: "ASC" | "DESC"
}

/**
 * Cursor 기반 페이지네이션 헬퍼 (모바일 — 무한 스크롤 방식)
 *
 * createdAt + id를 복합 커서로 사용하여 안정적인 페이지네이션을 제공한다.
 * - 데이터 추가/삭제 시에도 중복/누락 없음
 * - 대용량 데이터에서 offset skip 없이 인덱스 기반 탐색
 *
 * 엔티티에 `id: number`와 `createdAt: Date` 필드가 필수이다.
 */
export async function cursorPaginate<T extends ObjectLiteral>(
    options: CursorPaginateOptions<T>
): Promise<CursorPaginatedResult<T>> {
    const { repo, limit, cursor, where, relations, order = "DESC" } = options
    const isDesc = order === "DESC"

    // limit + 1개를 조회하여 hasMore를 판별한다
    const queryBuilder = repo.createQueryBuilder("entity")

    // where 조건 적용
    if (where) {
        if (Array.isArray(where)) {
            // OR 조건 배열은 지원하지 않음 — 단일 조건만 사용
            queryBuilder.where(where[0])
        } else {
            queryBuilder.where(where)
        }
    }

    // relations 적용
    if (relations) {
        for (const relation of relations) {
            queryBuilder.leftJoinAndSelect(`entity.${relation}`, relation)
        }
    }

    // cursor 조건 — createdAt + id 복합 비교
    if (cursor) {
        const { id: cursorId, createdAt: cursorCreatedAt } = decodeCursor(cursor)
        if (isDesc) {
            queryBuilder.andWhere(
                `(entity.createdAt < :cursorDate OR (entity.createdAt = :cursorDate AND entity.id < :cursorId))`,
                { cursorDate: cursorCreatedAt, cursorId }
            )
        } else {
            queryBuilder.andWhere(
                `(entity.createdAt > :cursorDate OR (entity.createdAt = :cursorDate AND entity.id > :cursorId))`,
                { cursorDate: cursorCreatedAt, cursorId }
            )
        }
    }

    // 정렬 + limit + 1
    queryBuilder
        .orderBy("entity.createdAt", isDesc ? "DESC" : "ASC")
        .addOrderBy("entity.id", isDesc ? "DESC" : "ASC")
        .take(limit + 1)

    const results = await queryBuilder.getMany()

    // hasMore 판별: limit+1개가 반환되면 다음 페이지 존재
    const hasMore = results.length > limit
    const items = hasMore ? results.slice(0, limit) : results

    // nextCursor 생성: 마지막 아이템의 id + createdAt
    let nextCursor: string | null = null
    if (hasMore && items.length > 0) {
        const lastItem = items[items.length - 1] as T & { id: number; createdAt: Date }
        nextCursor = encodeCursor(lastItem.id, lastItem.createdAt)
    }

    return { items, nextCursor, hasMore }
}
