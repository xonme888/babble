export {}

/**
 * 09. Redis + BullMQ 예제 (In-Memory 시뮬레이션)
 *
 * 실행: npx ts-node test/learning/09-redis-and-queues/examples.ts
 *
 * 참고: 실제 Redis 없이 동작하도록 In-Memory로 시뮬레이션합니다.
 * 실제 프로젝트에서는 ioredis와 BullMQ를 사용합니다.
 */

// ============================================================
// 1. Redis In-Memory 시뮬레이션
// ============================================================

/**
 * Redis 핵심 명령어를 시뮬레이션하는 클래스
 * 실제 프로젝트: ioredis (src/shared/infra/persistence/redis/redis-service.ts)
 */
class MockRedis {
    private store = new Map<string, { value: string; expiresAt?: number }>()

    /** SET key value [EX seconds] */
    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
        this.store.set(key, { value, expiresAt })
        console.log(`  SET ${key} = "${value}"${ttlSeconds ? ` (TTL: ${ttlSeconds}s)` : ""}`)
    }

    /** GET key */
    async get(key: string): Promise<string | null> {
        const entry = this.store.get(key)
        if (!entry) return null
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.store.delete(key)
            return null
        }
        return entry.value
    }

    /** DEL key */
    async del(key: string): Promise<void> {
        this.store.delete(key)
        console.log(`  DEL ${key}`)
    }

    /** EXISTS key */
    async exists(key: string): Promise<boolean> {
        const entry = this.store.get(key)
        if (!entry) return false
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.store.delete(key)
            return false
        }
        return true
    }

    /** INCR key (원자적 증가) */
    async incr(key: string): Promise<number> {
        const entry = this.store.get(key)
        const current = entry ? parseInt(entry.value) : 0
        const next = current + 1
        this.store.set(key, {
            value: String(next),
            expiresAt: entry?.expiresAt,
        })
        return next
    }

    /** TTL key (남은 만료 시간) */
    async ttl(key: string): Promise<number> {
        const entry = this.store.get(key)
        if (!entry || !entry.expiresAt) return -1
        return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000))
    }

    /** RPUSH key value (리스트에 추가) */
    async rpush(key: string, value: string): Promise<void> {
        const entry = this.store.get(key)
        const list = entry ? JSON.parse(entry.value) : []
        list.push(value)
        this.store.set(key, { value: JSON.stringify(list) })
        console.log(`  RPUSH ${key} (리스트 크기: ${list.length})`)
    }
}

// ============================================================
// 2. BullMQ 시뮬레이션
// ============================================================

interface Job {
    id: string
    data: unknown
    status: "waiting" | "active" | "completed" | "failed"
    attempts: number
    maxAttempts: number
}

/**
 * BullMQ Queue 시뮬레이션
 * 실제: bullmq의 Queue 클래스 (src/shared/infra/queue/email.queue.ts)
 */
class MockQueue {
    private jobs: Job[] = []
    private nextId = 1

    constructor(private name: string) {
        console.log(`  큐 생성: "${name}"`)
    }

    async add(
        jobName: string,
        data: unknown,
        opts?: { attempts?: number; delay?: number }
    ): Promise<Job> {
        const job: Job = {
            id: `${this.nextId++}`,
            data,
            status: "waiting",
            attempts: 0,
            maxAttempts: opts?.attempts || 3,
        }
        this.jobs.push(job)
        console.log(`  [Queue] Job #${job.id} 추가: ${jobName}`)
        return job
    }

    getJobs(): Job[] {
        return this.jobs
    }
}

/**
 * BullMQ Worker 시뮬레이션
 * 실제: bullmq의 Worker 클래스 (src/features/notification/worker/email.worker.ts)
 */
class MockWorker {
    constructor(
        private queueName: string,
        private processor: (job: Job) => Promise<void>,
        private opts?: { concurrency?: number }
    ) {
        console.log(`  워커 생성: "${queueName}" (동시성: ${opts?.concurrency || 1})`)
    }

    async processJobs(jobs: Job[]): Promise<void> {
        const waiting = jobs.filter((j) => j.status === "waiting")
        const concurrency = this.opts?.concurrency || 1

        console.log(`\n  [Worker] ${waiting.length}개 작업 처리 시작 (동시성: ${concurrency})`)

        for (const job of waiting) {
            job.status = "active"
            job.attempts++

            try {
                await this.processor(job)
                job.status = "completed"
                console.log(`  [Worker] Job #${job.id} ✅ 완료`)
            } catch {
                if (job.attempts < job.maxAttempts) {
                    job.status = "waiting" // 재시도 대기
                    console.log(
                        `  [Worker] Job #${job.id} ❌ 실패 (${job.attempts}/${job.maxAttempts}) - 재시도 예정`
                    )
                } else {
                    job.status = "failed"
                    console.log(`  [Worker] Job #${job.id} ❌ 영구 실패 (최대 재시도 초과)`)
                }
            }
        }
    }
}

