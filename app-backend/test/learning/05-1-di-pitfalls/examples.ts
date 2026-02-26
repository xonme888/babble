export {}

/**
 * 05-1. DI 안티패턴(Pitfalls) - 의존성 주입 설계 실수 8가지
 *
 * 실행: npx ts-node test/learning/05-1-di-pitfalls/examples.ts
 *
 * 순수 TypeScript로 동작 (tsyringe, reflect-metadata 의존 없음)
 * DI 컨테이너 없이도 이해할 수 있는 구조적 문제에 집중합니다.
 */

// ============================================================
// 1. Control Freak (내부 new 직접 생성)
//    DI를 쓰지 않는 가장 기본적인 안티패턴
// ============================================================

console.log("=== 1. Control Freak (내부 new 직접 생성) ===\n")

/**
 * ❌ 문제: 서비스 안에서 의존성을 new로 직접 생성
 *
 * - 의존 객체를 교체할 수 없음 → 테스트 시 실제 DB/이메일에 접근
 * - 클래스 간 강결합 → 하나를 바꾸면 연쇄 수정 필요
 */
{
    class ExMySQLDatabase {
        query(sql: string): string[] {
            // 실제로는 MySQL에 연결...
            return [`[MySQL] ${sql}`]
        }
    }

    class ExMailgunSender {
        send(to: string, body: string): void {
            console.log(`    [Mailgun] → ${to}: ${body}`)
        }
    }

    // ⚠️ 의존성을 내부에서 직접 생성
    class ExBadUserService {
        private db = new ExMySQLDatabase() // ← 교체 불가
        private mailer = new ExMailgunSender() // ← 교체 불가

        register(email: string): void {
            this.db.query(`INSERT INTO users VALUES ('${email}')`)
            this.mailer.send(email, "가입 환영합니다!")
            console.log(`  [문제] ${email} 등록 완료 (MySQL + Mailgun 강결합)`)
        }
    }

    const svc = new ExBadUserService()
    svc.register("user@example.com")
    console.log(`  → 테스트하려면 진짜 MySQL + Mailgun이 필요`)
    console.log(`  → PostgreSQL로 바꾸려면? ExBadUserService 코드를 직접 수정해야 함`)
}

console.log("")

/**
 * ✅ 해결: 생성자 주입 (Constructor Injection)
 *
 * 프로젝트 참조:
 *   - src/features/user/user.service.ts:17-23 — 생성자에서 의존성 주입
 *   - src/shared/infra/di/diconfig.ts:55-56 — 인터페이스 → 구현체 등록
 */
{
    // 인터페이스 정의
    interface ExDatabase {
        query(sql: string): string[]
    }
    interface ExMailSender {
        send(to: string, body: string): void
    }

    // 구현체 A: 운영
    class _ExPostgresDB implements ExDatabase {
        query(sql: string): string[] {
            return [`[Postgres] ${sql}`]
        }
    }

    // 구현체 B: 테스트
    class ExFakeDB implements ExDatabase {
        public queries: string[] = []
        query(sql: string): string[] {
            this.queries.push(sql)
            return [`[Fake] ${sql}`]
        }
    }

    class ExFakeMailer implements ExMailSender {
        public sent: { to: string; body: string }[] = []
        send(to: string, body: string): void {
            this.sent.push({ to, body })
        }
    }

    // 의존성을 외부에서 주입
    class ExGoodUserService {
        constructor(
            private db: ExDatabase, // ← 인터페이스에 의존
            private mailer: ExMailSender // ← 구현체를 모름
        ) {}

        register(email: string): void {
            this.db.query(`INSERT INTO users VALUES ('${email}')`)
            this.mailer.send(email, "가입 환영합니다!")
        }
    }

    // 테스트: Fake 주입
    const fakeDB = new ExFakeDB()
    const fakeMailer = new ExFakeMailer()
    const testSvc = new ExGoodUserService(fakeDB, fakeMailer)
    testSvc.register("user@example.com")

    console.log(`[해결] 테스트 — DB 쿼리 기록: ${fakeDB.queries.length}개`)
    console.log(`[해결] 테스트 — 메일 발송 기록: ${fakeMailer.sent.length}개`)
    console.log(`  → 실제 DB/메일 없이 테스트 가능. 구현체 교체도 한 줄이면 됨`)
}

