export {}

/**
 * 05. 의존성 주입 (DI) - tsyringe 예제
 *
 * 실행: npx ts-node test/learning/05-dependency-injection/examples.ts
 */
import "reflect-metadata"
import { container, injectable, inject } from "tsyringe"

// ============================================================
// 1. 인터페이스 정의 (문자열 토큰으로 식별)
// ============================================================

/**
 * 왜 인터페이스?
 * - 구현체를 교체할 수 있음 (Console → File → Cloud)
 * - 테스트 시 Mock으로 교체 가능
 *
 * 왜 문자열 토큰?
 * - TypeScript 인터페이스는 런타임에 사라짐 (JavaScript에 없음)
 * - 문자열 "ILogger"로 런타임에 식별
 */
interface ILogger {
    info(message: string): void
    error(message: string): void
}

interface IUserRepository {
    findByEmail(email: string): { id: number; email: string } | null
    save(user: { email: string }): { id: number; email: string }
}

// ============================================================
// 2. 구현체 (실제 환경용)
// ============================================================

@injectable()
class ConsoleLogger implements ILogger {
    info(message: string): void {
        console.log(`  [INFO] ${message}`)
    }
    error(message: string): void {
        console.error(`  [ERROR] ${message}`)
    }
}

@injectable()
class InMemoryUserRepository implements IUserRepository {
    private users: { id: number; email: string }[] = []
    private nextId = 1

    findByEmail(email: string) {
        return this.users.find((u) => u.email === email) || null
    }

    save(user: { email: string }) {
        const newUser = { id: this.nextId++, email: user.email }
        this.users.push(newUser)
        return newUser
    }
}

// ============================================================
// 3. Service (DI로 의존성 주입)
// ============================================================

/**
 * @injectable() - 이 클래스를 DI 컨테이너가 생성할 수 있음
 * @inject("토큰") - 문자열 토큰으로 의존성 지정
 *
 * 이 클래스는 ILogger, IUserRepository가 뭔지 모름.
 * 인터페이스만 알고, 실제 구현체는 DI 컨테이너가 결정.
 */
@injectable()
class UserService {
    constructor(
        @inject("ILogger") private logger: ILogger,
        @inject("IUserRepo") private userRepo: IUserRepository
    ) {}

    register(email: string): { id: number; email: string } {
        this.logger.info(`회원가입 시도: ${email}`)

        // 중복 체크
        const existing = this.userRepo.findByEmail(email)
        if (existing) {
            this.logger.error(`이미 존재하는 이메일: ${email}`)
            throw new Error("이미 존재하는 이메일입니다")
        }

        const user = this.userRepo.save({ email })
        this.logger.info(`회원가입 성공: #${user.id} ${user.email}`)
        return user
    }
}

// ============================================================
// 4. DI 컨테이너 설정 (실제 환경)
// ============================================================

console.log("=== 1. 실제 환경 DI 설정 ===\n")

// 인터페이스 토큰 → 구현체 매핑
container.register("ILogger", { useClass: ConsoleLogger })
container.register("IUserRepo", { useClass: InMemoryUserRepository })

// DI 컨테이너가 UserService를 생성하면서 의존성을 자동 주입
const userService = container.resolve(UserService)

userService.register("hong@example.com")
userService.register("kim@example.com")

try {
    userService.register("hong@example.com") // 중복!
} catch (e: unknown) {
    console.log(`  예상된 에러: ${(e as Error).message}`)
}

// ============================================================
// 5. 구현체 교체 (테스트 환경)
// ============================================================

console.log("\n=== 2. 테스트 환경: Mock으로 교체 ===\n")

/**
 * Mock 구현체 - 테스트용
 * 실제 DB도 없고, 콘솔 출력도 없음
 * 대신 호출 기록만 저장
 */
class MockLogger implements ILogger {
    calls: string[] = []
    info(message: string): void {
        this.calls.push(`info: ${message}`)
    }
    error(message: string): void {
        this.calls.push(`error: ${message}`)
    }
}

class MockUserRepository implements IUserRepository {
    private users: { id: number; email: string }[] = []
    saveCalled = 0

    findByEmail(email: string) {
        return this.users.find((u) => u.email === email) || null
    }

    save(user: { email: string }) {
        this.saveCalled++
        const newUser = { id: this.saveCalled, email: user.email }
        this.users.push(newUser)
        return newUser
    }
}

// 새 컨테이너(자식)로 Mock 등록 (기존 설정에 영향 안 줌)
const testContainer = container.createChildContainer()

const mockLogger = new MockLogger()
const mockRepo = new MockUserRepository()

testContainer.registerInstance("ILogger", mockLogger)
testContainer.registerInstance("IUserRepo", mockRepo)

const testUserService = testContainer.resolve(UserService)
testUserService.register("test@example.com")

console.log(`  Mock Logger 호출 기록: ${mockLogger.calls.length}건`)
mockLogger.calls.forEach((call) => console.log(`    - ${call}`))
console.log(`  Mock Repo save() 호출 횟수: ${mockRepo.saveCalled}회`)

// ============================================================
// 6. Singleton vs Transient
// ============================================================

console.log("\n=== 3. Singleton vs Transient ===\n")

@injectable()
class CounterService {
    private count = 0
    increment() {
        return ++this.count
    }
}

// Singleton: 하나의 인스턴스만 생성
container.registerSingleton(CounterService)

const counter1 = container.resolve(CounterService)
const counter2 = container.resolve(CounterService)

counter1.increment()
counter1.increment()
console.log(`Singleton - counter1.increment(): 2번 호출`)
console.log(`Singleton - counter2에서 조회: ${counter2.increment()}`) // 3 (같은 인스턴스)
console.log(`→ Singleton이므로 counter1과 counter2는 같은 인스턴스`)

// ============================================================
// 7. Factory 패턴 (조건부 구현체 선택)
// ============================================================

console.log("\n=== 4. Factory 패턴 ===\n")

/**
 * 이 프로젝트에서 INotificationProvider를 환경에 따라 분기하는 것과 동일한 패턴
 * 개발: NodemailerMailProvider
 * 운영: SendGridMailProvider
 */
interface IMailer {
    send(to: string, message: string): void
}

class DevMailer implements IMailer {
    send(to: string, message: string) {
        console.log(`  [DEV] 콘솔 출력: ${to}에게 "${message}"`)
    }
}

class ProdMailer implements IMailer {
    send(to: string, message: string) {
        console.log(`  [PROD] SendGrid API 호출: ${to}에게 "${message}"`)
    }
}

const ENV: string = "development" // 환경 변수

container.register("IMailer", {
    useFactory: () => {
        if (ENV === "production") {
            return new ProdMailer()
        }
        return new DevMailer() // 개발 환경
    },
})

const mailer = container.resolve<IMailer>("IMailer")
mailer.send("user@example.com", "인증 코드: 123456")

console.log("\n✅ 의존성 주입 예제 완료!")
