export {}

/**
 * 04. DDD 패턴 - Entity, Value Object, Aggregate, Domain Event
 *
 * 실행: npx ts-node test/learning/04-ddd-patterns/examples.ts
 */

// ============================================================
// 1. Value Object - 값으로 동등성 비교, 유효성 검증을 한 곳에서
// ============================================================

console.log("=== 1. Value Object ===\n")

/**
 * Money Value Object
 *
 * 왜 Value Object?
 * - 금액은 ID가 없음. 10000원 == 10000원 (값이 같으면 같음)
 * - 유효성 검증(음수 불가, 통화 일치)을 한 곳에서 관리
 * - 불변(immutable): 생성 후 값 변경 불가 → 안전
 */
class Money {
    private constructor(
        private readonly _amount: number,
        private readonly _currency: string
    ) {}

    // Factory Method: 유효성 검증 강제
    static create(amount: number, currency: string = "KRW"): Money {
        if (amount < 0) {
            throw new Error("금액은 음수가 될 수 없습니다")
        }
        return new Money(amount, currency)
    }

    get amount(): number {
        return this._amount
    }
    get currency(): string {
        return this._currency
    }

    // 값으로 동등성 비교 (ID 비교가 아님!)
    equals(other: Money): boolean {
        return this._amount === other._amount && this._currency === other._currency
    }

    // 새 Value Object 반환 (불변성 유지)
    add(other: Money): Money {
        if (this._currency !== other._currency) {
            throw new Error("통화가 다릅니다")
        }
        return Money.create(this._amount + other._amount, this._currency)
    }

    toString(): string {
        return `${this._amount.toLocaleString()}${this._currency}`
    }
}

const price1 = Money.create(10000)
const price2 = Money.create(10000)
const price3 = Money.create(5000)

console.log(`price1: ${price1}`)
console.log(`price2: ${price2}`)
console.log(`price1 === price2? ${price1.equals(price2)}`) // true (값이 같음)
console.log(`price1 === price3? ${price1.equals(price3)}`) // false

const total = price1.add(price3)
console.log(`price1 + price3 = ${total}`)

try {
    Money.create(-100) // ❌ 유효성 검증
} catch (e: unknown) {
    console.log(`유효성 검증: ${(e as Error).message}`)
}

// ============================================================
// 2. Domain Event - 무슨 일이 일어났는지 기록
// ============================================================

console.log("\n=== 2. Domain Event ===\n")

/**
 * 도메인 이벤트 기본 클래스
 * 이 프로젝트: src/shared/core/domain-event.ts
 */
interface LearningDomainEvent {
    readonly occurredAt: Date
    readonly eventType: string
    readonly aggregateId?: number
}

abstract class LearningBaseDomainEvent implements LearningDomainEvent {
    public readonly occurredAt: Date
    public readonly eventType: string

    constructor(public readonly aggregateId?: number) {
        this.occurredAt = new Date()
        this.eventType = this.constructor.name
    }
}

// 구체적인 이벤트
class OrderCreatedEvent extends LearningBaseDomainEvent {
    constructor(
        public readonly orderId: number,
        public readonly customerId: number,
        public readonly totalAmount: Money
    ) {
        super(orderId)
    }
}

class OrderCompletedEvent extends LearningBaseDomainEvent {
    constructor(
        public readonly orderId: number,
        public readonly completedAt: Date
    ) {
        super(orderId)
    }
}

// ============================================================
// 3. Entity (Aggregate Root) - 도메인 로직 + 이벤트 발행
// ============================================================

console.log("=== 3. Aggregate Root (Order) ===\n")

/**
 * 주문 상태 (문자열 Enum)
 */
enum OrderStatus {
    CREATED = "CREATED",
    PAID = "PAID",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
}

/**
 * Order Entity (Aggregate Root)
 *
 * 왜 Aggregate Root?
 * - 주문의 일관성 규칙을 이 클래스가 보장
 * - 외부에서는 이 클래스의 메서드를 통해서만 상태 변경 가능
 * - 잘못된 상태 전이(COMPLETED → CREATED)를 방지
 */
class Order {
    private _id: number
    private _customerId: number
    private _status: OrderStatus
    private _totalAmount: Money
    private _items: OrderItem[] = []
    private _domainEvents: LearningDomainEvent[] = []

    private constructor() {
        this._id = 0
        this._customerId = 0
        this._status = OrderStatus.CREATED
        this._totalAmount = Money.create(0)
    }