// ============================================================
// 2. Service Locator (컨테이너 남용)
//    DI를 쓰면서도 잘못 쓰는 패턴
// ============================================================

console.log("\n=== 2. Service Locator (컨테이너 남용) ===\n")

/**
 * ❌ 문제: 비즈니스 로직 안에서 container.resolve() 직접 호출
 *
 * - 의존성이 생성자에 보이지 않음 → "이 클래스가 뭘 필요로 하는지" 알 수 없음
 * - 테스트 시 전역 컨테이너를 조작해야 함
 * - DI를 쓰면서 DI의 장점을 버리는 것
 */
{
    // 간단한 Service Locator (컨테이너 흉내)
    class ExContainer {
        private static services = new Map<string, unknown>()
        static register(key: string, instance: unknown) {
            this.services.set(key, instance)
        }
        static resolve<T>(key: string): T {
            return this.services.get(key)
        }
    }

    // ⚠️ 메서드 안에서 컨테이너를 직접 호출
    class ExBadOrderService {
        processOrder(orderId: number): void {
            // 의존성이 생성자에 안 보임!
            const logger = ExContainer.resolve<unknown>("Logger")
            const mailer = ExContainer.resolve<unknown>("Mailer")

            (logger as any).log(`주문 #${orderId} 처리`)
            (mailer as any).send("admin@shop.com", `주문 #${orderId} 접수`)
            console.log(`  [문제] 주문 #${orderId} 처리 완료`)
        }
    }

    ExContainer.register("Logger", { log: (msg: string) => console.log(`    [Log] ${msg}`) })
    ExContainer.register("Mailer", {
        send: (to: string, body: string) => console.log(`    [Mail] ${to}: ${body}`),
    })

    const svc = new ExBadOrderService()
    svc.processOrder(42)
    console.log(`  → 생성자를 보면 의존성이 0개로 보임. 실제로는 2개 숨겨짐`)
    console.log(`  → 테스트하려면 전역 ExContainer를 조작해야 함`)
}

console.log("")

/**
 * ✅ 해결: 생성자에 의존성을 명시적으로 선언
 *
 * 프로젝트 참조:
 *   - src/features/auth/auth.service.ts:27-37 — 모든 의존성이 생성자에 명시
 *   - 단, auth.guard.ts:13 등 미들웨어에서는 Service Locator 패턴 사용
 *     (Express 미들웨어의 구조적 한계로 인한 의도적 예외)
 */
{
    interface ExOrderLogger {
        log(msg: string): void
    }
    interface ExOrderMailer {
        send(to: string, body: string): void
    }

    class ExGoodOrderService {
        constructor(
            private logger: ExOrderLogger, // ← 의존성이 명확히 보임
            private mailer: ExOrderMailer // ← 뭘 필요로 하는지 한눈에
        ) {}

        processOrder(orderId: number): void {
            this.logger.log(`주문 #${orderId} 처리`)
            this.mailer.send("admin@shop.com", `주문 #${orderId} 접수`)
        }
    }

    const svc = new ExGoodOrderService(
        { log: (msg) => console.log(`    [Log] ${msg}`) },
        { send: (to, body) => console.log(`    [Mail] ${to}: ${body}`) }
    )
    svc.processOrder(42)
    console.log(`[해결] 생성자만 보면 의존성 2개가 즉시 파악됨`)
}

// ============================================================
// 3. Concrete Dependency (구현체 직접 의존)
//    인터페이스 없이 구현 클래스에 직접 의존
// ============================================================

console.log("\n=== 3. Concrete Dependency (구현체 직접 의존) ===\n")

