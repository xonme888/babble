export {}

/**
 * 04-1. DDD 안티패턴(Pitfalls) - 잘못된 설계 패턴 8가지
 *
 * 실행: npx ts-node test/learning/04-1-ddd-pitfalls/examples.ts
 *
 * 순수 TypeScript로 동작 (TypeORM, DB 의존 없음)
 * 각 섹션은 "문제 재현 → 해결 방법"으로 구성됩니다.
 */

// ============================================================
// 1. Anemic Domain Model (빈약한 도메인 모델)
//    가장 흔한 DDD 안티패턴
// ============================================================

console.log("=== 1. Anemic Domain Model (빈약한 도메인 모델) ===\n")

/**
 * ❌ 문제: Entity가 데이터만 보유하고, 비즈니스 로직은 Service에
 *
 * - Entity는 getter/setter만 있는 데이터 홀더
 * - 모든 비즈니스 규칙이 Service에 흩어져 있음
 * - Service를 거치지 않으면 검증이 우회됨
 */
{
    // 빈약한 Entity - public 필드만 있는 데이터 홀더
    class ExAnemicUser {
        public id: number
        public email: string
        public weeklyGoal: number
        public isActive: boolean

        constructor(id: number, email: string) {
            this.id = id
            this.email = email
            this.weeklyGoal = 35
            this.isActive = true
        }
    }

    // 모든 로직이 Service에 존재
    class ExAnemicUserService {
        updateWeeklyGoal(user: ExAnemicUser, goal: number): void {
            if (goal < 1) {
                throw new Error("주간 목표는 1 이상이어야 합니다")
            }
            user.weeklyGoal = goal
        }
    }

    const user = new ExAnemicUser(1, "test@example.com")
    const service = new ExAnemicUserService()

    // Service를 통해 변경하면 검증됨
    service.updateWeeklyGoal(user, 50)
    console.log(`[문제] Service로 변경: weeklyGoal = ${user.weeklyGoal}`) // 50

    // ⚠️ 하지만 Service를 거치지 않으면? 검증 우회!
    user.weeklyGoal = -10
    console.log(`[문제] 직접 변경: weeklyGoal = ${user.weeklyGoal}`) // -10 ← 잘못된 값!
    console.log(`  → Entity 필드가 public이라 누구나 직접 변경 가능`)
    console.log(`  → 검증 로직이 Service에만 있으므로 우회됨`)
}

console.log("")

/**
 * ✅ 해결: Rich Domain Model - 비즈니스 로직을 Entity 내부에
 *
 * 프로젝트 참조:
 *   - src/features/user/domain/user.entity.ts:145-150 — updateWeeklyGoal()
 *   - src/features/assessment/domain/assessment.entity.ts:163 — startAnalysis()
 */
{
    class ExRichUser {
        private _weeklyGoal: number = 35

        constructor(
            private readonly _id: number,
            private readonly _email: string
        ) {}

        // 비즈니스 규칙이 Entity 안에 존재
        updateWeeklyGoal(goal: number): void {
            if (goal < 1) {
                throw new Error("주간 목표는 1 이상이어야 합니다")
            }
            this._weeklyGoal = goal
        }

        get weeklyGoal(): number {
            return this._weeklyGoal
        }
    }

    const user = new ExRichUser(1, "test@example.com")

    user.updateWeeklyGoal(50)
    console.log(`[해결] 메서드로 변경: weeklyGoal = ${user.weeklyGoal}`) // 50

    try {
        user.updateWeeklyGoal(-10) // ❌ Entity가 직접 거부
    } catch (e: unknown) {
        console.log(`[해결] 잘못된 값 시도: ${(e as Error).message}`)
    }

    // user._weeklyGoal = -10  // ← 컴파일 에러! private 필드
    console.log(`  → private 필드 + 비즈니스 메서드로 규칙을 강제`)
}

// ============================================================
// 2. Primitive Obsession (원시 타입 집착)
// ============================================================

console.log("\n=== 2. Primitive Obsession (원시 타입 집착) ===\n")

