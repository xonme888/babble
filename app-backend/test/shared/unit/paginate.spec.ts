import { paginate, cursorPaginate, encodeCursor, decodeCursor } from "@shared/infra/persistence/paginate"
import type { Repository, SelectQueryBuilder } from "typeorm"

// ==================== Offset 기반 페이지네이션 ====================

describe("paginate (offset 기반 페이지네이션 헬퍼)", () => {
    function createMockRepo(items: unknown[], total: number) {
        return {
            findAndCount: jest.fn().mockResolvedValue([items, total]),
        } as unknown as jest.Mocked<Repository<{ id: number }>>
    }

    it("items와 total을 반환한다", async () => {
        // Given
        const items = [{ id: 1 }, { id: 2 }]
        const repo = createMockRepo(items, 5)

        // When
        const result = await paginate(repo, { order: { id: "ASC" } }, 2, 0)

        // Then
        expect(result).toEqual({ items, total: 5 })
    })

    it("limit과 offset을 findAndCount에 전달한다", async () => {
        // Given
        const repo = createMockRepo([], 0)

        // When
        await paginate(repo, { where: { userId: 1 } }, 10, 20)

        // Then
        expect(repo.findAndCount).toHaveBeenCalledWith({
            where: { userId: 1 },
            take: 10,
            skip: 20,
        })
    })

    it("빈 결과를 처리한다", async () => {
        // Given
        const repo = createMockRepo([], 0)

        // When
        const result = await paginate(repo, {}, 10, 0)

        // Then
        expect(result).toEqual({ items: [], total: 0 })
    })

    it("추가 옵션(relations, order)을 함께 전달한다", async () => {
        // Given
        const repo = createMockRepo([{ id: 1 }], 1)
        const options = {
            where: { userId: 1 },
            relations: ["script"],
            order: { createdAt: "DESC" as const },
        }

        // When
        await paginate(repo, options, 5, 0)

        // Then
        expect(repo.findAndCount).toHaveBeenCalledWith({
            ...options,
            take: 5,
            skip: 0,
        })
    })
})

// ==================== Cursor 인코딩/디코딩 ====================

describe("encodeCursor / decodeCursor (커서 인코딩)", () => {
    it("인코딩 후 디코딩하면 원본 값을 복원한다", () => {
        // Given
        const id = 42
        const createdAt = new Date("2026-01-15T10:30:00.000Z")

        // When
        const cursor = encodeCursor(id, createdAt)
        const decoded = decodeCursor(cursor)

        // Then
        expect(decoded.id).toBe(42)
        expect(decoded.createdAt).toBe("2026-01-15T10:30:00.000Z")
    })

    it("cursor는 URL-safe base64 문자열이다", () => {
        const cursor = encodeCursor(1, new Date())
        // base64url은 +, /, = 대신 -, _, (패딩 없음) 사용
        expect(cursor).not.toMatch(/[+/=]/)
    })
})

// ==================== Cursor 기반 페이지네이션 ====================

describe("cursorPaginate (cursor 기반 페이지네이션 헬퍼)", () => {
    /** QueryBuilder mock 생성 */
    function createMockQueryBuilder(results: unknown[]) {
        const qb = {
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            addOrderBy: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue(results),
        } as unknown as jest.Mocked<SelectQueryBuilder<{ id: number; createdAt: Date }>>
        return qb
    }

    function createMockRepoWithQB(results: unknown[]) {
        const qb = createMockQueryBuilder(results)
        const repo = {
            createQueryBuilder: jest.fn().mockReturnValue(qb),
        } as unknown as jest.Mocked<Repository<{ id: number; createdAt: Date }>>
        return { repo, qb }
    }

    it("첫 페이지: cursor 없이 최신순으로 조회한다", async () => {
        // Given — limit=2이면 3개 조회, 3개 반환 → hasMore=true
        const items = [
            { id: 3, createdAt: new Date("2026-01-03") },
            { id: 2, createdAt: new Date("2026-01-02") },
            { id: 1, createdAt: new Date("2026-01-01") },
        ]
        const { repo, qb } = createMockRepoWithQB(items)

        // When
        const result = await cursorPaginate({ repo, limit: 2 })

        // Then
        expect(result.items).toHaveLength(2)
        expect(result.hasMore).toBe(true)
        expect(result.nextCursor).not.toBeNull()
        expect(qb.take).toHaveBeenCalledWith(3) // limit + 1
    })

    it("마지막 페이지: hasMore=false, nextCursor=null", async () => {
        // Given — limit=5이지만 2개만 반환 → 마지막 페이지
        const items = [
            { id: 2, createdAt: new Date("2026-01-02") },
            { id: 1, createdAt: new Date("2026-01-01") },
        ]
        const { repo } = createMockRepoWithQB(items)

        // When
        const result = await cursorPaginate({ repo, limit: 5 })

        // Then
        expect(result.items).toHaveLength(2)
        expect(result.hasMore).toBe(false)
        expect(result.nextCursor).toBeNull()
    })

    it("빈 결과를 처리한다", async () => {
        // Given
        const { repo } = createMockRepoWithQB([])

        // When
        const result = await cursorPaginate({ repo, limit: 10 })

        // Then
        expect(result.items).toEqual([])
        expect(result.hasMore).toBe(false)
        expect(result.nextCursor).toBeNull()
    })

    it("cursor 전달 시 andWhere로 커서 조건을 추가한다", async () => {
        // Given
        const cursor = encodeCursor(5, new Date("2026-01-05T00:00:00.000Z"))
        const { repo, qb } = createMockRepoWithQB([])

        // When
        await cursorPaginate({ repo, limit: 10, cursor })

        // Then
        expect(qb.andWhere).toHaveBeenCalledWith(
            expect.stringContaining("entity.createdAt"),
            expect.objectContaining({ cursorId: 5, cursorDate: "2026-01-05T00:00:00.000Z" })
        )
    })

    it("where 조건과 relations를 적용한다", async () => {
        // Given
        const { repo, qb } = createMockRepoWithQB([])

        // When
        await cursorPaginate({
            repo,
            limit: 10,
            where: { userId: 1 },
            relations: ["script"],
        })

        // Then
        expect(qb.where).toHaveBeenCalledWith({ userId: 1 })
        expect(qb.leftJoinAndSelect).toHaveBeenCalledWith("entity.script", "script")
    })

    it("ASC 정렬을 지원한다", async () => {
        // Given
        const { repo, qb } = createMockRepoWithQB([])

        // When
        await cursorPaginate({ repo, limit: 10, order: "ASC" })

        // Then
        expect(qb.orderBy).toHaveBeenCalledWith("entity.createdAt", "ASC")
        expect(qb.addOrderBy).toHaveBeenCalledWith("entity.id", "ASC")
    })

    it("nextCursor를 디코딩하면 마지막 아이템의 id와 createdAt을 복원한다", async () => {
        // Given — limit=1, 2개 반환 → hasMore=true
        const lastItem = { id: 42, createdAt: new Date("2026-02-10T12:00:00.000Z") }
        const { repo } = createMockRepoWithQB([lastItem, { id: 41, createdAt: new Date() }])

        // When
        const result = await cursorPaginate({ repo, limit: 1 })

        // Then
        expect(result.nextCursor).not.toBeNull()
        const decoded = decodeCursor(result.nextCursor!)
        expect(decoded.id).toBe(42)
        expect(decoded.createdAt).toBe("2026-02-10T12:00:00.000Z")
    })
})
