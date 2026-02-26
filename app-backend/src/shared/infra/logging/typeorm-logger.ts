import { AbstractLogger, LogLevel, LogMessage } from "typeorm"
import { SystemLogger } from "./system-logger"

/**
 * TypeORM → Pino 브릿지 로거
 * TypeORM의 쿼리/에러/슬로우쿼리 로그를 구조화된 Pino 로거로 통합한다.
 * data-source.ts에서 `logger: new TypeOrmPinoLogger()` 형태로 사용.
 */
export class TypeOrmPinoLogger extends AbstractLogger {
    protected writeLog(level: LogLevel, logMessage: LogMessage | LogMessage[]): void {
        const messages = this.prepareLogMessages(logMessage, { highlightSql: false })

        for (const message of messages) {
            const text = typeof message.message === "string"
                ? message.message
                : JSON.stringify(message.message)

            const context: Record<string, unknown> = { module: "typeorm" }
            if (message.prefix) context.category = message.prefix

            switch (message.type ?? level) {
                case "log":
                case "info":
                    SystemLogger.info(text, context)
                    break
                case "warn":
                case "migration":
                    SystemLogger.warn(text, context)
                    break
                case "error":
                case "query-error":
                    SystemLogger.error(text, undefined, context)
                    break
                case "query":
                    SystemLogger.debug(text, context)
                    break
                case "query-slow":
                    SystemLogger.warn(text, context)
                    break
                default:
                    SystemLogger.debug(text, context)
            }
        }
    }
}