/**
 * ❌ 문제: email을 string, money를 number로 표현
 *
 * - 유효하지 않은 값이 시스템에 들어올 수 있음
 * - 검증 로직이 여러 곳에 중복 or 누락됨
 */
{
    function createUser(email: string, balance: number) {
        // 검증을 까먹으면?
        return { email, balance }
    }

    const badUser = createUser("not-an-email", -500)
    console.log(`[문제] 잘못된 유저 생성됨:`, badUser)
    console.log(`  → email 검증 없음, 음수 잔액 허용`)
}

console.log("")

/**
 * ✅ 해결: Value Object로 감싸기
 *
 * 프로젝트 참조:
 *   - src/features/user/domain/value-objects/email.vo.ts:22-41 — Email.create()
 *   - src/features/user/domain/value-objects/password.vo.ts — Password.create()
 */
{
    class ExEmail {
        private readonly _value: string

        private constructor(value: string) {
            this._value = value
        }

        static create(email: string): ExEmail {
            if (!email) {
                throw new Error("이메일이 비어있습니다")
            }
            const trimmed = email.trim()
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(trimmed)) {
                throw new Error(`잘못된 이메일 형식: ${trimmed}`)
            }
            // 소문자 정규화 — 한 번만 처리하면 이후에는 항상 유효
            return new ExEmail(trimmed.toLowerCase())
        }

        get value(): string {
            return this._value
        }

        equals(other: ExEmail): boolean {
            return this._value === other._value
        }
    }

    class ExMoney {
        private constructor(
            private readonly _amount: number,
            private readonly _currency: string
        ) {}

        static create(amount: number, currency: string = "KRW"): ExMoney {
            if (amount < 0) {
                throw new Error(`금액은 음수가 될 수 없습니다: ${amount}`)
            }
            return new ExMoney(amount, currency)
        }

        get amount(): number {
            return this._amount
        }
        get currency(): string {
            return this._currency
        }
    }

    // 유효한 값만 생성 가능
    const email = ExEmail.create("TEST@Example.COM")
    console.log(`[해결] 정규화된 이메일: ${email.value}`) // test@example.com

    const balance = ExMoney.create(10000)
    console.log(`[해결] 유효한 잔액: ${balance.amount}${balance.currency}`)

    // 잘못된 값은 생성 시점에 거부
    try {
        ExEmail.create("not-an-email")
    } catch (e: unknown) {
        console.log(`[해결] 이메일 검증: ${(e as Error).message}`)
    }
    try {
        ExMoney.create(-500)
    } catch (e: unknown) {
        console.log(`[해결] 금액 검증: ${(e as Error).message}`)
    }
    console.log(`  → 생성 시점에 한 번만 검증하면 이후에는 항상 유효`)
}

// ============================================================
// 3. Constructor 노출 (불변식 우회)
// ============================================================

console.log("\n=== 3. Constructor 노출 (불변식 우회) ===\n")

/**
 * ❌ 문제: public constructor로 유효하지 않은 상태의 객체 생성 가능
 */
{
    class ExBadProduct {
        constructor(
            public name: string,
            public price: number,
            public stock: number
        ) {}
    }

    const bad = new ExBadProduct("", -100, -5)
    console.log(`[문제] 잘못된 상품:`, { name: bad.name, price: bad.price, stock: bad.stock })
    console.log(`  → 빈 이름, 음수 가격, 음수 재고 모두 허용`)
}

console.log("")

