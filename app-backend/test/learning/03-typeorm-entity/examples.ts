export {}

/**
 * 03. TypeORM 엔티티 - SQLite In-Memory 예제
 *
 * 실행: npx ts-node test/learning/03-typeorm-entity/examples.ts
 */
import "reflect-metadata"
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    DataSource,
    Index,
} from "typeorm"

// ============================================================
// 1. 엔티티 정의 - TypeScript 클래스 → DB 테이블
// ============================================================

/**
 * Author 엔티티 - "authors" 테이블과 매핑
 *
 * 왜 @Entity?
 * - 이 클래스가 DB 테이블임을 TypeORM에 알림
 * - "authors"는 테이블 이름 (생략 시 클래스명의 소문자)
 */
@Entity("authors")
class Author {
    @PrimaryGeneratedColumn() // 자동 증가 PK
    id!: number

    @Column({ type: "varchar" }) // 명시적 타입 지정 (PostgreSQL 호환)
    name!: string

    @Column({ type: "varchar", nullable: true }) // NULL 허용
    bio!: string | null

    @CreateDateColumn() // 레코드 생성 시 자동 설정
    createdAt!: Date

    // 1:N 관계 - Author는 여러 Book을 가짐
    @OneToMany(() => Book, (book) => book.author)
    books!: Book[]
}

/**
 * Book 엔티티 - "books" 테이블과 매핑
 */
@Entity("books")
@Index(["title"]) // 제목으로 자주 검색하므로 인덱스 추가
class Book {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: "varchar" })
    title!: string

    @Column({ type: "int", default: 0 }) // 기본값 설정
    pages!: number

    @Column({ type: "float", nullable: true })
    rating!: number | null

    @CreateDateColumn()
    createdAt!: Date

    // N:1 관계 - Book은 하나의 Author에 속함
    @ManyToOne(() => Author, (author) => author.books)
    @JoinColumn({ name: "authorId" }) // 외래키 컬럼 이름 지정
    author!: Author

    @Column({ type: "int" })
    authorId!: number
}

// ============================================================
// 2. DataSource 설정 - SQLite In-Memory
// ============================================================

/**
 * 학습용 DataSource — 로컬 PostgreSQL 사용
 * docker compose up postgres -d 로 컨테이너 실행 후 사용
 */
const dataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5433,
    username: process.env.DATABASE_USERNAME ?? "postgres",
    password: process.env.DATABASE_PASSWORD ?? "postgres",
    database: "babble_learning",
    synchronize: true,
    logging: false,
    entities: [Author, Book],
})

// ============================================================
// 3. 실행
// ============================================================

async function main() {
    console.log("=== TypeORM 엔티티 학습 ===\n")

    // DB 연결 초기화
    await dataSource.initialize()
    console.log("✅ SQLite In-Memory DB 연결 성공\n")

    const authorRepo = dataSource.getRepository(Author)
    const bookRepo = dataSource.getRepository(Book)

    // ---- 엔티티 저장 ----
    console.log("--- 1. 엔티티 저장 ---")

    const author1 = authorRepo.create({
        name: "김영하",
        bio: "한국의 소설가",
    })
    await authorRepo.save(author1)
    console.log(`저장: Author #${author1.id} - ${author1.name}`)

    const author2 = authorRepo.create({
        name: "한강",
        bio: null, // nullable 컬럼
    })
    await authorRepo.save(author2)
    console.log(`저장: Author #${author2.id} - ${author2.name}`)

    const book1 = bookRepo.create({
        title: "살인자의 기억법",
        pages: 200,
        rating: 4.5,
        authorId: author1.id,
    })
    const book2 = bookRepo.create({
        title: "채식주의자",
        pages: 247,
        rating: 4.8,
        authorId: author2.id,
    })
    const book3 = bookRepo.create({
        title: "빛의 제국",
        pages: 280,
        rating: null, // 아직 평점 없음
        authorId: author1.id,
    })
    await bookRepo.save([book1, book2, book3])
    console.log(`저장: Book 3권 저장 완료\n`)

    // ---- 기본 조회 (find) ----
    console.log("--- 2. 기본 조회 (find) ---")

    // findOne - 하나만 조회
    const foundAuthor = await authorRepo.findOne({ where: { name: "김영하" } })
    console.log(`findOne 결과: ${foundAuthor?.name} (bio: ${foundAuthor?.bio})`)

    // find - 여러 개 조회 + 조건
    const highRatedBooks = await bookRepo.find({
        where: { rating: 4.5 },
    })
    console.log(`find (rating >= 4.5): ${highRatedBooks.map((b) => b.title).join(", ")}`)

    // ---- 관계 로딩 (relations) ----
    console.log("\n--- 3. 관계 로딩 ---")

    // relations 옵션으로 JOIN 자동 생성
    const authorWithBooks = await authorRepo.findOne({
        where: { id: author1.id },
        relations: ["books"], // "books" 관계를 함께 로딩 (LEFT JOIN)
    })
    console.log(`${authorWithBooks?.name}의 책들:`)
    authorWithBooks?.books.forEach((book) => {
        console.log(`  - ${book.title} (${book.pages}페이지, 평점: ${book.rating ?? "없음"})`)
    })

    // 반대 방향: Book → Author
    const bookWithAuthor = await bookRepo.findOne({
        where: { id: book2.id },
        relations: ["author"],
    })
    console.log(`\n"${bookWithAuthor?.title}"의 저자: ${bookWithAuthor?.author.name}`)

    // ---- QueryBuilder (복잡한 쿼리) ----
    console.log("\n--- 4. QueryBuilder ---")

    // 평점이 있는 책을 평점 내림차순으로 조회
    const rankedBooks = await bookRepo
        .createQueryBuilder("book")
        .leftJoinAndSelect("book.author", "author") // JOIN
        .where("book.rating IS NOT NULL") // NULL 제외
        .orderBy("book.rating", "DESC") // 평점 내림차순
        .getMany()

    console.log("평점 순위:")
    rankedBooks.forEach((book, i) => {
        console.log(`  ${i + 1}. ${book.title} by ${book.author.name} (${book.rating}점)`)
    })

    // ---- 업데이트 ----
    console.log("\n--- 5. 업데이트 ---")

    book3.rating = 4.3 // 평점 추가
    await bookRepo.save(book3) // save는 있으면 UPDATE, 없으면 INSERT
    console.log(`"${book3.title}" 평점 업데이트: ${book3.rating}`)

    // ---- 카운트 ----
    console.log("\n--- 6. 카운트 ---")
    const totalBooks = await bookRepo.count()
    const ratedBooks = await bookRepo.count({ where: {} })
    console.log(`전체 책: ${totalBooks}권`)
    console.log(`평가된 책: ${ratedBooks}권`)

    // 정리
    await dataSource.destroy()
    console.log("\n✅ DB 연결 종료")
}

main().catch(console.error)
