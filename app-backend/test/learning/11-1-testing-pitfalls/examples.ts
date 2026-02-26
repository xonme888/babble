export {}

/**
 * 11-1. 테스트 안티패턴(Pitfalls) - 테스트 설계 실수 8가지
 *
 * 실행: npx ts-node test/learning/11-1-testing-pitfalls/examples.ts
 *
 * 순수 TypeScript로 동작 (Jest 의존 없음)
 * Jest 없이 테스트 "구조"의 문제를 보여주는 데 집중합니다.
 * 실제 검증은 assert 함수로 대체합니다.
 */

// 간단한 테스트 유틸리티 (Jest 흉내)
let passCount = 0
let failCount = 0

function assert(condition: boolean, message: string): void {
    if (condition) {
        passCount++
    } else {
        failCount++
        console.log(`    ❌ FAIL: ${message}`)
    }
}

function section(title: string): void {
    console.log(`\n=== ${title} ===\n`)
}

// ============================================================
// 1. 구현 의존 테스트 (Implementation-Coupled Test)
//    내부 구현이 바뀌면 깨지는 테스트
// ============================================================

section("1. 구현 의존 테스트 (Implementation-Coupled Test)")

/**
 * ❌ 문제: 테스트가 "무엇을 하는가"가 아닌 "어떻게 하는가"를 검증
 *
 * - 내부 메서드 호출 순서, 호출 횟수를 검증
 * - 리팩토링하면 동작은 같은데 테스트가 깨짐
 */
{
    class ExCalculator {
        private log: string[] = []

        add(a: number, b: number): number {
            this.log.push(`add(${a}, ${b})`)
            return a + b
        }

        getLog(): string[] {
            return [...this.log]
        }
    }

    const calc = new ExCalculator()
    const result = calc.add(3, 5)

    // ⚠️ 구현 의존: "로그에 기록했는지"를 검증
    const log = calc.getLog()
    console.log("[문제] 구현 의존 테스트:")
    console.log(`  결과: ${result}`)
    console.log(`  로그 검증: ${JSON.stringify(log)}`)
    console.log(`  → "add(3, 5)"가 로그에 있는지 확인 ← 내부 구현에 의존!`)
    console.log(`  → 로그 형식을 바꾸면? 동작은 같은데 테스트가 깨짐`)
}

console.log("")

/**
 * ✅ 해결: 행위(결과)만 검증
 *
 * 프로젝트 참조:
 *   - test/user/unit/user-entity.spec.ts — Entity 상태 전이의 "결과"만 검증
 *   - test/assessment/unit/assessment-entity.spec.ts — status, retryCount 같은 "결과"
 */
{
    class ExCalculator2 {
        add(a: number, b: number): number {
            return a + b
        }
    }

    const calc = new ExCalculator2()
    const result = calc.add(3, 5)

    // 결과만 검증 — 내부 구현이 바뀌어도 테스트는 유효
    assert(result === 8, "3 + 5 = 8")
    console.log("[해결] 행위 기반 테스트:")
    console.log(`  assert(result === 8) → ${result === 8 ? "PASS" : "FAIL"}`)
    console.log(`  → 내부 구현을 어떻게 바꾸든, 결과가 8이면 통과`)
}

// ============================================================
// 2. 깨지기 쉬운 테스트 (Fragile Test)
//    관련 없는 변경에 깨지는 테스트
// ============================================================

section("2. 깨지기 쉬운 테스트 (Fragile Test)")

/**
 * ❌ 문제: 에러 메시지 전체 문자열을 비교
 *
 * - 메시지 문구가 약간만 바뀌어도 테스트 실패
 * - "비밀번호는 8자 이상" → "비밀번호는 8자 이상이어야 합니다"만으로도 깨짐
 */
{
    class ExValidator {
        validatePassword(pw: string): { valid: boolean; error?: string } {
            if (pw.length < 8) {
                return { valid: false, error: "비밀번호는 8자 이상이어야 합니다" }
            }
            return { valid: true }
        }
    }

    const v = new ExValidator()
    const result = v.validatePassword("short")

    // ⚠️ 전체 문자열 비교 — 한 글자만 바뀌어도 실패
    const exactMatch = result.error === "비밀번호는 8자 이상이어야 합니다"
    console.log("[문제] 전체 문자열 비교:")
    console.log(`  assert(error === "비밀번호는 8자 이상이어야 합니다") → ${exactMatch}`)
    console.log(`  → 메시지가 "비밀번호는 최소 8자입니다"로 바뀌면? 테스트 실패!`)
    console.log(`  → 동작(검증 실패)은 정확한데 메시지 문구 때문에 깨짐`)
}