    // ---- Factory Method ----
    /**
     * 왜 new Order() 대신 Order.create()?
     * - 생성 시 비즈니스 규칙을 강제 (최소 1개 아이템)
     * - 도메인 이벤트를 자동 발행
     * - new는 이 규칙들을 우회할 수 있음
     */
    static create(id: number, customerId: number, items: { name: string; price: Money }[]): Order {
        if (items.length === 0) {
            throw new Error("주문에는 최소 1개의 아이템이 필요합니다")
        }

        const order = new Order()
        order._id = id
        order._customerId = customerId
        order._status = OrderStatus.CREATED

        // 아이템 추가 + 총액 계산
        let total = Money.create(0)
        items.forEach((item, i) => {
            order._items.push({ id: i + 1, name: item.name, price: item.price })
            total = total.add(item.price)
        })
        order._totalAmount = total

        // 도메인 이벤트 발행 (축적)
        order._domainEvents.push(new OrderCreatedEvent(id, customerId, total))

        return order
    }

    // ---- Domain Logic ----

    /**
     * 도메인 로직: 결제 완료
     * 상태 전이 규칙: CREATED → PAID만 허용
     */
    markAsPaid(): void {
        if (this._status !== OrderStatus.CREATED) {
            throw new Error(
                `결제할 수 없는 상태입니다: ${this._status} (CREATED 상태에서만 결제 가능)`
            )
        }
        this._status = OrderStatus.PAID
        console.log(`  주문 #${this._id}: CREATED → PAID`)
    }

    /**
     * 도메인 로직: 주문 완료
     * 상태 전이 규칙: PAID → COMPLETED만 허용
     */
    complete(): void {
        if (this._status !== OrderStatus.PAID) {
            throw new Error(
                `완료할 수 없는 상태입니다: ${this._status} (PAID 상태에서만 완료 가능)`
            )
        }
        this._status = OrderStatus.COMPLETED

        // 도메인 이벤트 발행
        this._domainEvents.push(new OrderCompletedEvent(this._id, new Date()))
        console.log(`  주문 #${this._id}: PAID → COMPLETED`)
    }

    /**
     * 도메인 로직: 주문 취소
     * 규칙: COMPLETED 상태에서는 취소 불가
     */
    cancel(): void {
        if (this._status === OrderStatus.COMPLETED) {
            throw new Error("완료된 주문은 취소할 수 없습니다")
        }
        this._status = OrderStatus.CANCELLED
        console.log(`  주문 #${this._id}: ${this._status} → CANCELLED`)
    }

    // ---- Domain Events ----
    getDomainEvents(): ReadonlyArray<LearningDomainEvent> {
        return [...this._domainEvents]
    }
    clearDomainEvents(): void {
        this._domainEvents = []
    }

    // ---- Getters ----
    get id(): number {
        return this._id
    }
    get status(): OrderStatus {
        return this._status
    }
    get totalAmount(): Money {
        return this._totalAmount
    }
    get items(): ReadonlyArray<OrderItem> {
        return this._items
    }
}

interface OrderItem {
    id: number
    name: string
    price: Money
}

// ============================================================
// 4. 실행: 정상 흐름
// ============================================================

console.log("--- 정상 흐름: 생성 → 결제 → 완료 ---")

const order = Order.create(1, 100, [
    { name: "TypeScript 입문서", price: Money.create(25000) },
    { name: "DDD 패턴", price: Money.create(35000) },
])

console.log(`주문 생성: #${order.id}, 총액: ${order.totalAmount}`)
console.log(`아이템: ${order.items.map((i) => i.name).join(", ")}`)

order.markAsPaid()
order.complete()

// 도메인 이벤트 확인
const events = order.getDomainEvents()
console.log(`\n발생한 이벤트 ${events.length}개:`)
events.forEach((e) => {
    console.log(`  - ${e.eventType} (${e.occurredAt.toISOString()})`)
})
order.clearDomainEvents()

// ============================================================
// 5. 실행: 잘못된 상태 전이 방지
// ============================================================

console.log("\n--- 잘못된 상태 전이 테스트 ---")

const order2 = Order.create(2, 200, [{ name: "Node.js 가이드", price: Money.create(30000) }])

// ❌ 결제 없이 바로 완료 시도
try {
    order2.complete()
} catch (e: unknown) {
    console.log(`예상된 에러: ${(e as Error).message}`)
}

// ❌ 완료된 주문 취소 시도
const order3 = Order.create(3, 300, [{ name: "Express 핸드북", price: Money.create(20000) }])
order3.markAsPaid()
order3.complete()

try {
    order3.cancel()
} catch (e: unknown) {
    console.log(`예상된 에러: ${(e as Error).message}`)
}

// ❌ 빈 주문 생성 시도
try {
    Order.create(4, 400, [])
} catch (e: unknown) {
    console.log(`예상된 에러: ${(e as Error).message}`)
}

console.log("\n✅ DDD 패턴 예제 완료!")