/**
 * ✅ 해결: private constructor + static create() Factory Method
 *
 * 프로젝트 참조:
 *   - src/features/user/domain/user.entity.ts:82-99 — User.register()
 *   - src/features/assessment/domain/assessment.entity.ts:124-141 — Assessment.create()
 */
{
    class ExGoodProduct {
        private constructor(
            private readonly _name: string,
            private readonly _price: number,
            private _stock: number
        ) {}

        static create(name: string, price: number, stock: number): ExGoodProduct {
            if (!name || name.trim().length === 0) {
                throw new Error("상품명은 비어있을 수 없습니다")
            }
            if (price < 0) {
                throw new Error(`가격은 음수가 될 수 없습니다: ${price}`)
            }
            if (stock < 0) {
                throw new Error(`재고는 음수가 될 수 없습니다: ${stock}`)
            }
            return new ExGoodProduct(name.trim(), price, stock)
        }

        get name(): string {
            return this._name
        }
        get price(): number {
            return this._price
        }
        get stock(): number {
            return this._stock
        }
    }

    const good = ExGoodProduct.create("TypeScript 교과서", 25000, 100)
    console.log(`[해결] 유효한 상품: ${good.name}, ${good.price}원, 재고 ${good.stock}`)

    // 잘못된 값은 Factory에서 거부
    const cases = [
        () => ExGoodProduct.create("", 100, 10),
        () => ExGoodProduct.create("책", -100, 10),
        () => ExGoodProduct.create("책", 100, -5),
    ]
    for (const fn of cases) {
        try {
            fn()
        } catch (e: unknown) {
            console.log(`[해결] 검증 실패: ${(e as Error).message}`)
        }
    }
    // const p = new ExGoodProduct(...)  // ← 컴파일 에러! private constructor
    console.log(`  → private constructor로 외부 new 차단, Factory만 인스턴스 생성 가능`)
}

// ============================================================
// 4. Mutable Value Object (변경 가능한 값 객체)
// ============================================================

console.log("\n=== 4. Mutable Value Object (변경 가능한 값 객체) ===\n")

/**
 * ❌ 문제: Value Object의 필드가 public → 의도치 않은 변경
 */
{
    class ExMutableMoney {
        constructor(
            public amount: number,
            public currency: string
        ) {}
    }

    const price = new ExMutableMoney(10000, "KRW")

    // 두 곳에서 같은 객체 참조
    const cart = { total: price }
    const receipt = { amount: price }

    console.log(`[문제] 변경 전 - cart: ${cart.total.amount}, receipt: ${receipt.amount.amount}`)

    // 한쪽만 변경했는데...
    price.amount = 500

    console.log(`[문제] 변경 후 - cart: ${cart.total.amount}, receipt: ${receipt.amount.amount}`)
    console.log(`  → 한쪽 변경이 다른 쪽에 영향! (같은 참조를 공유)`)
}

console.log("")

/**
 * ✅ 해결: readonly 필드 + 변경 시 새 객체 반환 (불변성)
 *
 * 프로젝트 참조:
 *   - src/features/user/domain/value-objects/email.vo.ts:13 — private readonly _value
 *   - src/features/user/domain/value-objects/password.vo.ts — readonly hashedValue
 */
{
    class ExImmutableMoney {
        private constructor(
            private readonly _amount: number,
            private readonly _currency: string
        ) {}

        static create(amount: number, currency: string = "KRW"): ExImmutableMoney {
            return new ExImmutableMoney(amount, currency)
        }

        get amount(): number {
            return this._amount
        }
        get currency(): string {
            return this._currency
        }

        // 변경 시 새 객체를 반환 — 원본은 불변
        add(other: ExImmutableMoney): ExImmutableMoney {
            if (this._currency !== other._currency) {
                throw new Error("통화가 다릅니다")
            }
            return ExImmutableMoney.create(this._amount + other._amount, this._currency)
        }

        subtract(other: ExImmutableMoney): ExImmutableMoney {
            if (this._currency !== other._currency) {
                throw new Error("통화가 다릅니다")
            }
            const result = this._amount - other._amount
            if (result < 0) {
                throw new Error("결과 금액이 음수입니다")
            }
            return ExImmutableMoney.create(result, this._currency)
        }
    }

    const original = ExImmutableMoney.create(10000)
    const discount = ExImmutableMoney.create(2000)
    const final = original.subtract(discount)

    console.log(`[해결] 원본: ${original.amount}원`)
    console.log(`[해결] 할인: ${discount.amount}원`)
    console.log(`[해결] 결과: ${final.amount}원`)
    console.log(`[해결] 원본 불변 확인: ${original.amount}원 (변경 안 됨)`)
    // original._amount = 500  // ← 컴파일 에러! readonly
    console.log(`  → add(), subtract()는 새 객체를 반환하고 원본은 변경 없음`)
}

