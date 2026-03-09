export class GameSessionCompletedEvent {
    constructor(
        public readonly gameSessionId: number,
        public readonly userId: number,
        public readonly score: number,
    ) {}
}
