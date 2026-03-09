export class DailyGoalAchievedEvent {
    constructor(
        public readonly userId: number,
        public readonly date: string,
    ) {}
}