/**
 * ❌ 문제: 인터페이스 없이 구현 클래스를 직접 타입으로 사용
 *
 * - 다른 구현으로 교체하려면 타입을 전부 변경해야 함
 * - 테스트 시 실제 구현이 동작하여 외부 의존 발생
 */
{
    class ExSendGridMailer {
        send(to: string, subject: string): void {
            console.log(`    [SendGrid] ${to}: ${subject}`)
        }
        getQuota(): number {
            return 100
        } // SendGrid 전용 메서드
    }

    // ⚠️ 구현 클래스에 직접 의존
    class ExBadNotifier {
        constructor(private mailer: ExSendGridMailer) {} // ← 구현체 타입!

        notify(email: string): void {
            // SendGrid 전용 메서드까지 사용 가능 → 더 강하게 결합
            console.log(`  [문제] 남은 쿼터: ${this.mailer.getQuota()}`)
            this.mailer.send(email, "알림입니다")
        }
    }

    const notifier = new ExBadNotifier(new ExSendGridMailer())
    notifier.notify("user@example.com")
    console.log(`  → Nodemailer로 바꾸려면? getQuota()는 없으므로 Notifier도 수정 필요`)
}

console.log("")

/**
 * ✅ 해결: 인터페이스에 의존 (DIP — 의존성 역전 원칙)
 *
 * 프로젝트 참조:
 *   - src/features/notification/application/notification-provider.interface.ts — INotificationProvider
 *   - src/shared/infra/di/diconfig.ts:58-69 — Factory로 SendGrid/Nodemailer 전환
 */
{
    // 필요한 행위만 인터페이스로 정의
    interface ExMailProvider {
        send(to: string, subject: string): void
    }

    class ExSendGrid implements ExMailProvider {
        send(to: string, subject: string): void {
            console.log(`    [SendGrid] ${to}: ${subject}`)
        }
    }

    class ExNodemailer implements ExMailProvider {
        send(to: string, subject: string): void {
            console.log(`    [Nodemailer] ${to}: ${subject}`)
        }
    }

    // 인터페이스에 의존 → 구현체를 모름
    class ExGoodNotifier {
        constructor(private mailer: ExMailProvider) {} // ← 인터페이스 타입!

        notify(email: string): void {
            this.mailer.send(email, "알림입니다")
        }
    }

    // 환경에 따라 구현체 교체
    const env: string = "development"
    const mailer: ExMailProvider = env === "production" ? new ExSendGrid() : new ExNodemailer()

    const notifier = new ExGoodNotifier(mailer)
    notifier.notify("user@example.com")
    console.log(`[해결] 환경: ${env} → ${mailer.constructor.name} 사용`)
    console.log(`  → 구현체 교체 시 Notifier 코드 변경 없음`)
}

// ============================================================
// 4. Hidden Dependency (숨겨진 의존성)
//    생성자에 보이지 않는 의존성
// ============================================================

console.log("\n=== 4. Hidden Dependency (숨겨진 의존성) ===\n")

/**
 * ❌ 문제: 전역 변수, 환경 변수, 싱글톤을 메서드 안에서 직접 접근
 *
 * - 클래스의 시그니처만 봐서는 의존성을 알 수 없음
 * - 테스트에서 환경 변수를 조작해야 하는 취약한 구조
 */
{
    // 전역 상태
    const globalConfig = { maxRetries: 3, apiUrl: "https://api.example.com" }

    class ExBadWorker {
        // 생성자에 의존성이 없어 보임
        constructor() {}

        process(jobId: number): void {
            // ⚠️ 전역 변수를 직접 참조
            const maxRetries = globalConfig.maxRetries
            // ⚠️ 환경 변수를 직접 접근
            const env = process.env.NODE_ENV || "development"

            console.log(`  [문제] Job #${jobId}: maxRetries=${maxRetries}, env=${env}`)
            console.log(`  → 생성자는 빈데, 실제로는 globalConfig + process.env에 의존`)
        }
    }

    const worker = new ExBadWorker()
    worker.process(1)
    console.log(`  → 테스트하려면 전역 globalConfig와 process.env를 조작해야 함`)
}

console.log("")

