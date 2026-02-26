export {}

/**
 * 03-1. TypeORM ORM 함정(Pitfalls) - 실전 문제 케이스
 *
 * 실행: npx ts-node test/learning/03-1-typeorm-pitfalls/examples.ts
 *
 * ORM이 SQL을 숨기기 때문에 모르고 지나치는 8가지 문제를
 * SQLite In-Memory로 직접 재현하고 해결합니다.
 */
import "reflect-metadata"
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    JoinColumn,
    DataSource,
    VersionColumn,
} from "typeorm"

// ============================================================
// 엔티티 정의 (Ex 접두사로 프로젝트 소스와 충돌 방지)
// ============================================================

@Entity("ex_authors")
class ExAuthor {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: "varchar" })
    name!: string

    @Column({ type: "varchar", nullable: true })
    bio!: string | null

    @OneToMany(() => ExBook, (book) => book.author)
    books!: ExBook[]
}

@Entity("ex_books")
class ExBook {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: "varchar" })
    title!: string

    @Column({ type: "int", default: 0 })
    pages!: number

    @ManyToOne(() => ExAuthor, (author) => author.books)
    @JoinColumn({ name: "authorId" })
    author!: ExAuthor

    @Column({ type: "int" })
    authorId!: number
}

@Entity("ex_secure_users")
class ExSecureUser {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: "varchar" })
    email!: string

    @Column({ type: "varchar", select: false })
    password!: string
}

@Entity("ex_accounts")
class ExAccount {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: "varchar" })
    name!: string

    @Column({ type: "int" })
    balance!: number
}

@Entity("ex_parents")
class ExParent {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: "varchar" })
    name!: string

    @OneToMany(() => ExChild, (child) => child.parent)
    children!: ExChild[]
}

@Entity("ex_children")
class ExChild {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: "varchar" })
    name!: string

    // onDelete: "CASCADE" → DB 레벨에서 부모 삭제 시 자식도 삭제
    @ManyToOne(() => ExParent, (parent) => parent.children, { onDelete: "CASCADE" })
    @JoinColumn({ name: "parentId" })
    parent!: ExParent

    @Column({ type: "int" })
    parentId!: number
}

@Entity("ex_posts")
class ExPost {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: "varchar" })
    title!: string
}

@Entity("ex_versioned_accounts")
class ExVersionedAccount {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: "varchar" })
    name!: string

    @Column({ type: "int" })
    balance!: number

    @VersionColumn()
    version!: number
}

// ============================================================
// 쿼리 카운터 (N+1 문제 시각화용 커스텀 로거)
// ============================================================

class QueryCounter {
    queries: string[] = []
    enabled = false

    logQuery(query: string) {
        if (this.enabled) {
            this.queries.push(query)
            console.log(`    [SQL] ${query}`)
        }
    }
    logQueryError() {}
    logQuerySlow() {}
    logSchemaBuild() {}
    logMigration() {}
    log() {}

    reset() {
        this.queries = []
        this.enabled = true
    }
    stop() {
        this.enabled = false
    }
}

const queryCounter = new QueryCounter()

// ============================================================
// DataSource 설정
// ============================================================

const dataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5433,
    username: process.env.DATABASE_USERNAME ?? "postgres",
    password: process.env.DATABASE_PASSWORD ?? "postgres",
    database: "babble_learning",
    synchronize: true,
    logging: ["query"],
    logger: queryCounter as unknown,
    entities: [
        ExAuthor,
        ExBook,
        ExSecureUser,
        ExAccount,
        ExParent,
        ExChild,
        ExPost,
        ExVersionedAccount,
    ],
})

// ============================================================
// 유틸리티
// ============================================================

function header(section: number, title: string) {
    console.log("\n" + "=".repeat(60))
    console.log(`섹션 ${section}: ${title}`)
    console.log("=".repeat(60))
}

// ============================================================
// 섹션 1: N+1 Query 문제 (가장 치명적)
// ============================================================

