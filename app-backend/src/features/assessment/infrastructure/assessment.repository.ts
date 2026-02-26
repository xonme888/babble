import { injectable, inject } from "tsyringe"
import { DataSource, Repository } from "typeorm"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { Assessment, AssessmentStatus } from "../domain/assessment.entity"
import { NotFoundException } from "@shared/core/exceptions/domain-exceptions"
import { DEFAULT_PAGE_LIMIT } from "@shared/core/constants/pagination.constants"
import type { PaginatedResult } from "@shared/core/pagination.interface"
import type {
    IAssessmentFilter,
    AssessmentDateRow,
    WeeklyActivityRow,
    ScriptProgressRow,
} from "@shared/core/types/raw-query.types"
import type { IAssessmentStatsProvider } from "../domain/assessment-stats-provider.interface"

@injectable()
export class AssessmentRepository implements IAssessmentStatsProvider {
    private repository: Repository<Assessment>

    constructor(@inject(DI_TOKENS.DataSource) private dataSource: DataSource) {
        this.repository = this.dataSource.getRepository(Assessment)
    }

    async save(assessment: Assessment): Promise<Assessment> {
        return this.repository.save(assessment)
    }

    /** 여러 Assessment를 한 번에 저장 */
    async saveAll(assessments: Assessment[]): Promise<Assessment[]> {
        if (assessments.length === 0) return []
        return this.repository.save(assessments)
    }

    async findById(id: number): Promise<Assessment | null> {
        return this.repository.findOne({
            where: { id },
            relations: ["script", "user"],
        })
    }

    /** 관계 로딩 없이 Assessment만 조회 — 상태 변경 등 내부 처리용 */
    async findByIdLight(id: number): Promise<Assessment | null> {
        return this.repository.findOneBy({ id })
    }

    async findByIdOrThrow(id: number, message = "assessment.not_found"): Promise<Assessment> {
        const entity = await this.findById(id)
        if (!entity) throw new NotFoundException(message)
        return entity
    }

    /** 관계 없이 조회 + 없으면 예외 — 상태 변경 등 내부 처리용 */
    async findByIdLightOrThrow(id: number, message = "assessment.not_found"): Promise<Assessment> {
        const entity = await this.findByIdLight(id)
        if (!entity) throw new NotFoundException(message)
        return entity
    }

    async findByUserId(
        userId: number,
        limit: number = DEFAULT_PAGE_LIMIT,
        offset: number = 0
    ): Promise<PaginatedResult<Assessment>> {
        const [items, total] = await this.repository
            .createQueryBuilder("assessment")
            .leftJoinAndSelect("assessment.script", "script")
            .where("assessment.userId = :userId", { userId })
            .orderBy("assessment.createdAt", "DESC")
            .take(limit)
            .skip(offset)
            .getManyAndCount()

        return { items, total }
    }

    async findAll(
        limit: number = DEFAULT_PAGE_LIMIT,
        offset: number = 0,
        filters: IAssessmentFilter = {}
    ): Promise<PaginatedResult<Assessment>> {
        const qb = this.repository
            .createQueryBuilder("assessment")
            .leftJoinAndSelect("assessment.user", "user")
            .leftJoinAndSelect("assessment.script", "script")

        if (filters.status) qb.andWhere("assessment.status = :status", { status: filters.status })
        if (filters.userId) qb.andWhere("assessment.userId = :userId", { userId: filters.userId })

        qb.orderBy("assessment.createdAt", "DESC")

        const [items, total] = await qb
            .take(limit)
            .skip(offset)
            .getManyAndCount()

        return { items, total }
    }

    /**
     * DB 집계로 사용자 통계 조회
     */
    async getStatsByUserId(userId: number): Promise<{
        totalLessons: number
        completedLessons: number
        averageScore: number
        totalPracticeSeconds: number
    }> {
        const result = await this.repository
            .createQueryBuilder("a")
            .select("COUNT(*)", "totalLessons")
            .addSelect("SUM(CASE WHEN a.status = :completed THEN 1 ELSE 0 END)", "completedLessons")
            .addSelect(
                "COALESCE(AVG(CASE WHEN a.status = :completed THEN a.score ELSE NULL END), 0)",
                "averageScore"
            )
            .addSelect(
                "SUM(CASE WHEN a.status = :completed THEN a.duration ELSE 0 END)",
                "totalPracticeSeconds"
            )
            .where("a.userId = :userId", { userId })
            .setParameter("completed", AssessmentStatus.COMPLETED)
            .getRawOne()

        return {
            totalLessons: parseInt(result.totalLessons, 10) || 0,
            completedLessons: parseInt(result.completedLessons, 10) || 0,
            averageScore: parseFloat(result.averageScore) || 0,
            totalPracticeSeconds: parseInt(result.totalPracticeSeconds, 10) || 0,
        }
    }

    /**
     * 사용자의 Assessment 날짜 목록 조회 (스트릭 계산용)
     */
    async getAssessmentDates(userId: number): Promise<Date[]> {
        const results = await this.repository
            .createQueryBuilder("a")
            .select("a.createdAt", "createdAt")
            .where("a.userId = :userId", { userId })
            .andWhere("a.status = :status", { status: AssessmentStatus.COMPLETED })
            .orderBy("a.createdAt", "ASC")
            .getRawMany()

        return results
            .map((r: AssessmentDateRow) => new Date(r.createdAt))
    }

