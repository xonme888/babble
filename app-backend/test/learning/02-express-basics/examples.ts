export {}

/**
 * 02. Express 기초 - 미들웨어 파이프라인 예제
 *
 * 실행: npx ts-node test/learning/02-express-basics/examples.ts
 * 테스트: 다른 터미널에서 curl http://localhost:4001/api/hello
 * 종료: Ctrl+C
 */
import express, { Request, Response, NextFunction } from "express"

const app = express()

// ============================================================
// 1. 보안 헤더 미들웨어 (helmet이 하는 일의 간소화 버전)
// ============================================================

/**
 * 왜 필요한가?
 * - XSS 공격 방지 (X-Content-Type-Options)
 * - iframe 삽입 방지 (X-Frame-Options)
 * - 서버 정보 숨김 (X-Powered-By 제거)
 *
 * 사용 안 하면? 브라우저 보안 기능이 작동하지 않아 공격에 취약
 */
function securityHeaders(req: Request, res: Response, next: NextFunction) {
    res.setHeader("X-Content-Type-Options", "nosniff") // MIME 스니핑 방지
    res.setHeader("X-Frame-Options", "DENY") // iframe 삽입 방지
    res.removeHeader("X-Powered-By") // 서버 정보 숨김
    console.log("[1] 보안 헤더 설정 완료")
    next() // 다음 미들웨어로 이동 (이것을 호출하지 않으면 요청이 멈춤!)
}

// ============================================================
// 2. CORS 미들웨어 (cors 패키지가 하는 일의 간소화 버전)
// ============================================================

/**
 * 왜 필요한가?
 * - 브라우저의 Same-Origin Policy 때문
 * - 프론트엔드(localhost:3000)와 백엔드(localhost:4001)가 다른 포트
 * - 이 헤더가 없으면 브라우저가 요청을 차단
 */
const ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:5173"]

function corsMiddleware(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin)
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
        console.log(`[2] CORS 허용: ${origin}`)
    } else {
        console.log(`[2] CORS: origin=${origin || "없음"} (서버 간 요청 또는 허용된 origin)`)
    }

    next()
}

// ============================================================
// 3. JSON Body 파싱
// ============================================================

// express.json()이 하는 일:
// Content-Type: application/json인 요청의 body를 파싱하여 req.body에 넣음
app.use(securityHeaders)
app.use(corsMiddleware)
app.use(express.json()) // 이 줄이 없으면 req.body === undefined
console.log("[3] JSON 파싱 미들웨어 등록")

// ============================================================
// 4. 커스텀 로깅 미들웨어 (pino-http가 하는 일의 간소화 버전)
// ============================================================

/**
 * 왜 필요한가?
 * - 모든 요청을 자동으로 로깅
 * - 운영 환경에서 "어떤 요청이 언제 왔는지" 추적 가능
 * - 응답 시간 측정으로 느린 API 파악
 */
function requestLogger(req: Request, res: Response, next: NextFunction) {
    const start = Date.now()

    // 응답이 끝난 후 로그 출력
    res.on("finish", () => {
        const duration = Date.now() - start
        console.log(`[LOG] ${req.method} ${req.url} → ${res.statusCode} (${duration}ms)`)
    })

    console.log(`[4] 요청 로깅: ${req.method} ${req.url}`)
    next()
}
app.use(requestLogger)

// ============================================================
// 5. 라우트 정의 (라우터 분리 패턴)
// ============================================================

// 라우터 분리: 기능별로 별도 라우터 생성
const userRouter = express.Router()

userRouter.get("/", (req: Request, res: Response) => {
    console.log("[5] GET /api/users 처리")
    res.json({
        success: true,
        data: [
            { id: 1, name: "홍길동" },
            { id: 2, name: "김철수" },
        ],
    })
})

userRouter.post("/", (req: Request, res: Response) => {
    console.log("[5] POST /api/users 처리")
    console.log("  요청 body:", req.body)

    if (!req.body.name) {
        // 에러를 throw하면 에러 핸들링 미들웨어로 전달됨
        throw new Error("이름은 필수입니다")
    }

    res.status(201).json({
        success: true,
        data: { id: 3, name: req.body.name },
    })
})

// 라우터를 경로에 마운트
app.use("/api/users", userRouter)

// 간단한 헬스체크
app.get("/api/hello", (req: Request, res: Response) => {
    res.json({ message: "안녕하세요! Express 미들웨어 학습 서버입니다." })
})

// ============================================================
// 6. 에러 핸들링 미들웨어 (반드시 마지막!)
// ============================================================

/**
 * 왜 반드시 마지막이어야 하는가?
 * - Express는 에러를 next(error)로 다음 미들웨어에 전달
 * - 4개의 파라미터(error, req, res, next)가 있어야 Express가 에러 핸들러로 인식
 * - 모든 라우트 뒤에 위치해야 모든 에러를 잡을 수 있음
 *
 * 이 프로젝트: src/shared/presentation/middlewares/error.handler.ts
 */
function errorHandler(error: Error, req: Request, res: Response, _next: NextFunction) {
    console.error(`[에러 핸들러] ${error.message}`)

    res.status(500).json({
        success: false,
        message: error.message,
    })
}
app.use(errorHandler)

// ============================================================
// 서버 시작
// ============================================================

const PORT = 4001
app.listen(PORT, () => {
    console.log("\n=== Express 미들웨어 학습 서버 시작 ===")
    console.log(`서버: http://localhost:${PORT}`)
    console.log("\n테스트 방법 (다른 터미널에서):")
    console.log(`  curl http://localhost:${PORT}/api/hello`)
    console.log(`  curl http://localhost:${PORT}/api/users`)
    console.log(
        `  curl -X POST -H "Content-Type: application/json" -d '{"name":"이영희"}' http://localhost:${PORT}/api/users`
    )
    console.log(
        `  curl -X POST -H "Content-Type: application/json" -d '{}' http://localhost:${PORT}/api/users  # 에러 테스트`
    )
    console.log("\n종료: Ctrl+C\n")
    console.log("=== 미들웨어 실행 순서를 관찰하세요 ===\n")
})
