import type { IRedisService } from "@shared/core/redis-service.interface"
import type { ILogger } from "@shared/core/logger.interface"

/**
 * Redis 캐시 조회 → DB 폴백 → 캐시 저장 패턴 통합
 *
 * 캐시/DB 어느 쪽이 실패해도 서비스는 중단되지 않는다:
 * - 캐시 조회 실패 → DB 폴백
 * - 캐시 저장 실패 → warn 로그 후 DB 결과 반환
 */
export async function getOrFetch<T>(
    redis: IRedisService,
    logger: ILogger,
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>,
): Promise<T> {
    try {
        const cached = await redis.get(key)
        if (cached) return JSON.parse(cached) as T
    } catch (error) {
        logger.warn("캐시 조회 실패, DB에서 조회", { key, error: String(error) })
    }

    const data = await fetchFn()

    try {
        await redis.set(key, JSON.stringify(data), ttlSeconds)
    } catch (error) {
        logger.warn("캐시 저장 실패", { key, error: String(error) })
    }

    return data
}