// ============================================================
// 5. Missing Domain Events (도메인 이벤트 누락)
// ============================================================

console.log("\n=== 5. Missing Domain Events (도메인 이벤트 누락) ===\n")

/**
 * ❌ 문제: 메서드 안에서 부수 효과를 직접 호출 → 강결합 + OCP 위반
 */
{
    class ExEmailService {
        send(to: string, msg: string): void {
            console.log(`    [Email] ${to}: ${msg}`)
        }
    }
    class ExInventoryService {
        decreaseStock(itemId: number): void {
            console.log(`    [Inventory] 아이템 #${itemId} 재고 감소`)
        }
    }
    class ExAnalyticsService {
        track(event: string): void {
            console.log(`    [Analytics] ${event}`)
        }
    }

    // 모든 부수 효과를 직접 호출 — 새 기능 추가 시마다 이 메서드를 수정해야 함
    class ExDirectOrderService {
        constructor(
            private email: ExEmailService,
            private inventory: ExInventoryService,
            private analytics: ExAnalyticsService
        ) {}

        pay(orderId: number, customerEmail: string): void {
            console.log(`  주문 #${orderId} 결제 처리`)
            this.email.send(customerEmail, "결제 완료!")
            this.inventory.decreaseStock(orderId)
            this.analytics.track(`order_paid_${orderId}`)
            // 쿠폰 적용, 알림 전송 등 추가되면? → 이 메서드를 계속 수정
        }
    }

    console.log("[문제] 직접 호출 방식:")
    const svc = new ExDirectOrderService(
        new ExEmailService(),
        new ExInventoryService(),
        new ExAnalyticsService()
    )
    svc.pay(1, "user@example.com")
    console.log(`  → pay()가 3개 서비스에 직접 의존 (테스트 시 모두 Mock 필요)`)
    console.log(`  → 새 기능 추가 시 pay() 메서드 수정 필요 (OCP 위반)`)
}

console.log("")

/**
 * ✅ 해결: Domain Event를 발행하고, 핸들러가 독립적으로 반응
 *
 * 프로젝트 참조:
 *   - src/features/user/domain/user.entity.ts:186-195 — emitRegisteredEvent()
 *   - src/features/assessment/domain/assessment.entity.ts:146-156 — emitCreatedEvent()
 *   - src/shared/lib/events/event-dispatcher.ts — 핸들러 등록 및 디스패치
 */
{
    // 간단한 이벤트 시스템
    type EventHandler = (data: unknown) => void
    const handlers: Map<string, EventHandler[]> = new Map()

    function on(eventType: string, handler: EventHandler): void {
        const list = handlers.get(eventType) || []
        list.push(handler)
        handlers.set(eventType, list)
    }

    function emit(eventType: string, data: unknown): void {
        const list = handlers.get(eventType) || []
        list.forEach((h) => h(data))
    }

    // Entity가 이벤트를 발행
    class ExEventOrder {
        private _events: { type: string; data: unknown }[] = []

        constructor(private _id: number) {}

        pay(customerEmail: string): void {
            console.log(`  주문 #${this._id} 결제 처리`)
            this._events.push({
                type: "OrderPaid",
                data: { orderId: this._id, email: customerEmail },
            })
        }

        getEvents() {
            return [...this._events]
        }
        clearEvents() {
            this._events = []
        }
    }

    // 핸들러를 독립적으로 등록 — 서로 모름
    on("OrderPaid", (data) => console.log(`    [Email] ${(data as any).email}: 결제 완료!`))
    on("OrderPaid", (data) => console.log(`    [Inventory] 주문 #${data.orderId} 재고 감소`))
    on("OrderPaid", (data) => console.log(`    [Analytics] order_paid_${data.orderId}`))

    console.log("[해결] 이벤트 기반 방식:")
    const order = new ExEventOrder(1)
    order.pay("user@example.com")

    // 이벤트 디스패치
    for (const event of order.getEvents()) {
        emit(event.type, event.data)
    }
    order.clearEvents()

    console.log(`  → pay()는 이벤트만 발행. 핸들러는 독립적으로 등록/제거 가능`)
    console.log(`  → 새 기능 = 새 핸들러 추가 (기존 코드 수정 불필요)`)
}

