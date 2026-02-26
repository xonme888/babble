import { injectable, inject } from "tsyringe"
import pino from "pino"
import { ILogger } from "@shared/core/logger.interface"
import { TraceContext } from "./trace-context"
import { ConfigService } from "../config/config.service"

const BODY_TRUNCATE_LENGTH = 200

const SENSITIVE_KEYS = new Set([
    "password",
    "token",
    "refreshtoken",
    "accesstoken",
    "authorization",
    "cookie",
    "secret",
    "apikey",
])

export function sanitize(data: unknown): unknown {
    if (data === null || data === undefined) return data
    if (Array.isArray(data)) return data.map(sanitize)
    if (typeof data === "object") {
        const result: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
            if (SENSITIVE_KEYS.has(key.toLowerCase())) {
                result[key] = "[REDACTED]"
            } else if (typeof value === "object" && value !== null) {
                result[key] = sanitize(value)
            } else if (typeof value === "string" && value.length > BODY_TRUNCATE_LENGTH) {
                result[key] = value.slice(0, BODY_TRUNCATE_LENGTH) + "..."
            } else {
                result[key] = value
            }
        }
        return result
    }
    return data
}

/**
 * Pino 기반 구조화된 로거
 * - Production: JSON stdout (Promtail → Loki 호환)
 * - Development: pino-pretty (가독성)
 */
@injectable()
export class PinoLogger implements ILogger {
    private logger: pino.Logger

    constructor(@inject(ConfigService) configService: ConfigService) {
        const isProduction = configService.config.env === "production"
        const isDebug = configService.config.log.debug

        this.logger = pino({
            level: isDebug ? "debug" : isProduction ? "info" : "debug",
            // 공통 JSON 스키마 필드: service 식별자
            base: { service: "backend" },
            // Production: JSON stdout (Promtail이 수집)
            // Development: pino-pretty (가독성)
            transport: isProduction
                ? undefined
                : {
                      target: "pino-pretty",
                      options: { colorize: true, translateTime: "SYS:standard" },
                  },
            // 민감 정보 자동 마스킹
            redact: {
                paths: ["req.headers.authorization", "req.headers.cookie"],
                censor: "[REDACTED]",
            },
            serializers: {
                err: pino.stdSerializers.err,
            },
        })
    }

    private traceProps(): Record<string, unknown> {
        const traceId = TraceContext.getTraceId()
        return traceId ? { traceId } : {}
    }

    info(message: string, context?: Record<string, unknown>): void {
        this.logger.info({ ...this.traceProps(), ...context }, message)
    }

    error(message: string, error?: unknown, context?: Record<string, unknown>): void {
        this.logger.error({ ...this.traceProps(), err: error, ...context }, message)
    }

    warn(message: string, context?: Record<string, unknown>): void {
        this.logger.warn({ ...this.traceProps(), ...context }, message)
    }

    debug(message: string, context?: Record<string, unknown>): void {
        this.logger.debug({ ...this.traceProps(), ...context }, message)
    }

    getInstance(): pino.Logger {
        return this.logger
    }
}