async function demo1_NPlusOne() {
    header(1, "N+1 Query 문제 (가장 치명적)")

    const authorRepo = dataSource.getRepository(ExAuthor)
    const bookRepo = dataSource.getRepository(ExBook)

    // 데이터 준비: Author 3명, 각 2권
    for (const name of ["김영하", "한강", "박완서"]) {
        const author = authorRepo.create({ name, bio: `${name} 소개` })
        await authorRepo.save(author)
        await bookRepo.save([
            bookRepo.create({ title: `${name}의 첫 번째 책`, pages: 200, authorId: author.id }),
            bookRepo.create({ title: `${name}의 두 번째 책`, pages: 300, authorId: author.id }),
        ])
    }

    // ❌ 문제: N+1 쿼리 패턴
    console.log("\n  ❌ [문제] N+1 쿼리 패턴:")
    console.log("  작가 목록 조회 후, 각 작가의 책을 개별 쿼리로 조회\n")

    queryCounter.reset()
    const allAuthors = await authorRepo.find() // 1번 쿼리
    for (const author of allAuthors) {
        await bookRepo.find({ where: { authorId: author.id } }) // N번 추가 쿼리
    }
    queryCounter.stop()

    console.log(
        `\n  → 총 ${queryCounter.queries.length}개 쿼리 (1 + ${allAuthors.length} = ${1 + allAuthors.length})`
    )
    console.log("  데이터가 1만 건이면? 10,001개 쿼리 발생!\n")

    // ✅ 해결: relations로 JOIN
    console.log("  ✅ [해결] relations 옵션으로 JOIN 한 번에 로딩:\n")

    queryCounter.reset()
    const authorsWithBooks = await authorRepo.find({ relations: ["books"] })
    queryCounter.stop()

    console.log(`\n  → 총 ${queryCounter.queries.length}개 쿼리! (LEFT JOIN 1회)`)
    for (const a of authorsWithBooks) {
        console.log(`  ${a.name}: ${a.books.map((b) => b.title).join(", ")}`)
    }

    console.log("\n  📌 프로젝트 참조: assessment.repository.ts:25 - relations: ['script', 'user']")
}

// ============================================================
// 섹션 2: select: false 함정
// ============================================================

async function demo2_SelectFalse() {
    header(2, "select: false 함정")

    const userRepo = dataSource.getRepository(ExSecureUser)

    // 데이터 준비
    await userRepo.save(userRepo.create({ email: "admin@test.com", password: "hashed_secret_123" }))

    // ❌ 문제: password가 undefined
    console.log("\n  ❌ [문제] select: false 컬럼이 조회에서 누락:")

    const user = await userRepo.findOne({ where: { email: "admin@test.com" } })
    console.log(`  findOne 결과: email=${user?.email}, password=${user?.password}`)
    console.log("  → password가 undefined! 인증 로직에서 비교 실패")

    // 비밀번호 비교 시뮬레이션
    const inputPassword = "hashed_secret_123"
    const canLogin = user?.password === inputPassword
    console.log(`  → 로그인 가능? ${canLogin} (항상 false - password가 없으니까)\n`)

    // ✅ 해결: addSelect로 명시적 로딩
    console.log("  ✅ [해결] QueryBuilder + addSelect로 명시적 로딩:")

    const userWithPw = await userRepo
        .createQueryBuilder("user")
        .where("user.email = :email", { email: "admin@test.com" })
        .addSelect("user.password")
        .getOne()

    console.log(`  결과: email=${userWithPw?.email}, password=${userWithPw?.password}`)
    const canLoginNow = userWithPw?.password === inputPassword
    console.log(`  → 로그인 가능? ${canLoginNow} ✅`)

    console.log("\n  📌 프로젝트 참조:")
    console.log("    user.entity.ts:41 - @Column({ select: false })")
    console.log("    user.repository.ts:47 - .addSelect('user.password')")
}

// ============================================================
// 섹션 3: Transaction 없는 부분 저장
// ============================================================