// ============================================================
// 6. Aggregate Root 우회
// ============================================================

console.log("\n=== 6. Aggregate Root 우회 ===\n")

/**
 * ❌ 문제: 내부 컬렉션이 public → Root를 거치지 않고 직접 수정 가능
 */
{
    interface ExCartItem {
        name: string
        quantity: number
        price: number
    }

    class ExUnsafeCart {
        public items: ExCartItem[] = []

        addItem(name: string, quantity: number, price: number): void {
            if (quantity < 1) throw new Error("수량은 1 이상이어야 합니다")
            if (price < 0) throw new Error("가격은 음수가 될 수 없습니다")
            this.items.push({ name, quantity, price })
        }
    }

    const cart = new ExUnsafeCart()
    cart.addItem("책", 2, 25000)
    console.log(`[문제] 정상 추가: ${JSON.stringify(cart.items)}`)

    // ⚠️ Root의 addItem()을 우회하여 직접 변경
    cart.items[0].quantity = -10 // 음수 수량!
    console.log(`[문제] 직접 변경: quantity = ${cart.items[0].quantity}`)

    cart.items.push({ name: "해킹", quantity: 0, price: -9999 }) // 검증 우회!
    console.log(`[문제] 직접 push: ${JSON.stringify(cart.items[1])}`)
    console.log(`  → public 배열이라 Root의 검증 메서드를 우회 가능`)
}

console.log("")

/**
 * ✅ 해결: private 컬렉션 + Root 메서드만 노출 + 복사본 반환
 *
 * 프로젝트 참조:
 *   - src/features/user/domain/user.entity.ts:145-150 — Root 메서드를 통한 상태 변경
 *   - src/features/assessment/domain/assessment.entity.ts:163-190 — 상태 전이는 Root만 가능
 */
{
    interface ExSafeCartItem {
        readonly name: string
        readonly quantity: number
        readonly price: number
    }

    class ExSafeCart {
        private _items: ExSafeCartItem[] = []

        addItem(name: string, quantity: number, price: number): void {
            if (quantity < 1) throw new Error("수량은 1 이상이어야 합니다")
            if (price < 0) throw new Error("가격은 음수가 될 수 없습니다")
            this._items.push({ name, quantity, price })
        }

        updateQuantity(itemName: string, quantity: number): void {
            if (quantity < 1) throw new Error("수량은 1 이상이어야 합니다")
            const idx = this._items.findIndex((i) => i.name === itemName)
            if (idx === -1) throw new Error(`아이템 '${itemName}'을 찾을 수 없습니다`)
            this._items[idx] = { ...this._items[idx], quantity }
        }

        // 복사본 반환 — 원본 배열 수정 불가
        getItems(): ReadonlyArray<ExSafeCartItem> {
            return this._items.map((i) => ({ ...i }))
        }

        get totalPrice(): number {
            return this._items.reduce((sum, i) => sum + i.price * i.quantity, 0)
        }
    }

    const cart = new ExSafeCart()
    cart.addItem("책", 2, 25000)
    console.log(`[해결] 정상 추가: ${JSON.stringify(cart.getItems())}`)

    // Root 메서드를 통해서만 변경 가능
    cart.updateQuantity("책", 5)
    console.log(`[해결] 수량 변경: quantity = ${cart.getItems()[0].quantity}`)

    // 잘못된 수량은 Root가 거부
    try {
        cart.updateQuantity("책", -10)
    } catch (e: unknown) {
        console.log(`[해결] 음수 수량 거부: ${(e as Error).message}`)
    }

    // getItems() 반환값을 수정해도 원본에 영향 없음
    const snapshot = cart.getItems()
    ;(snapshot as unknown)[0] = { name: "해킹", quantity: 0, price: -9999 }
    console.log(`[해결] 외부 수정 시도 후 원본: ${JSON.stringify(cart.getItems())}`)
    console.log(`  → private 컬렉션 + 복사본 반환으로 Root 우회 방지`)
}