console.log("")

/**
 * ✅ 해결: 핵심 행위만 검증, 세부 구현은 느슨하게
 *
 * 프로젝트 참조:
 *   - test/user/unit/user-entity.spec.ts:56 — toThrow(ValidationException) 타입만 검증
 *   - test/auth/unit/auth.service.spec.ts:163 — rejects.toThrow() 예외 발생 여부만
 */
{
    class ExValidator2 {
        validatePassword(pw: string): { valid: boolean; error?: string } {
            if (pw.length < 8) {
                return { valid: false, error: "비밀번호는 최소 8자입니다" }
            }
            return { valid: true }
        }
    }

    const v = new ExValidator2()
    const result = v.validatePassword("short")

    // 핵심 행위만 검증
    assert(result.valid === false, "짧은 비밀번호는 유효하지 않음")
    assert(result.error !== undefined, "에러 메시지가 존재함")

    console.log("[해결] 핵심 행위만 검증:")
    console.log(`  assert(result.valid === false) → ${result.valid === false}`)
    console.log(`  assert(result.error !== undefined) → ${result.error !== undefined}`)
    console.log(`  → 메시지 문구가 바뀌어도, "유효하지 않음 + 에러 있음"이면 통과`)
}

// ============================================================
// 3. Mock 과다 사용 (Mock Overuse)
//    모든 것을 Mock하면 실제 동작을 검증하지 못함
// ============================================================

section("3. Mock 과다 사용 (Mock Overuse)")

/**
 * ❌ 문제: 테스트 대상 자체를 Mock하여 아무것도 검증하지 못함
 */
{
    // 실제 비즈니스 로직
    class _ExPriceCalculator {
        calculateDiscount(price: number, discountRate: number): number {
            if (discountRate < 0 || discountRate > 1) {
                throw new Error("할인율은 0~1 사이여야 합니다")
            }
            return Math.round(price * (1 - discountRate))
        }
    }

    // ⚠️ 테스트 대상 자체를 Mock
    const mockCalculator = {
        calculateDiscount: (price: number, _rate: number) => price * 0.8, // 항상 20% 할인
    }

    const result = mockCalculator.calculateDiscount(10000, 0.3) // 30%인데 20%가 적용됨

    console.log("[문제] 테스트 대상을 Mock:")
    console.log(`  Mock 결과: ${result} (항상 20% 할인)`)
    console.log(`  → 30% 할인을 넣었는데 20%가 나옴. 하지만 "테스트 통과"`)
    console.log(`  → 실제 calculateDiscount의 로직은 전혀 실행되지 않음!`)
    console.log(`  → Mock이 Mock을 테스트하는 순환`)
}

console.log("")

/**
 * ✅ 해결: 테스트 대상은 실제 객체, 의존성만 Mock
 *
 * 프로젝트 참조:
 *   - test/user/unit/user-entity.spec.ts — Entity는 실제 객체로 테스트 (Mock 없음)
 *   - test/auth/unit/auth.service.spec.ts:30-64 — Repository만 Mock, Service는 실제 객체
 */
{
    class ExPriceCalculator2 {
        calculateDiscount(price: number, discountRate: number): number {
            if (discountRate < 0 || discountRate > 1) {
                throw new Error("할인율은 0~1 사이여야 합니다")
            }
            return Math.round(price * (1 - discountRate))
        }
    }

    // 실제 객체로 테스트 — 진짜 로직이 실행됨
    const calculator = new ExPriceCalculator2()

    const r1 = calculator.calculateDiscount(10000, 0.3)
    assert(r1 === 7000, "10000원의 30% 할인 = 7000원")

    let threw = false
    try {
        calculator.calculateDiscount(10000, 1.5)
    } catch {
        threw = true
    }
    assert(threw, "할인율 1.5는 에러")

    console.log("[해결] 실제 객체 테스트:")
    console.log(`  10000원 30% 할인 = ${r1}원 → ${r1 === 7000 ? "PASS" : "FAIL"}`)
    console.log(`  할인율 1.5 → 에러 발생 → ${threw ? "PASS" : "FAIL"}`)
    console.log(`  → 순수 로직은 Mock 없이 직접 테스트. Mock은 외부 의존(DB, API)에만`)
}

