export class AssessmentCompletedStatsHandler {
    eventType() { return "ASSESSMENT_COMPLETED" as const }
    async handle(_event: unknown): Promise<void> {}
}
