export {}

/**
 * 10. 도메인 이벤트 기반 아키텍처 예제
 *
 * 실행: npx ts-node test/learning/10-event-driven/examples.ts
 */

// ============================================================
// 1. DomainEvent + BaseDomainEvent
// ============================================================

/**
 * 도메인 이벤트 인터페이스
 * 이 프로젝트: src/shared/core/domain-event.ts
 */
interface ExDomainEvent {
    readonly occurredAt: Date
    readonly eventType: string
    readonly aggregateId?: number
}

abstract class ExBaseDomainEvent implements ExDomainEvent {
    public readonly occurredAt: Date
    public readonly eventType: string

    constructor(public readonly aggregateId?: number) {
        this.occurredAt = new Date()
        this.eventType = this.constructor.name
    }
}

// ============================================================
// 2. 구체적인 이벤트 정의
// ============================================================

class UserRegisteredEvent extends ExBaseDomainEvent {
    constructor(
        public readonly userId: number,
        public readonly email: string,
        public readonly firstName: string
    ) {
        super(userId)
    }
}

class EmailVerifiedEvent extends ExBaseDomainEvent {
    constructor(
        public readonly userId: number,
        public readonly email: string
    ) {
        super(userId)
    }
}

class OrderPlacedEvent extends ExBaseDomainEvent {
    constructor(
        public readonly orderId: number,
        public readonly totalAmount: number
    ) {
        super(orderId)
    }
}

// ============================================================
// 3. EventHandler 인터페이스
// ============================================================

/**
 * 이벤트 핸들러 인터페이스
 * 이 프로젝트: src/shared/lib/events/event-handler.interface.ts
 */
interface ExIEventHandler<T extends ExDomainEvent = ExDomainEvent> {
    handle(event: T): Promise<void>
}

// ============================================================
// 4. EventDispatcher 구현
// ============================================================

/**
 * 이벤트 디스패처 - 이벤트를 핸들러에게 전달
 * 이 프로젝트: src/shared/lib/events/event-dispatcher.ts
 */
class ExEventDispatcher {
    private handlers = new Map<string, ExIEventHandler[]>()

    /** 핸들러 등록 */
    register<T extends ExDomainEvent>(eventType: string, handler: ExIEventHandler<T>): void {
        const existing = this.handlers.get(eventType) || []
        existing.push(handler as ExIEventHandler)
        this.handlers.set(eventType, existing)
        console.log(`  [Dispatcher] "${eventType}" 핸들러 등록`)
    }

    /** 동기 발행: 모든 핸들러 완료까지 대기 */
    async dispatch(event: ExDomainEvent): Promise<void> {
        const handlers = this.handlers.get(event.eventType) || []
        if (handlers.length === 0) {
            console.log(`  [Dispatcher] "${event.eventType}" 핸들러 없음`)
            return
        }

        console.log(`  [Dispatcher] "${event.eventType}" → ${handlers.length}개 핸들러에 전달`)
        for (const handler of handlers) {
            try {
                await handler.handle(event)
            } catch (error: unknown) {
                console.log(`  [Dispatcher] 핸들러 에러: ${(error as Error).message}`)
                // 에러가 발생해도 다른 핸들러는 계속 실행
            }
        }
    }

    /** 비동기 발행: 즉시 반환, 백그라운드 실행 */
    dispatchAsync(event: ExDomainEvent): void {
        const handlers = this.handlers.get(event.eventType) || []
        if (handlers.length === 0) return

        // setImmediate → 현재 이벤트 루프 완료 후 실행
        setImmediate(async () => {
            for (const handler of handlers) {
                try {
                    await handler.handle(event)
                } catch (error: unknown) {
                    console.log(`  [Async] 핸들러 에러: ${(error as Error).message}`)
                }
            }
        })
    }

    /** Aggregate에서 이벤트를 추출하여 비동기 발행 */
    publishFromAggregate(aggregate: {
        getDomainEvents(): readonly ExDomainEvent[]
        clearDomainEvents(): void
    }): void {
        const events = aggregate.getDomainEvents()
        console.log(`  [Dispatcher] Aggregate에서 ${events.length}개 이벤트 추출`)
        events.forEach((event) => this.dispatchAsync(event))
        aggregate.clearDomainEvents()
    }
}

// ============================================================
// 5. 핸들러 구현
// ============================================================

class WelcomeEmailHandler implements ExIEventHandler<UserRegisteredEvent> {
    async handle(event: UserRegisteredEvent): Promise<void> {
        console.log(`    [이메일] ${event.email}에게 환영 이메일 발송`)
    }
}

class AnalyticsHandler implements ExIEventHandler<UserRegisteredEvent> {
    async handle(event: UserRegisteredEvent): Promise<void> {
        console.log(`    [분석] 사용자 가입 추적: ${event.firstName} (${event.email})`)
    }
}