async function demo3_Transaction() {
    header(3, "Transaction 없는 부분 저장")

    const accountRepo = dataSource.getRepository(ExAccount)

    // 데이터 준비: A=1000원, B=0원
    const accountA = accountRepo.create({ name: "A", balance: 1000 })
    const accountB = accountRepo.create({ name: "B", balance: 0 })
    await accountRepo.save([accountA, accountB])

    console.log(`\n  초기 상태: A=${accountA.balance}원, B=${accountB.balance}원`)
    console.log("  시나리오: A → B로 500원 이체 중 에러 발생\n")

    // ❌ 문제: 트랜잭션 없이 이체
    console.log("  ❌ [문제] 트랜잭션 없이 이체:")
    try {
        accountA.balance -= 500
        await accountRepo.save(accountA) // A에서 출금 성공
        console.log("    A에서 500원 출금 완료")

        throw new Error("네트워크 에러 발생!") // 중간에 에러!

        // 이 코드는 실행되지 않음
        accountB.balance += 500
        await accountRepo.save(accountB)
    } catch (err: unknown) {
        console.log(`    ⚠️ 에러: ${(err as Error).message}`)
    }

    const afterA = await accountRepo.findOneBy({ id: accountA.id })
    const afterB = await accountRepo.findOneBy({ id: accountB.id })
    console.log(`  결과: A=${afterA!.balance}원, B=${afterB!.balance}원`)
    console.log("  → 500원이 증발! (A에서 빠졌지만 B에 안 들어감)\n")

    // ✅ 해결: dataSource.transaction() 사용
    console.log("  ✅ [해결] 트랜잭션으로 원자적 실행:")

    // 잔액 리셋
    await accountRepo.update(accountA.id, { balance: 1000 })
    await accountRepo.update(accountB.id, { balance: 0 })
    console.log("    (잔액 리셋: A=1000, B=0)")

    try {
        await dataSource.transaction(async (manager) => {
            const txRepo = manager.getRepository(ExAccount)
            const a = await txRepo.findOneBy({ id: accountA.id })
            a!.balance -= 500
            await txRepo.save(a!)
            console.log("    트랜잭션 내: A에서 500원 출금")

            throw new Error("네트워크 에러 발생!") // 에러 발생!

            // 실행되지 않음
            const b = await txRepo.findOneBy({ id: accountB.id })
            b!.balance += 500
            await txRepo.save(b!)
        })
    } catch (err: unknown) {
        console.log(`    ⚠️ 에러: ${(err as Error).message} → 자동 롤백!`)
    }

    const afterA2 = await accountRepo.findOneBy({ id: accountA.id })
    const afterB2 = await accountRepo.findOneBy({ id: accountB.id })
    console.log(`  결과: A=${afterA2!.balance}원, B=${afterB2!.balance}원`)
    console.log("  → 롤백되어 원래 상태 유지! 돈이 안 사라짐 ✅")

    console.log("\n  📌 프로젝트 참조:")
    console.log("    auth.service.ts:75 - @Transactional() 데코레이터")
    console.log("    analysis-result.subscriber.ts:76-79 - dataSource.transaction()")
}

// ============================================================
// 섹션 4: Lost Update (동시 수정)
// ============================================================

