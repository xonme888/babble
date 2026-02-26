export {}

/**
 * 01. TypeScript 핵심 기능 - 실행 가능한 예제
 *
 * 실행: npx ts-node test/learning/01-typescript-fundamentals/examples.ts
 */
import "reflect-metadata"

// ============================================================
// 1. 클래스 데코레이터 - 클래스에 메타데이터를 부착
// ============================================================

/**
 * 이 프로젝트에서 @Entity("users")가 하는 일의 간소화 버전
 * 클래스를 DB 테이블과 매핑하기 위한 메타데이터를 저장
 */
function Entity(tableName: string) {
    return function (target: new (...args: unknown[]) => unknown) {
        Reflect.defineMetadata("entity:table", tableName, target as any)
        console.log(`[클래스 데코레이터] ${(target as any).name} → 테이블 "${tableName}" 매핑`)
    }
}

// ============================================================
// 2. 프로퍼티 데코레이터 - 프로퍼티에 메타데이터를 부착
// ============================================================

/**
 * 이 프로젝트에서 @Column({ type: "varchar" })이 하는 일의 간소화 버전
 */
function Column(options?: { type?: string; nullable?: boolean }) {
    return function (target: unknown, propertyKey: string) {
        // 해당 클래스의 컬럼 목록에 추가
        const columns = Reflect.getMetadata("entity:columns", (target as any).constructor) || []
        columns.push({ name: propertyKey, ...options })
        Reflect.defineMetadata("entity:columns", columns, (target as any).constructor)
        console.log(`  [프로퍼티 데코레이터] ${propertyKey}: ${options?.type || "auto"}`)
    }
}

// ============================================================
// 3. 메서드 데코레이터 - 메서드 실행 전후 로직 추가
// ============================================================

/**
 * 이 프로젝트에서 @Transactional()이 하는 일의 간소화 버전
 * 메서드 실행 전후에 트랜잭션을 관리
 */
function Log(target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = function (...args: unknown[]) {
        console.log(`  → [메서드 데코레이터] ${propertyKey}() 호출 시작`)
        const result = originalMethod.apply(this, args)
        console.log(`  ← [메서드 데코레이터] ${propertyKey}() 호출 완료`)
        return result
    }
}

// ============================================================
// 4. 파라미터 데코레이터 - 생성자 파라미터에 주입 토큰 지정
// ============================================================

/**
 * 이 프로젝트에서 @inject("ITokenProvider")가 하는 일의 간소화 버전
 */
function _Inject(token: string) {
    return function (target: unknown, _propertyKey: string | undefined, parameterIndex: number) {
        const tokens = Reflect.getMetadata("inject:tokens", target as any) || {}
        tokens[parameterIndex] = token
        Reflect.defineMetadata("inject:tokens", tokens, target as any)
        console.log(`    [파라미터 데코레이터] 파라미터 ${parameterIndex} → 토큰 "${token}"`)
    }
}

// ============================================================
// 데코레이터 적용 예제
// ============================================================

console.log("=== 데코레이터 적용 (클래스 로드 시 실행됨) ===\n")

@Entity("products")
class Product {
    @Column({ type: "int" })
    id!: number

    @Column({ type: "varchar" })
    name!: string

    @Column({ type: "float", nullable: true })
    price!: number

    @Log
    displayInfo(): string {
        return `상품: ${this.name} (${this.price}원)`
    }
}

// 메타데이터 읽기
console.log("\n=== 메타데이터 읽기 (런타임) ===\n")

const tableName = Reflect.getMetadata("entity:table", Product)
console.log(`테이블 이름: ${tableName}`)

const columns = Reflect.getMetadata("entity:columns", Product)
console.log(`컬럼 목록:`, columns)
Reflect.getMetadata("entity:columns", Product)

// 메서드 데코레이터 동작 확인
console.log("\n=== 메서드 데코레이터 동작 ===\n")
const product = new Product()
product.name = "TypeScript 입문서"
product.price = 25000
const info = product.displayInfo()
console.log(`결과: ${info}`)

// ============================================================
// 5. 제네릭 (Generic) - 타입 안전한 재사용 코드
// ============================================================

console.log("\n=== 제네릭 예제 ===\n")

