import {
    Entity,
    Column,
    ManyToOne,
    JoinColumn,
} from "typeorm"
import { BaseCreatedEntity } from "@shared/core/entity"
import type { Assessment } from "./assessment.entity"

export enum AnalysisLogStatus {
    SUCCESS = "SUCCESS",
    FAIL = "FAIL",
}

/**
 * Assessment Analysis Log Entity
 *
 * AI 분석 시도 로그
 * - 각 분석 시도마다 로그 기록
 * - 성공/실패 추적
 * - 재시도 디버깅용
 */
@Entity("assessment_analysis_logs")
export class AssessmentAnalysisLog extends BaseCreatedEntity {
    @Column()
    assessmentId: number

    @ManyToOne("Assessment", { onDelete: "CASCADE" })
    @JoinColumn({ name: "assessmentId" })
    assessment: Assessment

    @Column({
        type: "simple-enum",
        enum: AnalysisLogStatus,
    })
    status: AnalysisLogStatus

    @Column({ type: "text", nullable: true })
    errorMessage: string | null

    @Column({ type: "int" })
    attemptNumber: number

    /** 분석 로그 생성 팩토리 */
    static create(params: {
        assessmentId: number
        status: AnalysisLogStatus
        attemptNumber: number
        errorMessage?: string
    }): AssessmentAnalysisLog {
        const log = new AssessmentAnalysisLog()
        log.assessmentId = params.assessmentId
        log.status = params.status
        log.attemptNumber = params.attemptNumber
        log.errorMessage = params.errorMessage ?? null
        return log
    }
}