async function demo4_LostUpdate() {
    header(4, "Lost Update (동시 수정)")

    // --- 4a: 문제 재현 (일반 엔티티, 버전 관리 없음) ---
    const accountRepo = dataSource.getRepository(ExAccount)
    const shared = accountRepo.create({ name: "공유계좌", balance: 1000 })
    await accountRepo.save(shared)

    console.log(`\n  초기 잔액: ${shared.balance}원`)
    console.log("  시나리오: 두 사용자가 동시에 +100원 → 기대값 1200원\n")

    console.log("  ❌ [문제] 버전 관리 없이 동시 수정:")

    // User A와 User B가 동시에 같은 데이터를 읽음
    const readByUserA = await accountRepo.findOneBy({ id: shared.id })
    const readByUserB = await accountRepo.findOneBy({ id: shared.id })
    console.log(`    User A 읽음: ${readByUserA!.balance}원`)
    console.log(`    User B 읽음: ${readByUserB!.balance}원`)

    // 둘 다 +100 하고 저장
    readByUserA!.balance += 100
    await accountRepo.save(readByUserA!) // 1100으로 저장
    console.log(`    User A 저장: ${readByUserA!.balance}원`)

    readByUserB!.balance += 100 // 1000 + 100 = 1100 (User A 변경 모름)
    await accountRepo.save(readByUserB!) // 1100으로 덮어씀!
    console.log(`    User B 저장: ${readByUserB!.balance}원`)

    const result = await accountRepo.findOneBy({ id: shared.id })
    console.log(`  결과: ${result!.balance}원 (기대: 1200, 실제: 1100)`)
    console.log("  → User A의 +100이 사라짐! (Lost Update)\n")

    // --- 4b: 해결 (@VersionColumn + WHERE version 체크) ---
    console.log("  ✅ [해결] @VersionColumn으로 Optimistic Locking:")
    console.log("  (UPDATE 시 WHERE version = ? 조건으로 충돌 감지)\n")

    const versionedRepo = dataSource.getRepository(ExVersionedAccount)
    const vAccount = versionedRepo.create({ name: "버전계좌", balance: 1000 })
    await versionedRepo.save(vAccount)
    console.log(`    초기: balance=${vAccount.balance}, version=${vAccount.version}`)

    // 두 "사용자"가 같은 시점에 읽음
    const vUserA = await versionedRepo.findOneBy({ id: vAccount.id })
    const vUserB = await versionedRepo.findOneBy({ id: vAccount.id })
    console.log(`    User A 읽음: balance=${vUserA!.balance}, version=${vUserA!.version}`)
    console.log(`    User B 읽음: balance=${vUserB!.balance}, version=${vUserB!.version}`)

    // User A: version 체크 + 업데이트 (성공)
    const updateA = await versionedRepo
        .createQueryBuilder()
        .update(ExVersionedAccount)
        .set({ balance: vUserA!.balance + 100, version: () => "version + 1" })
        .where("id = :id AND version = :version", {
            id: vUserA!.id,
            version: vUserA!.version,
        })
        .execute()
    console.log(`    User A 업데이트: affected=${updateA.affected} (성공 ✅)`)

    // User B: 같은 version으로 시도 (실패!)
    const updateB = await versionedRepo
        .createQueryBuilder()
        .update(ExVersionedAccount)
        .set({ balance: vUserB!.balance + 100, version: () => "version + 1" })
        .where("id = :id AND version = :version", {
            id: vUserB!.id,
            version: vUserB!.version, // 여전히 1이지만 DB는 이미 2
        })
        .execute()

    if (updateB.affected === 0) {
        console.log(`    User B 업데이트: affected=${updateB.affected} (실패! 버전 충돌)`)
        console.log("    → 재시도 로직 필요: 다시 읽고 → 수정 → 저장")
    } else {
        console.log(`    User B 업데이트: affected=${updateB.affected}`)
    }

    const vResult = await versionedRepo.findOneBy({ id: vAccount.id })
    console.log(`  최종: balance=${vResult!.balance}, version=${vResult!.version}`)
    console.log("  → User A의 변경(1100)만 반영됨! Lost Update 방지 ✅")

    console.log("\n  📌 프로젝트에는 Locking 미적용 → 동시성 이슈 발생 가능한 개선 포인트")
}

// ============================================================
// 섹션 5: Cascade 삭제 사고
// ============================================================

async function demo5_CascadeDelete() {
    header(5, "Cascade 삭제 사고")

    const parentRepo = dataSource.getRepository(ExParent)
    const childRepo = dataSource.getRepository(ExChild)

    // 데이터 준비
    const parent = parentRepo.create({ name: "부모팀" })
    await parentRepo.save(parent)

    const children = ["홍길동", "김철수", "이영희"].map((name) =>
        childRepo.create({ name, parentId: parent.id })
    )
    await childRepo.save(children)

    const beforeCount = await childRepo.count()
    console.log(`\n  초기 상태: 부모 1명, 자식 ${beforeCount}명`)
    console.log("  @ManyToOne에 onDelete: 'CASCADE' 설정됨\n")

    // ❌ 문제: 부모 삭제 시 자식 전부 삭제 (DB-level CASCADE)
    console.log("  ❌ [문제] 부모 삭제 → DB CASCADE로 자식 전부 삭제:")

    await parentRepo.delete(parent.id)

    const afterCount = await childRepo.count()
    console.log(`  부모 삭제 후 자식 수: ${afterCount}명`)
    console.log("  → 자식 데이터가 전부 삭제됨! 의도하지 않은 데이터 손실")
    console.log("  → DELETE 쿼리는 1개뿐인데 3건이 사라짐 (로그에 안 보임!)\n")

    console.log("  ✅ [해결 방법]:")
    console.log("    1. onDelete: 'RESTRICT' → 자식 있으면 삭제 거부 (가장 안전)")
    console.log("    2. onDelete: 'SET NULL' → 부모 삭제 시 FK를 NULL로 변경")
    console.log("    3. cascade 사용하지 않기 → 수동으로 관계 관리")
    console.log("    4. Soft Delete 사용 → 실제 삭제 대신 deletedAt 마킹")

    console.log("\n  📌 프로젝트는 cascade를 의도적으로 사용하지 않음 (가장 안전한 선택)")
}

// ============================================================
// 섹션 6: Circular Reference (JSON.stringify 무한루프)
// ============================================================