// ============================================================
// 4. 테스트 간 커플링 (Shared State Between Tests)
//    한 테스트가 다른 테스트에 영향
// ============================================================

section("4. 테스트 간 커플링 (Shared State Between Tests)")

/**
 * ❌ 문제: 테스트끼리 상태를 공유하여 실행 순서에 따라 결과가 달라짐
 */
{
    // 공유 상태
    const sharedUsers: string[] = []

    // 테스트 A: 유저 추가
    function testA_addUser(): boolean {
        sharedUsers.push("alice")
        return sharedUsers.length === 1
    }

    // 테스트 B: 유저 추가 (테스트 A가 먼저 실행되면 실패!)
    function testB_addUser(): boolean {
        sharedUsers.push("bob")
        return sharedUsers.length === 1 // ← 기대: 1개, 실제: 2개!
    }

    const resultA = testA_addUser()
    const resultB = testB_addUser()

    console.log("[문제] 공유 상태:")
    console.log(`  testA: 유저 ${sharedUsers.length - 1}명 → ${resultA ? "PASS" : "FAIL"}`)
    console.log(`  testB: 유저 ${sharedUsers.length}명 → ${resultB ? "PASS" : "FAIL"} ← 실패!`)
    console.log(`  → testA의 "alice"가 남아있어서 testB가 실패`)
    console.log(`  → 테스트 순서를 바꾸면? 다른 결과가 나옴`)
}

console.log("")

/**
 * ✅ 해결: 각 테스트마다 독립된 상태 (beforeEach 패턴)
 *
 * 프로젝트 참조:
 *   - test/auth/unit/auth.service.spec.ts:29-91 — beforeEach에서 모든 Mock을 새로 생성
 *   - test/fixtures/test-data.fixture.ts:213-218 — resetTestDataCounters()로 카운터 초기화
 */
{
    function createFreshState(): string[] {
        return [] // 매 테스트마다 새 배열
    }

    // 테스트 A: 독립된 상태
    function testA_isolated(): boolean {
        const users = createFreshState() // beforeEach 역할
        users.push("alice")
        return users.length === 1
    }

    // 테스트 B: 독립된 상태
    function testB_isolated(): boolean {
        const users = createFreshState() // beforeEach 역할
        users.push("bob")
        return users.length === 1
    }

    const resultA = testA_isolated()
    const resultB = testB_isolated()

    console.log("[해결] 독립된 상태:")
    console.log(`  testA: ${resultA ? "PASS" : "FAIL"}`)
    console.log(`  testB: ${resultB ? "PASS" : "FAIL"}`)
    console.log(`  → 각 테스트가 자기만의 상태를 가짐. 순서 무관하게 항상 동일한 결과`)
}

// ============================================================
// 5. 거대한 테스트 (Giant Test)
//    하나의 테스트가 너무 많은 것을 검증
// ============================================================

section("5. 거대한 테스트 (Giant Test)")

/**
 * ❌ 문제: 하나의 테스트에서 여러 시나리오를 한 번에 검증
 *
 * - 실패 시 어떤 시나리오가 문제인지 알 수 없음
 * - 테스트 이름이 포괄적이라 의도 파악이 어려움
 */
{
    class ExUserService {
        private users: Map<number, { name: string; email: string; active: boolean }> = new Map()
        private nextId = 1

        register(name: string, email: string): number {
            if (!name) throw new Error("이름 필수")
            if (!email.includes("@")) throw new Error("이메일 형식")
            const id = this.nextId++
            this.users.set(id, { name, email, active: true })
            return id
        }

        deactivate(id: number): void {
            const user = this.users.get(id)
            if (!user) throw new Error("유저 없음")
            user.active = false
        }

        getUser(id: number) {
            return this.users.get(id)
        }
    }

    // ⚠️ 하나의 "테스트"에 모든 것을 넣음
    console.log("[문제] 거대한 테스트 — test_유저_전체_기능():")
    const svc = new ExUserService()

    // 등록 테스트
    const id = svc.register("Kim", "kim@test.com")
    assert(id === 1, "ID가 1")

    // 조회 테스트
    const user = svc.getUser(id)
    assert(user?.name === "Kim", "이름이 Kim")
    assert(user?.active === true, "활성 상태")

    // 비활성화 테스트
    svc.deactivate(id)
    assert(svc.getUser(id)?.active === false, "비활성 상태")

    // 유효성 검증 테스트
    let err1 = false
    try {
        svc.register("", "a@b.com")
    } catch {
        err1 = true
    }
    assert(err1, "빈 이름 에러")

    let err2 = false
    try {
        svc.register("A", "invalid")
    } catch {
        err2 = true
    }
    assert(err2, "잘못된 이메일 에러")

    console.log(`  → 5개 검증이 하나의 테스트에. 3번째가 실패하면?`)
    console.log(`  → "유저 전체 기능 실패" ← 뭐가 문제인지 모름`)
}