/**
 * ✅ 해결: 설정도 생성자로 주입
 *
 * 프로젝트 참조:
 *   - src/shared/infra/config/config.service.ts — 환경 변수를 ConfigService로 캡슐화
 *   - src/features/auth/infrastructure/crypto/jwt-token-provider.ts:16 — ConfigService 주입
 */
{
    interface ExWorkerConfig {
        maxRetries: number
        environment: string
    }

    class ExGoodWorker {
        constructor(private config: ExWorkerConfig) {} // ← 설정도 주입

        process(jobId: number): void {
            console.log(
                `  [해결] Job #${jobId}: maxRetries=${this.config.maxRetries}, env=${this.config.environment}`
            )
        }
    }

    // 운영: 실제 설정
    const prodWorker = new ExGoodWorker({ maxRetries: 5, environment: "production" })
    prodWorker.process(1)

    // 테스트: 원하는 설정 주입
    const testWorker = new ExGoodWorker({ maxRetries: 1, environment: "test" })
    testWorker.process(2)
    console.log(`  → 환경 변수 조작 없이 설정을 자유롭게 교체 가능`)
}

// ============================================================
// 5. Constructor Over-injection (생성자 과다 주입)
//    SRP 위반의 신호탄
// ============================================================

console.log("\n=== 5. Constructor Over-injection (생성자 과다 주입) ===\n")

/**
 * ❌ 문제: 생성자에 의존성이 7개 이상 → 클래스가 너무 많은 책임을 짐
 *
 * 의존성이 많다는 것 자체가 Single Responsibility Principle 위반 신호
 */
{
    class _ExBadGodService {
        constructor(
            private userRepo: unknown,
            private orderRepo: unknown,
            private paymentGateway: unknown,
            private emailSender: unknown,
            private smsSender: unknown,
            private analyticsTracker: unknown,
            private cacheService: unknown,
            private auditLogger: unknown // ← 의존성 8개!
        ) {}

        // 유저 관련, 주문 관련, 결제 관련, 알림 관련... 전부 여기에
        processCheckout(_userId: number): void {
            console.log(`  [문제] 8개 의존성 + 여러 책임 → God Service`)
        }
    }

    console.log("[문제] ExBadGodService — 의존성 8개")
    console.log(`  → 유저, 주문, 결제, 알림, 분석, 캐시, 감사 모두 한 클래스에`)
    console.log(`  → 테스트 시 8개를 모두 Mock해야 함`)
}

console.log("")

/**
 * ✅ 해결: 책임 분리 → Facade 패턴 또는 도메인 서비스 분할
 *
 * 프로젝트 참조:
 *   - src/features/user/user.service.ts:17-23 — 의존성 3개 (적절한 수준)
 *   - src/features/assessment/assessment.service.ts:15-21 — 의존성 3개
 *   - src/features/auth/auth.service.ts:27-37 — 의존성 7개 (인증의 복잡성으로 인한 예외)
 */
{
    // 결제 관련 책임만
    class ExPaymentService {
        constructor(
            private paymentGateway: { charge(amount: number): boolean },
            private auditLogger: { log(msg: string): void }
        ) {}

        charge(orderId: number, amount: number): boolean {
            const result = this.paymentGateway.charge(amount)
            this.auditLogger.log(`Order #${orderId}: ${amount}원 결제 ${result ? "성공" : "실패"}`)
            return result
        }
    }

    // 알림 관련 책임만
    class ExNotificationService {
        constructor(
            private emailSender: { send(to: string, msg: string): void },
            private smsSender: { send(to: string, msg: string): void }
        ) {}

        notifyOrderComplete(email: string, phone: string, orderId: number): void {
            this.emailSender.send(email, `주문 #${orderId} 완료`)
            this.smsSender.send(phone, `주문 #${orderId} 완료`)
        }
    }

    // Facade: 분리된 서비스를 조율만 함
    class ExCheckoutFacade {
        constructor(
            private payment: ExPaymentService, // ← 의존성 2개
            private notification: ExNotificationService
        ) {}

        processCheckout(orderId: number, email: string, phone: string, amount: number): void {
            const paid = this.payment.charge(orderId, amount)
            if (paid) {
                this.notification.notifyOrderComplete(email, phone, orderId)
            }
        }
    }

    const facade = new ExCheckoutFacade(
        new ExPaymentService(
            { charge: () => true },
            { log: (msg) => console.log(`    [Audit] ${msg}`) }
        ),
        new ExNotificationService(
            { send: (to, msg) => console.log(`    [Email] ${to}: ${msg}`) },
            { send: (to, msg) => console.log(`    [SMS] ${to}: ${msg}`) }
        )
    )

    console.log("[해결] 책임 분리 후:")
    facade.processCheckout(42, "user@shop.com", "010-1234", 50000)
    console.log(`  → PaymentService: 의존성 2개, NotificationService: 의존성 2개`)
    console.log(`  → Facade: 의존성 2개, 각각 독립적으로 테스트 가능`)
}

