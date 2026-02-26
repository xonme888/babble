import { container } from "tsyringe"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"

/**
 * 애플리케이션 기동(Bootstrap) 단계에서 안전하게 사용할 수 있는 로거 유틸리티
 * DI 컨테이너가 준비되기 전이나 초기화 실패 시에도 console로 폴백하여 로그를 남깁니다.
 */
export class SystemLogger {
    private static getLogger(): ILogger | Console {
        try {
            if (container.isRegistered(DI_TOKENS.ILogger)) {
                return container.resolve<ILogger>(DI_TOKENS.ILogger)
            }
        } catch {
            // DI 해결 실패 시 console 반환
        }
        return console
    }

    static info(message: string, context?: Record<string, unknown>) {
        const logger = this.getLogger()
        if ("info" in logger) {
            logger.info(message, context)
        } else {
            console.log(`[INFO] ${message}`, context || "")
        }
    }

    static error(message: string, error?: unknown, context?: Record<string, unknown>) {
        const logger = this.getLogger()
        if ("error" in logger) {
            logger.error(message, error, context)
        } else {
            console.error(`[ERROR] ${message}`, error, context || "")
        }
    }

    static warn(message: string, context?: Record<string, unknown>) {
        const logger = this.getLogger()
        if ("warn" in logger) {
            logger.warn(message, context)
        } else {
            console.warn(`[WARN] ${message}`, context || "")
        }
    }

    static debug(message: string, context?: Record<string, unknown>) {
        const logger = this.getLogger()
        if ("debug" in logger) {
            logger.debug(message, context)
        } else {
            console.debug(`[DEBUG] ${message}`, context || "")
        }
    }
}
