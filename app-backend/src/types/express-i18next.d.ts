import { TFunction } from "i18next"
import "http"

declare global {
    namespace Express {
        interface Request {
            t: TFunction
            language: string
            languages: string[]
            user?: { id: number; role?: string }
        }

        interface Response {
            /** 응답 바디 캡처 — pinoHttp 로깅용 */
            __body?: unknown
        }
    }
}

declare module "http" {
    interface IncomingMessage {
        body?: unknown
    }

    interface ServerResponse {
        /** 응답 바디 캡처 — pinoHttp 로깅용 */
        __body?: unknown
    }
}