// ============================================================
// 6. Captive Dependency (생명주기 불일치)
//    Singleton이 Transient를 가두는 문제
// ============================================================

console.log("\n=== 6. Captive Dependency (생명주기 불일치) ===\n")

/**
 * ❌ 문제: Singleton 서비스가 요청마다 새로 만들어야 할 객체를 생성자에서 한 번만 받음
 *
 * - Singleton 안에 갇힌(captive) 객체는 영원히 같은 인스턴스
 * - DB 커넥션, 요청별 컨텍스트 등이 공유되면 데이터 오염
 */
{
    // 요청마다 새로 생성되어야 하는 객체 (Transient)
    class ExRequestContext {
        public userId: number | null = null
        public requestId: string

        constructor() {
            this.requestId = Math.random().toString(36).slice(2, 8)
        }
    }

    // ⚠️ Singleton인데 RequestContext를 생성자에서 한 번만 받음
    class ExBadSingletonService {
        constructor(private context: ExRequestContext) {} // ← 한 번만 주입됨

        handleRequest(userId: number): void {
            this.context.userId = userId
            console.log(`  [문제] User #${userId} → context.requestId=${this.context.requestId}`)
        }
    }

    const sharedContext = new ExRequestContext() // 이 인스턴스가 영원히 사용됨
    const singleton = new ExBadSingletonService(sharedContext)

    singleton.handleRequest(1)
    singleton.handleRequest(2)
    singleton.handleRequest(3)

    console.log(`  → 3번의 요청인데 requestId가 모두 같음: ${sharedContext.requestId}`)
    console.log(`  → User #1의 요청이 User #3의 userId로 오염됨: ${sharedContext.userId}`)
}

console.log("")

/**
 * ✅ 해결: Factory 주입 — 필요할 때마다 새 인스턴스 생성
 *
 * 프로젝트 참조:
 *   - src/shared/infra/di/diconfig.ts:58-69 — useFactory로 런타임에 인스턴스 생성
 *   - src/shared/infra/di/diconfig.ts:79 — registerInstance로 DataSource 단일 인스턴스 등록
 */
{
    class ExRequestContext2 {
        public userId: number | null = null
        public requestId: string

        constructor() {
            this.requestId = Math.random().toString(36).slice(2, 8)
        }
    }

    // Factory를 주입 — 호출할 때마다 새 인스턴스
    class ExGoodSingletonService {
        constructor(
            private createContext: () => ExRequestContext2 // ← Factory 함수 주입
        ) {}

        handleRequest(userId: number): void {
            const context = this.createContext() // 매 요청마다 새로 생성
            context.userId = userId
            console.log(`  [해결] User #${userId} → context.requestId=${context.requestId}`)
        }
    }

    const singleton = new ExGoodSingletonService(() => new ExRequestContext2())

    singleton.handleRequest(1)
    singleton.handleRequest(2)
    singleton.handleRequest(3)
    console.log(`  → 매 요청마다 고유한 requestId. 데이터 오염 없음`)
}

// ============================================================
// 7. Circular Dependency (순환 의존)
//    A → B → A 무한 루프
// ============================================================

console.log("\n=== 7. Circular Dependency (순환 의존) ===\n")