// ============================================================
// 7. 잘못된 동등성 비교
// ============================================================

console.log("\n=== 7. 잘못된 동등성 비교 ===\n")

/**
 * ❌ 문제: === 참조 비교로 Entity/VO를 비교 → 항상 false
 */
{
    class ExBadEntity {
        constructor(
            public id: number,
            public name: string
        ) {}
    }

    class ExBadVO {
        constructor(public value: string) {}
    }

    const entity1 = new ExBadEntity(1, "Alice")
    const entity2 = new ExBadEntity(1, "Alice Updated") // 같은 ID
    console.log(`[문제] 같은 ID Entity, === 비교: ${entity1 === entity2}`) // false

    const vo1 = new ExBadVO("test@example.com")
    const vo2 = new ExBadVO("test@example.com") // 같은 값
    console.log(`[문제] 같은 값 VO, === 비교: ${vo1 === vo2}`) // false

    // 배열에서 찾기 실패
    const list = [entity1]
    const found = list.includes(entity2)
    console.log(`[문제] 배열에서 같은 ID 찾기: ${found}`) // false!
    console.log(`  → JavaScript에서 === 는 참조 비교이므로, 같은 ID/값이어도 false`)
}

console.log("")

/**
 * ✅ 해결: equals() 메서드 구현
 *   - Entity: ID 기반 비교
 *   - Value Object: 값 기반 비교
 *
 * 프로젝트 참조:
 *   - src/features/user/domain/value-objects/email.vo.ts:53-58 — equals() 값 기반 비교
 */
{
    class ExEntity {
        constructor(
            private readonly _id: number,
            private _name: string
        ) {}

        get id(): number {
            return this._id
        }

        // Entity는 ID가 같으면 같은 객체
        equals(other: ExEntity): boolean {
            if (!other) return false
            return this._id === other._id
        }
    }

    class ExValueObject {
        private constructor(private readonly _value: string) {}

        static create(value: string): ExValueObject {
            return new ExValueObject(value.toLowerCase().trim())
        }

        get value(): string {
            return this._value
        }

        // Value Object는 값이 같으면 같은 객체
        equals(other: ExValueObject): boolean {
            if (!other) return false
            return this._value === other._value
        }
    }

    const e1 = new ExEntity(1, "Alice")
    const e2 = new ExEntity(1, "Alice Updated") // 같은 ID, 다른 이름
    const e3 = new ExEntity(2, "Alice") // 다른 ID, 같은 이름

    console.log(`[해결] Entity(id=1) vs Entity(id=1): ${e1.equals(e2)}`) // true
    console.log(`[해결] Entity(id=1) vs Entity(id=2): ${e1.equals(e3)}`) // false

    const v1 = ExValueObject.create("TEST@Example.COM")
    const v2 = ExValueObject.create("test@example.com") // 같은 값(정규화 후)
    const v3 = ExValueObject.create("other@example.com")

    console.log(`[해결] VO("test@...") vs VO("test@..."): ${v1.equals(v2)}`) // true
    console.log(`[해결] VO("test@...") vs VO("other@..."): ${v1.equals(v3)}`) // false

    // 배열에서 equals()로 찾기
    const entities = [e1]
    const foundById = entities.some((e) => e.equals(e2))
    console.log(`[해결] 배열에서 equals()로 찾기: ${foundById}`) // true
    console.log(`  → === 대신 equals() 사용. Entity는 ID, VO는 값으로 비교`)
}

// ============================================================
// 8. 비즈니스 로직 위치 오류
// ============================================================

console.log("\n=== 8. 비즈니스 로직 위치 오류 ===\n")