console.log("")

/**
 * ✅ 해결: 하나의 테스트 = 하나의 시나리오 (AAA 패턴)
 *
 * 프로젝트 참조:
 *   - test/user/unit/user-entity.spec.ts — 각 it()이 하나의 시나리오만 검증
 *   - "weeklyGoal 1 미만이면 에러", "register() 정상 생성" 등 명확한 이름
 */
{
    class ExUserService2 {
        private users: Map<number, { name: string; email: string; active: boolean }> = new Map()
        private nextId = 1

        register(name: string, email: string): number {
            if (!name) throw new Error("이름 필수")
            if (!email.includes("@")) throw new Error("이메일 형식")
            const id = this.nextId++
            this.users.set(id, { name, email, active: true })
            return id
        }

        deactivate(id: number): void {
            const user = this.users.get(id)
            if (!user) throw new Error("유저 없음")
            user.active = false
        }

        getUser(id: number) {
            return this.users.get(id)
        }
    }

    console.log("[해결] 분리된 테스트:")

    // test_유저_등록_성공
    {
        const svc = new ExUserService2()
        const id = svc.register("Kim", "kim@test.com")
        assert(id >= 1, "유저 등록 시 양수 ID 반환")
        console.log(`  ✓ test_유저_등록_성공`)
    }

    // test_등록된_유저_조회
    {
        const svc = new ExUserService2()
        const id = svc.register("Kim", "kim@test.com")
        const user = svc.getUser(id)
        assert(user?.name === "Kim", "등록된 유저 이름 확인")
        console.log(`  ✓ test_등록된_유저_조회`)
    }

    // test_유저_비활성화
    {
        const svc = new ExUserService2()
        const id = svc.register("Kim", "kim@test.com")
        svc.deactivate(id)
        assert(svc.getUser(id)?.active === false, "비활성화 확인")
        console.log(`  ✓ test_유저_비활성화`)
    }

    // test_빈_이름으로_등록_시_에러
    {
        const svc = new ExUserService2()
        let threw = false
        try {
            svc.register("", "a@b.com")
        } catch {
            threw = true
        }
        assert(threw, "빈 이름 에러")
        console.log(`  ✓ test_빈_이름으로_등록_시_에러`)
    }

    console.log(`  → 각 테스트가 독립적. 실패 시 정확히 어떤 시나리오가 문제인지 즉시 파악`)
}

// ============================================================
// 6. 마법의 숫자/문자열 (Magic Values)
//    테스트 데이터의 의도가 불명확
// ============================================================

section("6. 마법의 숫자/문자열 (Magic Values)")

/**
 * ❌ 문제: 왜 이 값을 사용했는지 알 수 없음
 */
{
    class ExOrder {
        constructor(
            public id: number,
            public items: { name: string; price: number }[],
            public discountRate: number
        ) {}

        getTotal(): number {
            const subtotal = this.items.reduce((sum, i) => sum + i.price, 0)
            return Math.round(subtotal * (1 - this.discountRate))
        }
    }

    // ⚠️ 왜 42? 왜 15000? 왜 0.1?
    const order = new ExOrder(
        42,
        [
            { name: "A", price: 15000 },
            { name: "B", price: 8000 },
        ],
        0.1
    )

    const total = order.getTotal()
    assert(total === 20700, "총액 검증")

    console.log("[문제] 마법의 값:")
    console.log(`  new ExOrder(42, [{price: 15000}, {price: 8000}], 0.1)`)
    console.log(`  → 42는 뭔가? 15000은 경계값인가? 0.1은 왜 선택했나?`)
    console.log(`  → 6개월 후 돌아오면 이 값들의 의도를 알 수 없음`)
}