// ============================================================
// 3. 실행: Redis 기본 명령어
// ============================================================

async function main() {
    console.log("=== Redis + BullMQ 학습 ===\n")

    const redis = new MockRedis()

    // --- 인증 코드 저장 (TTL) ---
    console.log("--- 1. 인증 코드 저장 (TTL) ---")
    await redis.set("verify:hong@example.com", "123456", 600) // 10분
    const code = await redis.get("verify:hong@example.com")
    console.log(`  GET verify:hong@example.com = "${code}"`)
    await redis.del("verify:hong@example.com") // 인증 후 삭제

    // --- Token Blacklist ---
    console.log("\n--- 2. Token Blacklist ---")
    const token = "eyJhbGciOiJIUzI1NiJ9..."
    await redis.set(`blacklist:${token}`, "1", 900) // 15분 (Access Token 만료까지)
    const isBlacklisted = await redis.exists(`blacklist:${token}`)
    console.log(`  블랙리스트 확인: ${isBlacklisted ? "차단됨" : "유효"}`)

    // --- Rate Limiting ---
    console.log("\n--- 3. Rate Limiting ---")
    const rateLimitKey = "ratelimit:login-attempt:192.168.1.1"
    await redis.set(rateLimitKey, "0", 900) // 15분 윈도우
    for (let i = 0; i < 6; i++) {
        const count = await redis.incr(rateLimitKey)
        const allowed = count <= 5
        if (!allowed) {
            console.log(`  시도 ${count}: ❌ 차단 (최대 5회 초과)`)
        } else {
            console.log(`  시도 ${count}: ✅ 허용 (남은: ${5 - count}회)`)
        }
    }

    // --- AI 작업 큐 (Redis List) ---
    console.log("\n--- 4. AI 작업 큐 (Redis List) ---")
    await redis.rpush(
        "ai:tasks",
        JSON.stringify({ assessmentId: 1, audioUrl: "/uploads/audio1.wav" })
    )
    await redis.rpush(
        "ai:tasks",
        JSON.stringify({ assessmentId: 2, audioUrl: "/uploads/audio2.wav" })
    )

    // ============================================================
    // 4. BullMQ 시뮬레이션: 이메일 발송
    // ============================================================

    console.log("\n--- 5. BullMQ: 이메일 발송 큐 ---")

    const emailQueue = new MockQueue("email-queue")

    // NotificationService가 큐에 작업 등록
    await emailQueue.add("email-queue", {
        to: "[암호화된 이메일]",
        subject: "[암호화된 제목]",
        content: "[암호화된 내용]",
        logId: 1,
        encrypted: true,
    })

    await emailQueue.add("email-queue", {
        to: "[암호화된 이메일2]",
        subject: "[암호화된 제목2]",
        content: "[암호화된 내용2]",
        logId: 2,
        encrypted: true,
    })

    // Worker가 처리
    const emailWorker = new MockWorker("email-queue", async (job: Job) => {
        // 암호화된 데이터 복호화 (시뮬레이션)
        console.log(`    이메일 발송 처리: Job #${job.id} (LogID: ${job.data.logId})`)
        // 실제: QueueCrypto.decrypt((job.data as any).to) → nodemailer/sendgrid 발송
    })

    await emailWorker.processJobs(emailQueue.getJobs())

    // ============================================================
    // 5. BullMQ 시뮬레이션: 재시도
    // ============================================================

    console.log("\n--- 6. BullMQ: 재시도 시뮬레이션 ---")

    const retryQueue = new MockQueue("retry-demo")
    await retryQueue.add("retry-demo", { task: "불안정한 작업" }, { attempts: 3 })

    let attemptCount = 0
    const retryWorker = new MockWorker("retry-demo", async (_job: Job) => {
        attemptCount++
        if (attemptCount < 3) {
            throw new Error(`네트워크 오류 (시도 ${attemptCount})`)
        }
        console.log(`    3번째 시도에서 성공!`)
    })

    // 3번 시도
    for (let i = 0; i < 3; i++) {
        await retryWorker.processJobs(retryQueue.getJobs())
    }

    console.log("\n✅ Redis + BullMQ 예제 완료!")
}

main().catch(console.error)