    /**
     * 특정 점수 이상의 Assessment 존재 여부 확인 (배지용)
     */
    async hasScoreAbove(userId: number, minScore: number): Promise<boolean> {
        const count = await this.repository
            .createQueryBuilder("a")
            .where("a.userId = :userId", { userId })
            .andWhere("a.status = :status", { status: AssessmentStatus.COMPLETED })
            .andWhere("a.score >= :minScore", { minScore })
            .getCount()

        return count > 0
    }

    /**
     * 오늘 완료된 Assessment 수 (KST 기준)
     */
    async getTodayCompletedCount(
        userId: number,
        todayStart: Date,
        todayEnd: Date
    ): Promise<number> {
        return this.repository
            .createQueryBuilder("a")
            .where("a.userId = :userId", { userId })
            .andWhere("a.status = :status", { status: AssessmentStatus.COMPLETED })
            .andWhere("a.createdAt >= :start", { start: todayStart })
            .andWhere("a.createdAt < :end", { end: todayEnd })
            .getCount()
    }

    /**
     * DB 레벨에서 주간 활동 조회 (요일별 연습 시간)
     */
    async getWeeklyActivity(
        userId: number,
        weekStartDate: Date
    ): Promise<Array<{ dayOfWeek: number; totalMinutes: number }>> {
        const isPostgres = this.dataSource.options.type === "postgres"

        // PostgreSQL: EXTRACT(DOW FROM ...) / SQLite: strftime('%w', ...)
        // 둘 다 0=일요일, 6=토요일
        const dayOfWeekExpr = isPostgres
            ? "EXTRACT(DOW FROM a.createdAt)::INTEGER"
            : "CAST(strftime('%w', a.createdAt) AS INTEGER)"

        const ceilExpr = isPostgres ? "CEIL(a.duration / 60.0)" : "CEIL(a.duration / 60.0)"

        const results = await this.repository
            .createQueryBuilder("a")
            .select(dayOfWeekExpr, "dayOfWeek")
            .addSelect(
                `SUM(CASE WHEN a.status = :completed THEN ${ceilExpr} ELSE 0 END)`,
                "totalMinutes"
            )
            .where("a.userId = :userId", { userId })
            .andWhere("a.status = :completed", { completed: AssessmentStatus.COMPLETED })
            .andWhere("a.createdAt >= :weekStart", { weekStart: weekStartDate })
            .groupBy(dayOfWeekExpr)
            .getRawMany()

        return results
            .map((r: WeeklyActivityRow) => ({
                dayOfWeek: parseInt(r.dayOfWeek, 10),
                totalMinutes: parseInt(r.totalMinutes, 10) || 0,
            }))
    }

    /**
     * 사용자별 스크립트 진행도 조회 (완료된 스크립트 ID + 최고 점수)
     */
    async getScriptProgress(userId: number): Promise<{
        completedScriptIds: number[]
        bestScores: Record<number, number>
    }> {
        const results = await this.repository
            .createQueryBuilder("a")
            .select("a.scriptId", "scriptId")
            .addSelect("MAX(a.score)", "bestScore")
            .where("a.userId = :userId", { userId })
            .andWhere("a.status = :status", { status: AssessmentStatus.COMPLETED })
            .andWhere("a.scriptId IS NOT NULL")
            .groupBy("a.scriptId")
            .getRawMany()

        const completedScriptIds = results
            .map((r: ScriptProgressRow) => parseInt(r.scriptId, 10))
        const bestScores: Record<number, number> = {}
        results.forEach((r: ScriptProgressRow) => {
            bestScores[parseInt(r.scriptId, 10)] = parseFloat(r.bestScore) || 0
        })
        return { completedScriptIds, bestScores }
    }

    /**
     * 오늘 완료된 Assessment의 scriptId별 최고 점수 (워드게임 학습 우선 노출용)
     */
    async findTodayCompletedByUser(
        userId: number,
        todayStart: Date,
        todayEnd: Date
    ): Promise<{ scriptId: number; bestScore: number }[]> {
        const results = await this.repository
            .createQueryBuilder("a")
            .select("a.scriptId", "scriptId")
            .addSelect("MAX(a.score)", "bestScore")
            .where("a.userId = :userId", { userId })
            .andWhere("a.status = :status", { status: AssessmentStatus.COMPLETED })
            .andWhere("a.scriptId IS NOT NULL")
            .andWhere("a.createdAt >= :start", { start: todayStart })
            .andWhere("a.createdAt < :end", { end: todayEnd })
            .groupBy("a.scriptId")
            .getRawMany()

        return results
            .map((r: ScriptProgressRow) => ({
                scriptId: parseInt(r.scriptId, 10),
                bestScore: parseFloat(r.bestScore) || 0,
            }))
    }

    /**
     * Stuck Assessment 조회 — thresholdMinutes 이상 ANALYZING/PENDING 상태인 좀비 작업
     */
    async findStuckAssessments(thresholdMinutes: number): Promise<Assessment[]> {
        const limitDate = new Date()
        limitDate.setMinutes(limitDate.getMinutes() - thresholdMinutes)

        return this.repository
            .createQueryBuilder("assessment")
            .where("assessment.status IN (:...statuses)", {
                statuses: [AssessmentStatus.ANALYZING, AssessmentStatus.PENDING],
            })
            .andWhere("assessment.updatedAt <= :limitDate", { limitDate })
            .getMany()
    }

}