/**
 * ❌ 문제: 같은 검증 로직이 Controller와 Service에 중복
 *
 * - 두 곳의 규칙이 다르면? → 불일치 버그
 * - CLI, 배치, 다른 API에서 같은 로직 필요하면? → 복붙
 */
{
    class ExBadController {
        handleRequest(weeklyGoal: number): string {
            // Controller에 비즈니스 규칙이 있음 (잘못된 위치!)
            if (weeklyGoal < 1 || weeklyGoal > 100) {
                return "ERROR: 주간 목표는 1~100 사이여야 합니다"
            }
            return `OK: ${weeklyGoal}`
        }
    }

    class ExBadService {
        updateGoal(userId: number, weeklyGoal: number): void {
            // Service에도 비슷한 규칙이 중복 (하지만 범위가 다름!)
            if (weeklyGoal < 1) {
                throw new Error("주간 목표는 1 이상이어야 합니다")
            }
            // 여기선 100 상한이 없음... → 규칙 불일치!
            console.log(`    Service: user #${userId} 목표 → ${weeklyGoal}`)
        }
    }

    console.log("[문제] Controller와 Service의 규칙이 다름:")
    const ctrl = new ExBadController()
    const svc = new ExBadService()

    // Controller는 150을 거부
    console.log(`  Controller(150): ${ctrl.handleRequest(150)}`)

    // 하지만 Service는 150을 허용! (상한 규칙 없음)
    svc.updateGoal(1, 150)
    console.log(`  → Controller는 1~100, Service는 1~ 만 체크 → 규칙 불일치`)
}

console.log("")

/**
 * ✅ 해결: 도메인 규칙은 Entity 한 곳에만. Controller/Service는 위임만.
 *
 * 프로젝트 참조:
 *   - src/features/user/domain/user.entity.ts:145-150 — 도메인 규칙은 Entity에
 *   - src/features/user/user.service.ts:270-277 — Service는 Entity에 위임
 */
{
    // 도메인 규칙의 단일 원천 (Single Source of Truth)
    class ExCorrectUser {
        private _weeklyGoal: number = 35

        constructor(private readonly _id: number) {}

        updateWeeklyGoal(goal: number): void {
            if (goal < 1) {
                throw new Error("주간 목표는 1 이상이어야 합니다")
            }
            if (goal > 100) {
                throw new Error("주간 목표는 100 이하여야 합니다")
            }
            this._weeklyGoal = goal
        }

        get id(): number {
            return this._id
        }
        get weeklyGoal(): number {
            return this._weeklyGoal
        }
    }

    // Service는 Entity에 위임만 함
    class ExCorrectService {
        private users = new Map<number, ExCorrectUser>()

        constructor() {
            this.users.set(1, new ExCorrectUser(1))
        }

        updateWeeklyGoal(userId: number, goal: number): void {
            const user = this.users.get(userId)
            if (!user) throw new Error("유저를 찾을 수 없습니다")
            user.updateWeeklyGoal(goal) // 검증은 Entity가 수행
        }

        getGoal(userId: number): number {
            return this.users.get(userId)!.weeklyGoal
        }
    }

    // Controller도 Entity에 위임 (Service를 통해)
    class ExCorrectController {
        constructor(private service: ExCorrectService) {}

        handleRequest(userId: number, weeklyGoal: number): string {
            try {
                this.service.updateWeeklyGoal(userId, weeklyGoal)
                return `OK: ${this.service.getGoal(userId)}`
            } catch (e: unknown) {
                return `ERROR: ${(e as Error).message}`
            }
        }
    }

    console.log("[해결] 규칙은 Entity 한 곳에만:")
    const svc = new ExCorrectService()
    const ctrl = new ExCorrectController(svc)

    console.log(`  Controller(50): ${ctrl.handleRequest(1, 50)}`) // OK
    console.log(`  Controller(150): ${ctrl.handleRequest(1, 150)}`) // ERROR — Entity가 거부
    console.log(`  Controller(-5): ${ctrl.handleRequest(1, -5)}`) // ERROR — Entity가 거부
    console.log(`  → 규칙 변경 시 Entity 한 곳만 수정. Controller/Service는 위임만.`)
}

console.log("\n✅ DDD 안티패턴 8가지 예제 완료!")