/**
 * ❌ 문제: OrderService → NotificationService → OrderService
 *
 * - 누구를 먼저 생성해야 하는지 결정 불가 → DI 컨테이너가 에러
 * - 강결합의 극단적 형태
 *
 * (실제 순환 생성은 런타임 에러를 일으키므로 구조만 보여줌)
 */
{
    console.log("[문제] 순환 의존 구조:")
    console.log(`
    ┌──────────────────┐         ┌────────────────────────┐
    │  OrderService    │────────▶│  NotificationService   │
    │                  │         │                        │
    │  completeOrder() │         │  sendOrderEmail()      │
    │  {               │         │  {                     │
    │    notification   │         │    // 주문 정보가 필요해서... │
    │      .sendEmail() │         │    order.getOrder()    │
    │  }               │◀────────│  }                     │
    └──────────────────┘         └────────────────────────┘
  `)
    console.log(`  → OrderService를 만들려면 NotificationService가 필요`)
    console.log(`  → NotificationService를 만들려면 OrderService가 필요`)
    console.log(`  → tsyringe: "Cannot inject ... circular dependency detected"`)
}

console.log("")

/**
 * ✅ 해결 방법 3가지
 */
{
    // 해결 1: 이벤트로 분리 (가장 깔끔)
    console.log("[해결 1] 이벤트로 분리 — 의존 자체를 제거:")

    type ExHandler = (data: unknown) => void
    const handlers: Map<string, ExHandler[]> = new Map()
    function on(event: string, handler: ExHandler) {
        handlers.set(event, [...(handlers.get(event) || []), handler])
    }
    function emit(event: string, data: unknown) {
        ;(handlers.get(event) || []).forEach((h) => h(data))
    }

    class ExOrderService2 {
        completeOrder(orderId: number): void {
            console.log(`    주문 #${orderId} 완료`)
            emit("OrderCompleted", { orderId }) // ← 이벤트 발행만
        }
    }

    class ExNotificationService2 {
        // OrderService를 모름!
        constructor() {
            on("OrderCompleted", (data) => {
                console.log(`    [Email] 주문 #${data.orderId} 완료 알림 발송`)
            })
        }
    }

    new ExNotificationService2() // 핸들러 등록
    const orderSvc = new ExOrderService2()
    orderSvc.completeOrder(42)
    console.log(`  → OrderService는 NotificationService를 모름. 순환 해소`)

    // 해결 2: 공통 인터페이스 추출
    console.log("\n[해결 2] 공통 인터페이스 추출:")

    interface _ExOrderInfo {
        getOrderDetails(orderId: number): { orderId: number; total: number }
    }

    // OrderService가 ExOrderInfo를 구현
    // NotificationService는 ExOrderInfo에만 의존 (OrderService를 직접 모름)
    console.log(`  OrderService ──implements──▶ IOrderInfo ◀──depends── NotificationService`)
    console.log(`  → NotificationService는 인터페이스에만 의존. 순환 해소`)

    // 해결 3: 메서드 파라미터로 전달
    console.log("\n[해결 3] 필요한 데이터를 파라미터로 전달:")

    class ExNotificationService3 {
        sendOrderEmail(orderId: number, orderTotal: number): void {
            console.log(`    [Email] 주문 #${orderId} (${orderTotal}원) 완료`)
        }
    }

    class ExOrderService3 {
        constructor(private notification: ExNotificationService3) {}

        completeOrder(orderId: number): void {
            const total = 50000
            // OrderService → NotificationService (단방향)
            this.notification.sendOrderEmail(orderId, total) // 데이터를 넘김
        }
    }

    const notif3 = new ExNotificationService3()
    const order3 = new ExOrderService3(notif3)
    order3.completeOrder(42)
    console.log(`  → NotificationService가 OrderService를 알 필요 없음`)
}

// ============================================================
// 8. 과도한 추상화 (Unnecessary Abstraction)
//    구현이 하나뿐인데 인터페이스를 만드는 경우
// ============================================================

console.log("\n=== 8. 과도한 추상화 (Unnecessary Abstraction) ===\n")