class SlackNotifyHandler implements ExIEventHandler<UserRegisteredEvent> {
    async handle(event: UserRegisteredEvent): Promise<void> {
        console.log(`    [슬랙] 새 가입자 알림: ${event.firstName}`)
    }
}

class EmailVerifiedHandler implements ExIEventHandler<EmailVerifiedEvent> {
    async handle(event: EmailVerifiedEvent): Promise<void> {
        console.log(`    [이메일] ${event.email} 인증 완료 → 프리미엄 기능 활성화`)
    }
}

class OrderNotificationHandler implements ExIEventHandler<OrderPlacedEvent> {
    async handle(event: OrderPlacedEvent): Promise<void> {
        console.log(
            `    [알림] 주문 #${event.orderId} 접수 완료 (${event.totalAmount.toLocaleString()}원)`
        )
    }
}

// ============================================================
// 6. Entity with Domain Events (Aggregate Root)
// ============================================================

class ExUser {
    id: number = 0
    email: string = ""
    firstName: string = ""
    isVerified: boolean = false
    private domainEvents: ExDomainEvent[] = []

    static register(id: number, email: string, firstName: string): ExUser {
        const user = new ExUser()
        user.id = id
        user.email = email
        user.firstName = firstName
        return user
    }

    emitRegisteredEvent(): void {
        this.domainEvents.push(new UserRegisteredEvent(this.id, this.email, this.firstName))
    }

    verifyEmail(): void {
        if (this.isVerified) throw new Error("이미 인증됨")
        this.isVerified = true
        this.domainEvents.push(new EmailVerifiedEvent(this.id, this.email))
    }

    getDomainEvents(): readonly ExDomainEvent[] {
        return [...this.domainEvents]
    }
    clearDomainEvents(): void {
        this.domainEvents = []
    }
}

// ============================================================
// 7. 실행
// ============================================================

async function main() {
    console.log("=== 도메인 이벤트 기반 아키텍처 ===\n")

    // --- 디스패처 설정 ---
    console.log("--- 1. 핸들러 등록 ---")
    const dispatcher = new ExEventDispatcher()

    // UserRegisteredEvent에 3개 핸들러 등록
    dispatcher.register("UserRegisteredEvent", new WelcomeEmailHandler())
    dispatcher.register("UserRegisteredEvent", new AnalyticsHandler())
    dispatcher.register("UserRegisteredEvent", new SlackNotifyHandler())

    // EmailVerifiedEvent에 1개 핸들러 등록
    dispatcher.register("EmailVerifiedEvent", new EmailVerifiedHandler())

    // OrderPlacedEvent에 1개 핸들러 등록
    dispatcher.register("OrderPlacedEvent", new OrderNotificationHandler())

    // --- 동기 이벤트 발행 ---
    console.log("\n--- 2. 동기 이벤트 발행 (dispatch) ---")
    const event1 = new UserRegisteredEvent(1, "hong@example.com", "홍길동")
    await dispatcher.dispatch(event1)
    console.log("  → 모든 핸들러 완료 후 이 줄 실행")

    // --- Aggregate에서 이벤트 발행 ---
    console.log("\n--- 3. Aggregate에서 이벤트 발행 (publishFromAggregate) ---")
    const user = ExUser.register(2, "kim@example.com", "김철수")

    // DB 저장 시뮬레이션
    console.log("  DB에 사용자 저장...")

    // 이벤트 축적
    user.emitRegisteredEvent()
    console.log(`  축적된 이벤트: ${user.getDomainEvents().length}개`)

    // DB 저장 성공 후 이벤트 발행
    dispatcher.publishFromAggregate(user)
    console.log(`  발행 후 남은 이벤트: ${user.getDomainEvents().length}개 (초기화됨)`)

    // --- 이메일 인증 흐름 ---
    console.log("\n--- 4. 이메일 인증 → 이벤트 발행 ---")
    user.verifyEmail()
    console.log(`  이메일 인증 완료: isVerified=${user.isVerified}`)
    dispatcher.publishFromAggregate(user)

    // 비동기 핸들러 실행 대기
    await new Promise((resolve) => setTimeout(resolve, 100))

    // --- 주문 이벤트 ---
    console.log("\n--- 5. 주문 이벤트 ---")
    const orderEvent = new OrderPlacedEvent(1001, 59000)
    await dispatcher.dispatch(orderEvent)

    // --- 핸들러 없는 이벤트 ---
    console.log("\n--- 6. 핸들러 없는 이벤트 ---")
    const unknownEvent: ExDomainEvent = {
        eventType: "UnknownEvent",
        occurredAt: new Date(),
        aggregateId: 999,
    }
    await dispatcher.dispatch(unknownEvent)

    console.log("\n✅ 이벤트 기반 아키텍처 예제 완료!")
}

main().catch(console.error)