async function demo6_CircularReference() {
    header(6, "Circular Reference (JSON 직렬화 에러)")

    const authorRepo = dataSource.getRepository(ExAuthor)

    // Section 1에서 만든 데이터 사용
    const author = await authorRepo.findOne({
        where: { name: "김영하" },
        relations: ["books"],
    })

    // 양방향 참조 수동 생성 (서비스 레이어에서 흔히 발생)
    for (const book of author!.books) {
        book.author = author!
    }

    // ❌ 문제: JSON.stringify 시 무한루프
    console.log("\n  ❌ [문제] 양방향 참조된 엔티티를 JSON으로 변환:")
    console.log("    author → books[0] → author → books[0] → ... (무한루프)")

    try {
        JSON.stringify(author)
        console.log("    직렬화 성공 (예상 밖)")
    } catch (err: unknown) {
        console.log(`    에러: ${(err as Error).message}`)
    }

    // ✅ 해결 1: 필요한 필드만 선택 (가장 단순)
    console.log("\n  ✅ [해결 1] 필요한 필드만 수동 선택:")
    const safe = {
        id: author!.id,
        name: author!.name,
        books: author!.books.map((b) => ({ id: b.id, title: b.title })),
    }
    console.log(`    ${JSON.stringify(safe)}`)

    // ✅ 해결 2: 관계 한쪽만 로딩
    console.log("\n  ✅ [해결 2] 관계를 한쪽만 로딩 (순환 자체를 방지):")
    const safeAuthor = await authorRepo.findOne({
        where: { name: "김영하" },
        relations: ["books"], // books만 로딩, books.author는 로딩 안 함
    })
    const json = JSON.stringify(safeAuthor)
    console.log(`    JSON 길이: ${json.length}자 (정상 직렬화 ✅)`)

    // ✅ 해결 3: select로 필요한 컬럼만 조회
    console.log("\n  ✅ [해결 3] QueryBuilder select로 필요한 컬럼만:")
    const minimal = await authorRepo
        .createQueryBuilder("author")
        .select(["author.id", "author.name"])
        .leftJoin("author.books", "book")
        .addSelect(["book.id", "book.title"])
        .where("author.name = :name", { name: "김영하" })
        .getOne()
    console.log(`    ${JSON.stringify(minimal)}`)

    console.log("\n  📌 프로젝트에서 relations를 필요한 쪽만 선택적으로 로딩")
}

// ============================================================
// 섹션 7: QueryBuilder SQL Injection
// ============================================================

async function demo7_SQLInjection() {
    header(7, "QueryBuilder SQL Injection")

    const postRepo = dataSource.getRepository(ExPost)

    // 데이터 준비
    await postRepo.save([
        postRepo.create({ title: "공개 게시글" }),
        postRepo.create({ title: "비밀 게시글" }),
        postRepo.create({ title: "관리자 전용" }),
    ])

    console.log("\n  데이터: 3개의 게시글 (공개, 비밀, 관리자 전용)")

    // ❌ 문제: 문자열 연결로 WHERE 절 구성
    console.log("\n  ❌ [문제] 문자열 연결로 SQL 구성:")

    const maliciousInput = "' OR '1'='1"
    console.log(`    사용자 입력: "${maliciousInput}"`)

    const vulnerable = await dataSource.query(
        `SELECT * FROM ex_posts WHERE title = '${maliciousInput}'`
    )
    console.log(`    결과: ${vulnerable.length}건 반환 (전체 데이터 노출!)`)
    console.log("    → SQL: SELECT * FROM ex_posts WHERE title = '' OR '1'='1'")
    console.log("    → OR '1'='1' 조건 때문에 전체 행이 반환됨!\n")

    // ✅ 해결 1: 파라미터 바인딩 (QueryBuilder)
    console.log("  ✅ [해결 1] QueryBuilder 파라미터 바인딩:")

    const safeResult = await postRepo
        .createQueryBuilder("post")
        .where("post.title = :title", { title: maliciousInput })
        .getMany()
    console.log(`    결과: ${safeResult.length}건 (정상 - 해당 제목 없음)`)

    // ✅ 해결 2: find() 자동 바인딩
    console.log("\n  ✅ [해결 2] find()는 자동으로 파라미터 바인딩:")

    const safeResult2 = await postRepo.find({ where: { title: maliciousInput } })
    console.log(`    결과: ${safeResult2.length}건 (정상 ✅)`)

    // ✅ 해결 3: raw query에서도 파라미터 사용
    console.log("\n  ✅ [해결 3] Raw query에서 ? 파라미터 사용:")

    const safeResult3 = await dataSource.query("SELECT * FROM ex_posts WHERE title = ?", [
        maliciousInput,
    ])
    console.log(`    결과: ${safeResult3.length}건 (정상 ✅)`)

    console.log("\n  📌 프로젝트: 모든 쿼리가 파라미터 바인딩 사용 (assessment.repository.ts 전체)")
}

