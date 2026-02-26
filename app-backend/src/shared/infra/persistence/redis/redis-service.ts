import { injectable, inject } from "tsyringe"
import Redis from "ioredis"
import { IRedisService } from "@shared/core/redis-service.interface"
import { ConfigService } from "@shared/infra/config/config.service"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { ILogger } from "@shared/core/logger.interface"
import { ServiceUnavailableException } from "@shared/core/exceptions/infrastructure-exceptions"
import { REDIS_CACHE_DB, REDIS_QUEUE_DB } from "@shared/core/constants/redis.constants"

@injectable()
export class RedisService implements IRedisService {
    private client: Redis | null = null // Default DB 0
    private queueClient: Redis | null = null // DB 1 for Queue
    private isConnected: boolean = false

    constructor(
        private configService: ConfigService,
        @inject(DI_TOKENS.ILogger) private logger: ILogger
    ) {
        this.connect()
    }

    private createBaseConfig(): {
        host: string
        port: number
        password: string | undefined
        retryStrategy: (times: number) => number | null
    } {
        const redisConfig = this.configService.config.redis
        return {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            retryStrategy: (times: number) => {
                if (times > redisConfig.maxRetryAttempts) {
                    this.logger.error(
                        `Redis reconnection failed after ${redisConfig.maxRetryAttempts} attempts — giving up`
                    )
                    return null
                }
                const delay = Math.min(times * 1000, redisConfig.maxRetryDelayMs)
                if (times > redisConfig.retryLogThreshold) {
                    this.logger.error(
                        `Redis reconnect attempt ${times} — retrying in ${delay}ms`
                    )
                }
                return delay
            },
        }
    }

    private connect() {
        try {
            const baseConfig = this.createBaseConfig()

            // Client for DB 0 (Cache, Auth)
            this.client = new Redis({ ...baseConfig, db: REDIS_CACHE_DB })

            // Client for DB 1 (Queue)
            this.queueClient = new Redis({ ...baseConfig, db: REDIS_QUEUE_DB })

            this.client.on("connect", () => {
                this.isConnected = true
                this.logger.info("Cache Client (DB 0) Connected successfully")
            })

            this.queueClient.on("connect", () => {
                this.logger.info("Queue Client (DB 1) Connected successfully")
            })

            this.client.on("error", (err) => {
                this.logger.error("Cache Client (DB 0) connection error:", err.message)
                this.isConnected = false
            })

            this.queueClient.on("error", (err) => {
                this.logger.error("Queue Client (DB 1) connection error:", err.message)
            })
        } catch (error: unknown) {
            this.logger.error("Failed to initialize:", error instanceof Error ? error.message : String(error))
        }
    }

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        // 의도적 skip: graceful 메서드 — Redis 미연결 시 fail-open
        if (!this.client) return
        await this.client.setex(key, ttlSeconds, value)
    }

    async get(key: string): Promise<string | null> {
        // 의도적 skip: graceful 메서드 — Redis 미연결 시 null 반환
        if (!this.client) return null
        return await this.client.get(key)
    }

    async delete(key: string): Promise<void> {
        // 의도적 skip: graceful 메서드 — Redis 미연결 시 무시
        if (!this.client) return
        await this.client.del(key)
    }

    async ttl(key: string): Promise<number> {
        // 의도적 skip: graceful 메서드 — Redis 미연결 시 -1 반환
        if (!this.client) return -1
        return await this.client.ttl(key)
    }

    async increment(key: string): Promise<number> {
        if (!this.client) return 0
        return await this.client.incr(key)
    }

    async exists(key: string): Promise<boolean> {
        if (!this.client) return false
        const result = await this.client.exists(key)
        return result === 1
    }

    isAvailable(): boolean {
        return this.client !== null && this.isConnected
    }

    private ensureConnected(): Redis {
        if (!this.client || !this.isConnected) {
            throw new ServiceUnavailableException("Redis")
        }
        return this.client
    }

    async setRequired(key: string, value: string, ttlSeconds: number): Promise<void> {
        const client = this.ensureConnected()
        await client.setex(key, ttlSeconds, value)
    }

    async getRequired(key: string): Promise<string | null> {
        const client = this.ensureConnected()
        return await client.get(key)
    }

    async deleteRequired(key: string): Promise<void> {
        const client = this.ensureConnected()
        await client.del(key)
    }

    /** 원자적 GET + DEL — Redis GETDEL 명령 (Redis 6.2+) */
    async getAndDeleteRequired(key: string): Promise<string | null> {
        const client = this.ensureConnected()
        return await client.getdel(key)
    }

    async incrementRequired(key: string): Promise<number> {
        const client = this.ensureConnected()
        return await client.incr(key)
    }

    /**
     * 원자적 INCR + EXPIRE — Rate Limiting 전용
     * INCR 결과가 1이면 TTL 설정 (첫 요청), 이후는 INCR만 수행
     */
    async incrWithExpire(key: string, ttlSeconds: number): Promise<number> {
        const client = this.ensureConnected()
        const count = await client.incr(key)
        if (count === 1) {
            await client.expire(key, ttlSeconds)
        }
        return count
    }

    async existsRequired(key: string): Promise<boolean> {
        const client = this.ensureConnected()
        const result = await client.exists(key)
        return result === 1
    }

    async ping(): Promise<string> {
        const client = this.ensureConnected()
        return await client.ping()
    }

    /**
     * Pub/Sub 메시지 발행 — Redis 미연결 시 0 반환
     */
    async publish(channel: string, message: string): Promise<number> {
        if (!this.client || !this.isConnected) return 0
        return await this.client.publish(channel, message)
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.quit()
        }
        if (this.queueClient) {
            await this.queueClient.quit()
        }
        this.isConnected = false
    }

    async rpush(key: string, value: string): Promise<number> {
        if (!this.queueClient) return 0
        return await this.queueClient.rpush(key, value)
    }

    async lpop(key: string): Promise<string | null> {
        if (!this.queueClient) return null
        return await this.queueClient.lpop(key)
    }

    async blpop(key: string, timeoutSeconds: number): Promise<string | null> {
        if (!this.client) return null
        const result = await this.client.blpop(key, timeoutSeconds)
        // ioredis blpop returns [key, value] or null
        return result ? result[1] : null
    }

    async llen(key: string): Promise<number> {
        if (!this.queueClient) return 0
        return await this.queueClient.llen(key)
    }

    async acquireLock(key: string, ttlSeconds: number): Promise<(() => Promise<void>) | null> {
        const client = this.ensureConnected()
        const lockValue = `${Date.now()}:${Math.random().toString(36).slice(2)}`
        const result = await client.set(key, lockValue, "EX", ttlSeconds, "NX")

        if (result !== "OK") return null

        // unlock: 자신이 건 락만 해제 (Lua 스크립트로 원자적 비교+삭제)
        const unlock = async () => {
            const script = `
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                end
                return 0
            `
            await client.eval(script, 1, key, lockValue)
        }

        return unlock
    }

    getDuplicateClient(): Redis {
        const client = new Redis({
            ...this.createBaseConfig(),
            db: REDIS_CACHE_DB,
        })
        client.on("error", (err) => {
            this.logger.error(`Duplicate Client error: ${err.message}`)
        })
        return client
    }
}
