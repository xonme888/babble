/**
 * SSE 연결 추상화 — Express Response 등 프레임워크 독립
 * Express Response는 구조적 타이핑으로 이 인터페이스를 자동 만족
 */
export interface SSEConnection {
    write(data: string): boolean
    end(): void
    on(event: string, listener: (...args: unknown[]) => void): unknown
    readonly writableEnded: boolean
    readonly destroyed: boolean
}

/**
 * SSE 클라이언트 정보
 */
export interface SSEClient {
    userId: number
    connection: SSEConnection
    connectedAt: Date
}

/**
 * 실시간 알림 인터페이스
 *
 * Phase 1: In-Memory SSE + Redis Pub/Sub (SSENotificationService)
 * Phase 2: Redis Streams + Consumer Group (구현체 교체만으로 전환)
 * Phase 3: 전용 SSE Gateway 마이크로서비스
 */
export interface IRealtimeNotifier {
    /** userId 기반 SSE 연결 등록 */
    addClient(userId: number, connection: SSEConnection): void

    /** admin 브로드캐스트용 연결 추가 */
    addAdminClient(connection: SSEConnection): void

    /** 특정 사용자에게 이벤트 전송 */
    notifyUser(userId: number, event: string, data: unknown): void

    /** 전체 브로드캐스트 (admin 모니터링용) */
    notifyAll(event: string, data: unknown): void

    /** 활성 연결 수 */
    readonly clientCount: number
}
