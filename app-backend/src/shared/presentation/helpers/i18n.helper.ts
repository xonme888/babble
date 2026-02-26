import { Request } from "express"

/**
 * i18n 번역 헬퍼
 * Controller에서 반복되는 `req.t ? req.t(key) : fallback` 패턴을 제거한다.
 */
export function translate(req: Request, key: string, fallback: string): string {
    return req.t ? req.t(key) : fallback
}
