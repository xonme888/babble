import "reflect-metadata"
import { ConfigService } from "@config/config.service"

describe("ConfigService", () => {
    let configService: ConfigService

    beforeEach(() => {
        configService = new ConfigService()
    })

    it("should have a type-safe config object", () => {
        const config = configService.config
        expect(config).toBeDefined()
        expect(config.database).toBeDefined()
        expect(typeof config.port).toBe("number")
        expect(Array.isArray(config.allowedOrigins)).toBe(true)
    })

    it("should map database settings correctly", () => {
        const dbConfig = configService.config.database
        expect(dbConfig.type).toBeDefined()
        expect(dbConfig.database).toBeDefined()
    })

    it("should map database pool settings correctly", () => {
        const pool = configService.config.database.pool
        expect(pool).toBeDefined()
        expect(typeof pool!.max).toBe("number")
        expect(typeof pool!.idleTimeoutMillis).toBe("number")
    })

    it("should map redis settings correctly", () => {
        const redisConfig = configService.config.redis
        expect(redisConfig.host).toBeDefined()
        expect(typeof redisConfig.port).toBe("number")
    })

    it("should map bcrypt settings correctly", () => {
        const bcryptConfig = configService.config.bcrypt
        expect(bcryptConfig).toBeDefined()
        expect(typeof bcryptConfig.rounds).toBe("number")
        expect(bcryptConfig.rounds).toBeGreaterThan(0)
    })

    it("should map queue settings correctly", () => {
        const queueConfig = configService.config.queue
        expect(queueConfig).toBeDefined()
        expect(typeof queueConfig.attempts).toBe("number")
        expect(typeof queueConfig.backoffDelay).toBe("number")
        expect(typeof queueConfig.failedJobRetention).toBe("number")
        expect(typeof queueConfig.concurrency).toBe("number")
    })
})