// ============================================================
// 섹션 8: find() 메모리 폭발
// ============================================================

async function demo8_MemoryExplosion() {
    header(8, "find() 메모리 폭발")

    const postRepo = dataSource.getRepository(ExPost)

    // 데이터 준비: 500건 삽입
    console.log("\n  500건 데이터 삽입 중...")
    const batchSize = 100
    for (let i = 0; i < 500; i += batchSize) {
        const batch = []
        for (let j = i; j < Math.min(i + batchSize, 500); j++) {
            batch.push(postRepo.create({ title: `게시글 #${j + 1}` }))
        }
        await postRepo.save(batch)
    }
    const total = await postRepo.count()
    console.log(`  총 ${total}건 저장 완료`)

    // ❌ 문제: 전체 로딩
    console.log("\n  ❌ [문제] find()로 전체 로딩:")

    const allPosts = await postRepo.find()
    console.log(`    find() 결과: ${allPosts.length}건 전체 메모리에 로딩`)
    console.log("    → 100만 건이면? 수 GB 메모리 사용 → 서버 OOM 크래시\n")

    // ✅ 해결 1: take/skip 페이지네이션
    console.log("  ✅ [해결 1] take/skip 페이지네이션:")

    const page1 = await postRepo.find({ take: 20, skip: 0 })
    const page2 = await postRepo.find({ take: 20, skip: 20 })
    console.log(
        `    1페이지: ${page1.length}건 (${page1[0].title} ~ ${page1[page1.length - 1].title})`
    )
    console.log(
        `    2페이지: ${page2.length}건 (${page2[0].title} ~ ${page2[page2.length - 1].title})`
    )

    // ✅ 해결 2: findAndCount로 전체 수 + 페이지 데이터
    console.log("\n  ✅ [해결 2] findAndCount (총 개수 + 페이지 데이터):")

    const [items, count] = await postRepo.findAndCount({
        take: 20,
        skip: 0,
        order: { id: "DESC" },
    })
    console.log(`    총 ${count}건 중 ${items.length}건 조회 (최신순)`)
    console.log(`    첫 항목: ${items[0].title}`)

    // ✅ 해결 3: 청크 단위 배치 처리 (대량 데이터용)
    console.log("\n  ✅ [해결 3] 청크 단위 배치 처리 (대량 데이터 안전하게):")

    const chunkSize = 100
    let processed = 0
    let hasMore = true
    let offset = 0

    while (hasMore) {
        const chunk = await postRepo.find({
            take: chunkSize,
            skip: offset,
            order: { id: "ASC" },
        })
        processed += chunk.length
        offset += chunkSize
        hasMore = chunk.length === chunkSize
    }
    console.log(
        `    ${chunkSize}건씩 ${Math.ceil(processed / chunkSize)}번에 나눠 총 ${processed}건 처리`
    )
    console.log("    → 메모리에 최대 100건만 유지 (PostgreSQL에서는 .stream()도 가능)")

    console.log("\n  📌 프로젝트 참조:")
    console.log("    assessment.repository.ts:29-38 - findAndCount + take/skip")
    console.log("    user.repository.ts:54-61 - 기본 limit=50")
}

// ============================================================
// 메인 실행
// ============================================================

async function main() {
    console.log("=== 03-1. TypeORM ORM 함정(Pitfalls) ===\n")

    await dataSource.initialize()
    console.log("✅ SQLite In-Memory DB 연결 성공")

    await demo1_NPlusOne()
    await demo2_SelectFalse()
    await demo3_Transaction()
    await demo4_LostUpdate()
    await demo5_CascadeDelete()
    await demo6_CircularReference()
    await demo7_SQLInjection()
    await demo8_MemoryExplosion()

    await dataSource.destroy()
    console.log("\n" + "=".repeat(60))
    console.log("✅ 모든 데모 완료. DB 연결 종료.")
    console.log("=".repeat(60))
}

main().catch(console.error)
