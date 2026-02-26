export {}

/**
 * 08. JWT 인증 시스템 예제
 *
 * 실행: npx ts-node test/learning/08-authentication/examples.ts
 */
import * as jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"

// ============================================================
// 1. bcrypt 비밀번호 해싱
// ============================================================

console.log("=== 1. bcrypt 비밀번호 해싱 ===\n")

async function demonstrateBcrypt() {
    const plainPassword = "SecureP@ss1"

    // 해싱 (salt rounds = 10: 2^10 = 1024번 반복. 높을수록 느림/안전)
    const hashed = await bcrypt.hash(plainPassword, 10)
    console.log(`평문: ${plainPassword}`)
    console.log(`해시: ${hashed}`)
    console.log(`해시 길이: ${hashed.length}자\n`)

    // 같은 비밀번호를 다시 해싱하면? → 다른 해시! (salt가 다름)
    const hashed2 = await bcrypt.hash(plainPassword, 10)
    console.log(`같은 비밀번호, 다른 해시: ${hashed2}`)
    console.log(`해시 같은가? ${hashed === hashed2}\n`) // false

    // 비밀번호 검증 (compare)
    const isValid = await bcrypt.compare(plainPassword, hashed)
    const isInvalid = await bcrypt.compare("WrongPassword", hashed)
    console.log(`올바른 비밀번호: ${isValid}`) // true
    console.log(`틀린 비밀번호: ${isInvalid}`) // false
}

// ============================================================
// 2. JWT 토큰 생성/검증
// ============================================================

console.log("=== 2. JWT 토큰 ===\n")

function demonstrateJWT() {
    const SECRET = "my-super-secret-key"
    const REFRESH_SECRET = "my-refresh-secret-key"

    // Access Token 생성 (15분)
    const accessToken = jwt.sign(
        { userId: 42 }, // Payload (토큰에 담길 데이터)
        SECRET,
        { algorithm: "HS256", expiresIn: "15m" }
    )

    // Refresh Token 생성 (7일, 별도 시크릿)
    const refreshToken = jwt.sign({ userId: 42 }, REFRESH_SECRET, {
        algorithm: "HS256",
        expiresIn: "7d",
    })

    console.log(`Access Token: ${accessToken.substring(0, 50)}...`)
    console.log(`Refresh Token: ${refreshToken.substring(0, 50)}...\n`)

    // JWT 구조 분석 (Header.Payload.Signature)
    const parts = accessToken.split(".")
    console.log("JWT 구조 (3부분):")
    console.log(`  Header:    ${Buffer.from(parts[0], "base64").toString()}`)
    console.log(`  Payload:   ${Buffer.from(parts[1], "base64").toString()}`)
    console.log(`  Signature: ${parts[2].substring(0, 30)}...\n`)

    // 토큰 검증
    const decoded = jwt.verify(accessToken, SECRET) as { userId: number; exp: number; iat: number }
    console.log(`검증 성공! userId: ${decoded.userId}`)
    console.log(`발급 시각: ${new Date(decoded.iat! * 1000).toLocaleString()}`)
    console.log(`만료 시각: ${new Date(decoded.exp! * 1000).toLocaleString()}\n`)

    // 잘못된 시크릿으로 검증 → 실패
    try {
        jwt.verify(accessToken, "wrong-secret")
    } catch (e: unknown) {
        console.log(`잘못된 시크릿: ${(e as Error).message}`)
    }

    // Refresh Token을 Access 시크릿으로 검증 → 실패
    try {
        jwt.verify(refreshToken, SECRET)
    } catch (e: unknown) {
        console.log(`시크릿 불일치: ${(e as Error).message}`)
    }

    // 만료된 토큰
    const expired = jwt.sign({ userId: 42 }, SECRET, { expiresIn: "0s" })
    try {
        jwt.verify(expired, SECRET)
    } catch (e: unknown) {
        console.log(`만료된 토큰: ${(e as Error).message}\n`)
    }

    return { accessToken, refreshToken, SECRET, REFRESH_SECRET }
}

// ============================================================
// 3. authGuard 시뮬레이션
// ============================================================

