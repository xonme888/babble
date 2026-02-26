import "reflect-metadata"
import { ContentVersionService } from "@features/script/application/content-version.service"
import { ContentVersion } from "@features/script/domain/content-version.entity"

import type { DataSource, Repository } from "typeorm"

/**
 * ContentVersion 리포지토리 mock
 * save: 전달된 엔티티를 그대로 반환, findOne: null
 */
function createMockContentVersionRepo(): jest.Mocked<Repository<ContentVersion>> {
    return {
        save: jest.fn().mockImplementation(async (v) => v),
        find: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<Repository<ContentVersion>>
}

/**
 * DataSource mock — getRepository 호출 시 엔티티 클래스별로 다른 리포지토리 반환
 */
function _createMockDataSourceWithRepos(
    repoMap: Map<new (...args: unknown[]) => unknown, unknown>
): jest.Mocked<DataSource> {
    return {
        getRepository: jest
            .fn()
            .mockImplementation((entity: new (...args: unknown[]) => unknown) => {
                return repoMap.get(entity) ?? {}
            }),
    } as unknown as jest.Mocked<DataSource>
}

/** Script find 결과 생성 헬퍼 */
function makeScriptRow(id: number, updatedAt: Date) {
    return { id, updatedAt }
}

/** Chapter find 결과 생성 헬퍼 */
function makeChapterRow(id: number, updatedAt: Date) {
    return { id, updatedAt }
}

describe("ContentVersionService (콘텐츠 버전 서비스)", () => {
    const baseDate = new Date("2026-01-15T00:00:00.000Z")

    /**
     * 테스트용 서비스 인스턴스 생성
     * scripts/chapters 리포지토리 find 결과를 주입
     */
    function createServiceWithData(
        scripts: { id: number; updatedAt: Date }[],
        chapters: { id: number; updatedAt: Date }[]
    ) {
        const contentVersionRepo = createMockContentVersionRepo()

        const scriptRepo = {
            find: jest.fn().mockResolvedValue(scripts),
        }
        const chapterRepo = {
            find: jest.fn().mockResolvedValue(chapters),
        }

        // ContentVersion 엔티티 → contentVersionRepo
        // Script 엔티티 → scriptRepo
        // Chapter 엔티티 → chapterRepo
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const repoMap = new Map<new (...args: unknown[]) => unknown, any>()
        repoMap.set(
            // ContentVersion은 생성자에서 getRepository로 호출됨
            // 나머지는 generateChecksum에서 호출됨
            ContentVersion,
            contentVersionRepo
        )

        const dataSource = {
            getRepository: jest
                .fn()
                .mockImplementation((entity: new (...args: unknown[]) => unknown) => {
                    if (entity === ContentVersion) return contentVersionRepo
                    if (entity.name === "Script") return scriptRepo
                    if (entity.name === "Chapter") return chapterRepo
                    return {}
                }),
        } as unknown as jest.Mocked<DataSource>

        const service = new ContentVersionService(dataSource)
        return { service, contentVersionRepo, scriptRepo, chapterRepo }
    }

    describe("createVersion (버전 생성)", () => {
        it("동일 콘텐츠 상태에서 생성된 checksum이 동일하다", async () => {
            // Given — 동일한 스크립트/챕터 데이터
            const scripts = [makeScriptRow(1, baseDate), makeScriptRow(2, baseDate)]
            const chapters = [makeChapterRow(1, baseDate)]

            const { service: service1 } = createServiceWithData(scripts, chapters)
            const { service: service2 } = createServiceWithData(scripts, chapters)

            // When
            const version1 = await service1.createVersion("테스트1")
            const version2 = await service2.createVersion("테스트2")

            // Then
            expect(version1.checksum).toBe(version2.checksum)
            expect(version1.checksum).toHaveLength(16)
        })

        it("스크립트 추가 후 checksum이 변경된다", async () => {
            // Given — 스크립트 1개 vs 2개
            const scripts1 = [makeScriptRow(1, baseDate)]
            const scripts2 = [makeScriptRow(1, baseDate), makeScriptRow(2, baseDate)]
            const chapters = [makeChapterRow(1, baseDate)]

            const { service: service1 } = createServiceWithData(scripts1, chapters)
            const { service: service2 } = createServiceWithData(scripts2, chapters)

            // When
            const version1 = await service1.createVersion()
            const version2 = await service2.createVersion()

            // Then
            expect(version1.checksum).not.toBe(version2.checksum)
        })

        it("스크립트 수정(updatedAt 변경) 후 checksum이 변경된다", async () => {
            // Given — 동일 ID, 다른 updatedAt
            const scripts1 = [makeScriptRow(1, baseDate)]
            const scripts2 = [makeScriptRow(1, new Date("2026-02-01T00:00:00.000Z"))]
            const chapters = [makeChapterRow(1, baseDate)]

            const { service: service1 } = createServiceWithData(scripts1, chapters)
            const { service: service2 } = createServiceWithData(scripts2, chapters)

            // When
            const version1 = await service1.createVersion()
            const version2 = await service2.createVersion()

            // Then
            expect(version1.checksum).not.toBe(version2.checksum)
        })

        it("스크립트 삭제(find 결과 제외) 후 checksum이 변경된다", async () => {
            // Given — 2개 → 1개 (삭제된 스크립트는 @DeleteDateColumn 자동 필터에서 제외)
            const scripts1 = [makeScriptRow(1, baseDate), makeScriptRow(2, baseDate)]
            const scripts2 = [makeScriptRow(1, baseDate)]
            const chapters = [makeChapterRow(1, baseDate)]

            const { service: service1 } = createServiceWithData(scripts1, chapters)
            const { service: service2 } = createServiceWithData(scripts2, chapters)

            // When
            const version1 = await service1.createVersion()
            const version2 = await service2.createVersion()

            // Then
            expect(version1.checksum).not.toBe(version2.checksum)
        })

        it("reason이 저장된다", async () => {
            // Given
            const { service } = createServiceWithData([], [])

            // When
            const version = await service.createVersion("챕터 생성")

            // Then
            expect(version.reason).toBe("챕터 생성")
        })

        it("reason 미지정 시 null이 저장된다", async () => {
            // Given
            const { service } = createServiceWithData([], [])

            // When
            const version = await service.createVersion()

            // Then
            expect(version.reason).toBeNull()
        })
    })

    describe("getLatestVersion (최신 버전 조회)", () => {
        it("최신 버전을 반환한다", async () => {
            // Given
            const mockVersion = new ContentVersion()
            mockVersion.checksum = "abc123"
            mockVersion.createdAt = baseDate

            const contentVersionRepo = createMockContentVersionRepo()
            contentVersionRepo.find.mockResolvedValue([mockVersion])

            const dataSource = {
                getRepository: jest.fn().mockReturnValue(contentVersionRepo),
            } as unknown as jest.Mocked<DataSource>

            const service = new ContentVersionService(dataSource)

            // When
            const result = await service.getLatestVersion()

            // Then
            expect(result).toBe(mockVersion)
            expect(contentVersionRepo.find).toHaveBeenCalledWith({
                order: { createdAt: "DESC" },
                take: 1,
            })
        })

        it("버전이 없으면 null을 반환한다", async () => {
            // Given
            const { service } = createServiceWithData([], [])

            // When
            const result = await service.getLatestVersion()

            // Then
            expect(result).toBeNull()
        })
    })
})