/**
 * ❌ 문제: 구현이 하나뿐이고 교체 가능성이 없는데 인터페이스 + DI 적용
 *
 * - 파일 수만 2배 (인터페이스 + 구현)
 * - 코드 추적이 어려움: F12를 눌러도 인터페이스만 나옴
 * - YAGNI 위반 (You Aren't Gonna Need It)
 */
{
    // 인터페이스
    interface IExUserValidator {
        validateAge(age: number): boolean
        validateName(name: string): boolean
    }

    // 유일한 구현체 — 다른 구현이 있을 수 없음
    class ExUserValidator implements IExUserValidator {
        validateAge(age: number): boolean {
            return age >= 0 && age <= 150
        }
        validateName(name: string): boolean {
            return name.length >= 2
        }
    }

    // 굳이 인터페이스에 의존
    class ExBadService {
        constructor(private validator: IExUserValidator) {}

        createUser(name: string, age: number): string {
            if (!this.validator.validateName(name)) return "이름이 너무 짧습니다"
            if (!this.validator.validateAge(age)) return "나이가 유효하지 않습니다"
            return `${name}(${age}) 생성 완료`
        }
    }

    const svc = new ExBadService(new ExUserValidator())
    console.log(`[문제] ${svc.createUser("Kim", 25)}`)
    console.log(`  → IExUserValidator 인터페이스 파일 + ExUserValidator 구현 파일 = 2개`)
    console.log(`  → 다른 Validator 구현이 필요한 적이 한 번도 없음`)
    console.log(`  → F12로 정의 이동하면 인터페이스만 보임 → 구현까지 한 번 더 이동`)
}

console.log("")

/**
 * ✅ 해결: 인터페이스가 필요한 경우와 아닌 경우를 구분
 *
 * 인터페이스가 필요한 경우:
 *   - 구현이 2개 이상 (SendGrid vs Nodemailer)
 *   - 외부 시스템 연동 (DB, API, 이메일)
 *   - 테스트에서 Mock이 반드시 필요한 경우
 *
 * 인터페이스가 불필요한 경우:
 *   - 순수 비즈니스 로직 (검증, 계산, 변환)
 *   - 구현이 하나뿐이고 교체 가능성이 없는 경우
 *   - 도메인 서비스, Value Object 등
 *
 * 프로젝트 참조:
 *   - src/shared/infra/di/diconfig.ts:58-69 — INotificationProvider: SendGrid/Nodemailer 2개 → 인터페이스 필요
 *   - src/features/user/user.repository.ts — UserRepository: DB 교체 가능성 → 인터페이스 가치 있음
 *   - src/features/user/domain/user.entity.ts — Entity: 인터페이스 없이 직접 사용 (교체 불필요)
 */
{
    // 순수 로직은 구현 클래스를 직접 사용해도 무방
    class ExSimpleUserValidator {
        validateAge(age: number): boolean {
            return age >= 0 && age <= 150
        }
        validateName(name: string): boolean {
            return name.length >= 2
        }
    }

    class ExGoodService {
        constructor(private validator: ExSimpleUserValidator) {}

        createUser(name: string, age: number): string {
            if (!this.validator.validateName(name)) return "이름이 너무 짧습니다"
            if (!this.validator.validateAge(age)) return "나이가 유효하지 않습니다"
            return `${name}(${age}) 생성 완료`
        }
    }

    const svc = new ExGoodService(new ExSimpleUserValidator())
    console.log(`[해결] ${svc.createUser("Kim", 25)}`)
    console.log(`  → 파일 1개. F12로 바로 구현 확인 가능`)
    console.log("")

    console.log("  인터페이스 판단 기준:")
    console.log("  ┌─────────────────────────────┬──────────────┐")
    console.log("  │ 상황                        │ 인터페이스?  │")
    console.log("  ├─────────────────────────────┼──────────────┤")
    console.log("  │ 구현 2개+ (SendGrid/SMTP)   │ ✅ 필요      │")
    console.log("  │ 외부 시스템 (DB, API)        │ ✅ 필요      │")
    console.log("  │ 순수 비즈니스 로직           │ ❌ 불필요    │")
    console.log("  │ 교체 가능성 0%              │ ❌ 불필요    │")
    console.log("  └─────────────────────────────┴──────────────┘")
}

console.log("\n✅ DI 안티패턴 8가지 예제 완료!")