function demonstrateAuthGuard() {
    console.log("=== 3. authGuard 시뮬레이션 ===\n")

    const SECRET = "my-super-secret-key"

    // 블랙리스트 (로그아웃된 토큰)
    const blacklist = new Set<string>()

    /**
     * authGuard 구현
     * 이 프로젝트: src/features/auth/presentation/guards/auth.guard.ts
     */
    function authGuard(authHeader?: string): { userId: number } {
        // 1. Authorization 헤더 파싱
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new Error("401: 토큰이 없습니다")
        }

        const token = authHeader.split(" ")[1]

        // 2. 블랙리스트 확인
        if (blacklist.has(token)) {
            throw new Error("401: 로그아웃된 토큰입니다")
        }

        // 3. JWT 검증
        try {
            const decoded = jwt.verify(token, SECRET) as { userId: number }
            return { userId: decoded.userId }
        } catch {
            throw new Error("401: 유효하지 않은 토큰입니다")
        }
    }

    /**
     * adminGuard - authGuard 뒤에 실행
     */
    function _adminGuard(user: { userId: number; role?: string }): void {
        if (user.role !== "ADMIN") {
            throw new Error("403: 관리자만 접근 가능합니다")
        }
    }

    // 유효한 토큰
    const validToken = jwt.sign({ userId: 42 }, SECRET, { expiresIn: "15m" })
    const result = authGuard(`Bearer ${validToken}`)
    console.log(`✅ 유효한 토큰: userId=${result.userId}`)

    // 토큰 없음
    try {
        authGuard(undefined)
    } catch (e: unknown) {
        console.log(`❌ ${(e as Error).message}`)
    }

    // 잘못된 형식
    try {
        authGuard("InvalidHeader")
    } catch (e: unknown) {
        console.log(`❌ ${(e as Error).message}`)
    }

    // 로그아웃 시뮬레이션
    blacklist.add(validToken)
    try {
        authGuard(`Bearer ${validToken}`)
    } catch (e: unknown) {
        console.log(`❌ ${(e as Error).message}`)
    }
}

// ============================================================
// 4. 전체 인증 흐름 시뮬레이션
// ============================================================

async function demonstrateFullFlow() {
    console.log("\n=== 4. 전체 인증 흐름 ===\n")

    const SECRET = "my-secret"
    const REFRESH_SECRET = "my-refresh-secret"
    const users: { id: number; email: string; password: string }[] = []
    const refreshTokenStore = new Map<number, string>() // Redis 대체
    const blacklist = new Set<string>()

    // --- 회원가입 ---
    console.log("--- 회원가입 ---")
    const email = "hong@example.com"
    const plainPassword = "SecureP@ss1"
    const hashedPassword = await bcrypt.hash(plainPassword, 10)
    users.push({ id: 1, email, password: hashedPassword })
    console.log(`  사용자 등록: ${email}`)

    // --- 로그인 ---
    console.log("\n--- 로그인 ---")
    const loginUser = users.find((u) => u.email === email)!
    const passwordMatch = await bcrypt.compare(plainPassword, loginUser.password)
    console.log(`  비밀번호 검증: ${passwordMatch}`)

    const accessToken = jwt.sign({ userId: loginUser.id }, SECRET, { expiresIn: "15m" })
    const refreshToken = jwt.sign({ userId: loginUser.id }, REFRESH_SECRET, { expiresIn: "7d" })
    refreshTokenStore.set(loginUser.id, refreshToken)
    console.log(`  Access Token 발급: ${accessToken.substring(0, 30)}...`)
    console.log(`  Refresh Token → Redis 저장`)

    // --- API 요청 (인증) ---
    console.log("\n--- API 요청 ---")
    const payload = jwt.verify(accessToken, SECRET) as { userId: number }
    console.log(`  인증 성공: userId=${payload.userId}`)

    // --- 토큰 갱신 ---
    console.log("\n--- 토큰 갱신 ---")
    const storedRefresh = refreshTokenStore.get(loginUser.id)
    if (storedRefresh === refreshToken) {
        const newAccess = jwt.sign({ userId: loginUser.id }, SECRET, { expiresIn: "15m" })
        const newRefresh = jwt.sign({ userId: loginUser.id }, REFRESH_SECRET, { expiresIn: "7d" })
        refreshTokenStore.set(loginUser.id, newRefresh) // Token Rotation
        console.log(`  새 Access Token 발급: ${newAccess.substring(0, 30)}...`)
        console.log(`  Refresh Token 교체 (Token Rotation)`)
    }

    // --- 로그아웃 ---
    console.log("\n--- 로그아웃 ---")
    refreshTokenStore.delete(loginUser.id)
    blacklist.add(accessToken)
    console.log(`  Refresh Token 삭제`)
    console.log(`  Access Token 블랙리스트 등록`)

    // 로그아웃 후 요청
    if (blacklist.has(accessToken)) {
        console.log(`  ❌ 블랙리스트에 있어 요청 거부`)
    }
}

// ============================================================
// 실행
// ============================================================

async function main() {
    await demonstrateBcrypt()
    demonstrateJWT()
    demonstrateAuthGuard()
    await demonstrateFullFlow()
    console.log("\n✅ 인증 시스템 예제 완료!")
}

main().catch(console.error)
