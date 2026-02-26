import { Request, Response, NextFunction } from "express"
import { randomUUID } from "crypto"
import { TraceContext } from "../../infra/logging/trace-context"

/**
 * Trace ID 미들웨어
 * - Nginx의 X-Request-Id 헤더를 우선적으로 사용
 * - 없으면 새로운 UUID 생성
 */
export function traceMiddleware(req: Request, res: Response, next: NextFunction) {
    // Nginx 또는 클라이언트가 보낸 요청 ID 확인
    const traceId = (req.headers["x-request-id"] as string) || randomUUID()

    // 응답 헤더에도 포함하여 클라이언트가 추적 가능하게 함
    res.setHeader("X-Trace-Id", traceId)

    // TraceContext 범위 내에서 다음 미들웨어/핸들러 실행
    TraceContext.run(traceId, () => {
        next()
    })
}