console.log("")

/**
 * ✅ 해결: 의도를 드러내는 변수명 + Factory 함수
 *
 * 프로젝트 참조:
 *   - test/fixtures/test-data.fixture.ts:50-65 — createTestUser() Factory
 *   - test/fixtures/test-data.fixture.ts:98-116 — createTestAssessment() Factory
 */
{
    class ExOrder2 {
        constructor(
            public id: number,
            public items: { name: string; price: number }[],
            public discountRate: number
        ) {}

        getTotal(): number {
            const subtotal = this.items.reduce((sum, i) => sum + i.price, 0)
            return Math.round(subtotal * (1 - this.discountRate))
        }
    }

    // Factory: 기본값 + 필요한 것만 오버라이드
    function createTestOrder(
        overrides?: Partial<{
            id: number
            items: { name: string; price: number }[]
            discountRate: number
        }>
    ): ExOrder2 {
        return new ExOrder2(
            overrides?.id ?? 1,
            overrides?.items ?? [{ name: "기본상품", price: 10000 }],
            overrides?.discountRate ?? 0
        )
    }

    // 의도가 명확한 테스트
    const TEN_PERCENT_DISCOUNT = 0.1
    const twoItemOrder = createTestOrder({
        items: [
            { name: "TypeScript 교과서", price: 15000 },
            { name: "DDD 입문", price: 8000 },
        ],
        discountRate: TEN_PERCENT_DISCOUNT,
    })

    const expectedSubtotal = 15000 + 8000 // 23000
    const expectedTotal = expectedSubtotal * 0.9 // 20700

    assert(twoItemOrder.getTotal() === expectedTotal, "10% 할인 적용 총액")

    console.log("[해결] 의도가 명확한 값:")
    console.log(`  TEN_PERCENT_DISCOUNT = 0.1`)
    console.log(`  expectedTotal = (15000 + 8000) * 0.9 = ${expectedTotal}`)
    console.log(`  → 변수명이 "왜 이 값인지"를 설명. Factory가 기본값을 제공`)
}

// ============================================================
// 7. 슬리핑 테스트 (Sleeping Test)
//    setTimeout/sleep으로 비동기 대기
// ============================================================

section("7. 슬리핑 테스트 (Sleeping Test)")

/**
 * ❌ 문제: 비동기 동작을 고정 시간 대기로 검증
 *
 * - 느린 환경(CI)에서 시간이 부족하면 실패
 * - 빠른 환경에서는 불필요한 대기 → 테스트 스위트 전체가 느려짐
 * - 시간을 넉넉히 잡으면? 100개 테스트 × 2초 = 200초
 */
{
    // 비동기 작업 시뮬레이션
    class _ExAsyncProcessor {
        private result: string | null = null

        process(input: string): void {
            // 비동기로 결과 설정 (실제로는 setTimeout/Promise)
            this.result = `processed: ${input}`
        }

        getResult(): string | null {
            return this.result
        }
    }

    console.log("[문제] 슬리핑 테스트:")
    console.log(`  // ⚠️ 실제 Jest에서 이런 코드`)
    console.log(`  processor.process("data")`)
    console.log(`  await sleep(2000)              // ← 2초 고정 대기!`)
    console.log(`  expect(processor.getResult()).toBe("processed: data")`)
    console.log(``)
    console.log(`  → CI에서 3초 걸리면? 실패. 로컬에서 0.1초면? 1.9초 낭비`)
    console.log(`  → 100개 테스트에 각 2초 → 200초(3분+) 낭비`)
}

console.log("")

