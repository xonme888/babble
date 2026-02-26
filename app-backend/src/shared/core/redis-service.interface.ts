/**
 * Redis 클라이언트 인터페이스
 * - 인증 코드, Rate Limiting 등에 사용
 *
 * graceful 메서드 (set/get/delete 등): Redis 미연결 시 조용히 실패 (캐시 등 비보안 용도)
 * *Required 메서드: Redis 미연결 시 ServiceUnavailableException throw (보안 필수 용도)
 */
export interface IRedisService {
    // ==================== Graceful 메서드 (기존) ====================

    /** 값 저장 (TTL 포함) — Redis 미연결 시 no-op */
    set(key: string, value: string, ttlSeconds: number): Promise<void>

    /** 값 조회 — Redis 미연결 시 null 반환 */
    get(key: string): Promise<string | null>

    /** 값 삭제 — Redis 미연결 시 no-op */
    delete(key: string): Promise<void>

    /** 키의 TTL 조회 */
    ttl(key: string): Promise<number>

    /** 카운터 증가 (Rate Limiting용) */
    increment(key: string): Promise<number>

    /** 키 존재 여부 확인 */
    exists(key: string): Promise<boolean>

    /** 리스트 오른쪽에 값 추가 (Queue Enqueue) */
    rpush(key: string, value: string): Promise<number>

    /** 리스트 왼쪽에서 값 꺼내기 (Queue Dequeue) */
    lpop(key: string): Promise<string | null>

    /** 리스트 왼쪽에서 블로킹 꺼내기 (결과 큐 소비용) — 타임아웃까지 대기 후 없으면 null */
    blpop(key: string, timeoutSeconds: number): Promise<string | null>

    /** 리스트 길이 조회 (DLQ 모니터링 등) */
    llen(key: string): Promise<number>

    /** Pub/Sub 메시지 발행 — Redis 미연결 시 0 반환 */
    publish(channel: string, message: string): Promise<number>

    /** 구독(Subscribe) 등을 위해 독립된 클라이언트 반환 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getDuplicateClient(): any

    // ==================== 보안 필수 메서드 (Redis 미연결 시 예외) ====================

    /** 값 저장 — Redis 미연결 시 ServiceUnavailableException throw */
    setRequired(key: string, value: string, ttlSeconds: number): Promise<void>

    /** 값 조회 — Redis 미연결 시 ServiceUnavailableException throw */
    getRequired(key: string): Promise<string | null>

    /** 값 삭제 — Redis 미연결 시 ServiceUnavailableException throw */
    deleteRequired(key: string): Promise<void>

    /** 원자적 GET + DEL — 값을 조회하면서 즉시 삭제 (일회용 코드 소비용) */
    getAndDeleteRequired(key: string): Promise<string | null>

    /** 카운터 증가 — Redis 미연결 시 ServiceUnavailableException throw */
    incrementRequired(key: string): Promise<number>

    /**
     * 원자적 INCR + EXPIRE — Rate Limiting 전용
     * INCR 결과가 1이면 TTL 설정 (첫 요청), 이후는 INCR만 수행
     * @returns INCR 후 카운트 값
     */
    incrWithExpire(key: string, ttlSeconds: number): Promise<number>

    /** 키 존재 여부 확인 — Redis 미연결 시 ServiceUnavailableException throw */
    existsRequired(key: string): Promise<boolean>

    /** Redis 사용 가능 여부 확인 */
    isAvailable(): boolean

    /** Redis PING — 연결 상태 확인용 (health check) */
    ping(): Promise<string>

    /**
     * 분산 락 획득 (SET NX EX)
     * @returns unlock 함수 (성공 시) 또는 null (획득 실패 시)
     */
    acquireLock(key: string, ttlSeconds: number): Promise<(() => Promise<void>) | null>
}