/**
 * 이 프로젝트의 IDomainEventHandler<T>와 유사한 패턴
 */
interface Event {
    readonly eventType: string
    readonly occurredAt: Date
}

interface EventHandler<T extends Event> {
    handle(event: T): void
}

// 구체적인 이벤트 타입
interface OrderCreatedEvent extends Event {
    orderId: number
    customerName: string
}

interface PaymentCompletedEvent extends Event {
    paymentId: number
    amount: number
}

// 타입 안전한 핸들러
class OrderCreatedHandler implements EventHandler<OrderCreatedEvent> {
    handle(event: OrderCreatedEvent): void {
        // event.orderId ← 자동완성 지원!
        console.log(`주문 생성 처리: 주문 #${event.orderId}, 고객: ${event.customerName}`)
    }
}

class PaymentCompletedHandler implements EventHandler<PaymentCompletedEvent> {
    handle(event: PaymentCompletedEvent): void {
        console.log(`결제 완료 처리: 결제 #${event.paymentId}, 금액: ${event.amount}원`)
    }
}

const orderHandler = new OrderCreatedHandler()
orderHandler.handle({
    eventType: "OrderCreatedEvent",
    occurredAt: new Date(),
    orderId: 1,
    customerName: "홍길동",
})

const paymentHandler = new PaymentCompletedHandler()
paymentHandler.handle({
    eventType: "PaymentCompletedEvent",
    occurredAt: new Date(),
    paymentId: 100,
    amount: 25000,
})

// ============================================================
// 6. 문자열 Enum - DB 저장 시 가독성
// ============================================================

console.log("\n=== 문자열 Enum vs 숫자 Enum ===\n")

// 이 프로젝트에서 사용하는 방식 (문자열 Enum)
enum AssessmentStatus {
    PENDING = "PENDING",
    ANALYZING = "ANALYZING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
}

// 숫자 Enum (사용하지 않는 방식)
enum AssessmentStatusNumeric {
    PENDING = 0,
    ANALYZING = 1,
    COMPLETED = 2,
    FAILED = 3,
}

const status1 = AssessmentStatus.COMPLETED
const status2 = AssessmentStatusNumeric.COMPLETED

console.log(`문자열 Enum - DB에 저장되는 값: "${status1}" ← 의미 바로 파악`)
console.log(`숫자 Enum - DB에 저장되는 값: ${status2} ← "2가 뭐지?" 코드 확인 필요`)

// 상태 비교도 가독성이 다름
console.log(`\n문자열: status === "${AssessmentStatus.COMPLETED}" ✅ 읽기 쉬움`)
console.log(`숫자:   status === ${AssessmentStatusNumeric.COMPLETED} ❌ 의미 불명확`)

// ============================================================
// 7. DI 컨테이너 시뮬레이션 (tsyringe가 내부적으로 하는 일)
// ============================================================

console.log("\n=== DI 컨테이너 시뮬레이션 ===\n")

/**
 * 간단한 DI 컨테이너 (tsyringe의 핵심 원리)
 *
 * 왜 필요한가?
 * - UserService가 UserRepository를 직접 new로 생성하면,
 *   테스트에서 Mock으로 교체할 수 없음
 * - DI 컨테이너가 대신 생성하고 주입해줌
 */
class SimpleDIContainer {
    private registry = new Map<string, unknown>()

    register(token: string, instance: unknown): void {
        this.registry.set(token, instance)
        console.log(`  등록: "${token}" → ${(instance as any).constructor.name}`)
    }

    resolve<T>(token: string): T {
        const instance = this.registry.get(token)
        if (!instance) throw new Error(`"${token}" 토큰이 등록되지 않았습니다`)
        console.log(`  해결: "${token}" → ${(instance as any).constructor.name}`)
        return instance as T
    }
}

// 인터페이스 (실제로는 string 토큰으로 식별)
interface ILogger {
    info(message: string): void
}

class ConsoleLogger implements ILogger {
    info(message: string) {
        console.log(`[LOG] ${message}`)
    }
}

const container = new SimpleDIContainer()
container.register("ILogger", new ConsoleLogger())

const logger = container.resolve<ILogger>("ILogger")
logger.info("DI 컨테이너에서 주입된 로거입니다!")

console.log("\n✅ 모든 예제 실행 완료!")