/**
 * ✅ 해결: 이벤트/콜백 기반 또는 폴링 + 타임아웃
 *
 * 프로젝트 참조:
 *   - test/assessment/integration/assessment-flow.test.ts — 이벤트 기반 대기
 *   - Jest의 waitFor, fakeTimers 등 활용
 */
{
    // 해결 1: Promise 기반 (가장 깔끔)
    class ExAsyncProcessor2 {
        async process(input: string): Promise<string> {
            // 비동기 작업을 Promise로 반환
            return `processed: ${input}`
        }
    }

    async function test_async_process() {
        const processor = new ExAsyncProcessor2()
        const result = await processor.process("data") // 즉시 완료되면 즉시 진행
        assert(result === "processed: data", "비동기 처리 결과 검증")
        return result
    }

    test_async_process().then((result) => {
        console.log(`[해결] Promise 기반:`)
        console.log(
            `  const result = await processor.process("data")  // 대기 시간 = 실제 소요 시간`
        )
        console.log(`  결과: ${result}`)
    })

    // 해결 2: 폴링 + 타임아웃 패턴 (소개만)
    console.log(`\n[해결] 폴링 + 타임아웃 패턴 (비동기 상태 체크 시):`)
    console.log(`  async function waitFor(fn, timeout = 5000, interval = 100) {`)
    console.log(`    const start = Date.now()`)
    console.log(`    while (Date.now() - start < timeout) {`)
    console.log(`      if (fn()) return      // 조건 충족 시 즉시 리턴`)
    console.log(`      await sleep(interval)  // 짧은 간격으로 폴링`)
    console.log(`    }`)
    console.log(`    throw new Error("Timeout")`)
    console.log(`  }`)
    console.log(`  → 빠르면 빠르게, 느리면 타임아웃까지 대기. 고정 대기 없음`)
}

// ============================================================
// 8. 검증 없는 테스트 (Missing Assertion)
//    실행만 하고 결과를 확인하지 않음
// ============================================================

section("8. 검증 없는 테스트 (Missing Assertion)")

/**
 * ❌ 문제: 코드가 "에러 없이 실행되면 통과"로 간주
 *
 * - 잘못된 결과여도 에러만 안 나면 통과
 * - 커버리지는 높은데 실제로는 아무것도 검증하지 않음
 * - "false confidence" — 테스트가 있다는 안심감만 줌
 */
{
    class ExUserService3 {
        register(name: string, email: string): { id: number; name: string; email: string } {
            return { id: 1, name, email }
        }
    }

    // ⚠️ 실행만 하고 결과 검증 없음
    console.log("[문제] 검증 없는 테스트:")
    const svc = new ExUserService3()
    const user = svc.register("Kim", "kim@test.com") // 실행은 됨
    // ... assert가 없음!
    void user // 결과를 무시
    console.log(`  svc.register("Kim", "kim@test.com")`)
    console.log(`  // ← 여기서 끝. 결과 검증 없음!`)
    console.log(`  → 에러가 안 나면 통과. name이 "Alice"여도, email이 null이어도 통과`)
    console.log(`  → 커버리지 100%인데 버그를 잡는 테스트는 0개`)
}

console.log("")

/**
 * ✅ 해결: Given-When-Then + 명시적 검증
 *
 * 프로젝트 참조:
 *   - test/user/unit/user-entity.spec.ts:11-26 — Given-When-Then 주석 + expect()
 *   - test/auth/unit/auth.service.spec.ts:118-120 — Mock 호출 여부까지 검증
 */
{
    class ExUserService4 {
        register(name: string, email: string): { id: number; name: string; email: string } {
            return { id: 1, name, email }
        }
    }

    console.log("[해결] Given-When-Then + 명시적 검증:")

    // Given: 유효한 입력
    const svc = new ExUserService4()
    const name = "Kim"
    const email = "kim@test.com"

    // When: 등록 실행
    const user = svc.register(name, email)

    // Then: 결과 검증
    assert(user.id >= 1, "ID가 양수")
    assert(user.name === name, "입력한 이름과 일치")
    assert(user.email === email, "입력한 이메일과 일치")

    console.log(`  // Given: 유효한 입력`)
    console.log(`  // When: register(name, email)`)
    console.log(`  // Then:`)
    console.log(`  assert(user.id >= 1)        → ${user.id >= 1}`)
    console.log(`  assert(user.name === name)  → ${user.name === name}`)
    console.log(`  assert(user.email === email) → ${user.email === email}`)
    console.log(`  → 모든 중요한 속성을 명시적으로 검증`)
}

// ============================================================
// 최종 결과
// ============================================================

// Promise 완료를 기다린 후 결과 출력
setTimeout(() => {
    console.log(`\n${"=".repeat(50)}`)
    console.log(`테스트 결과: ${passCount} passed, ${failCount} failed`)
    console.log(`✅ 테스트 안티패턴 8가지 예제 완료!`)
}, 100)
