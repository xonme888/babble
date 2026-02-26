# 03-1. TypeORM ORM 함정(Pitfalls)

## 왜 ORM 함정을 알아야 하는가?

ORM은 SQL을 추상화하여 개발 생산성을 높여주지만, **SQL이 보이지 않기 때문에** 문제를 모르고 지나치게 만든다.

- 개발 환경에서는 데이터가 적어 문제가 안 보임
- 운영 환경에서 데이터가 쌓이면 **성능 저하, 데이터 손실, 보안 취약점**으로 터짐
- ORM을 "올바르게" 쓰려면 **ORM이 생성하는 SQL을 이해**해야 함

```
실행: npx ts-node test/learning/03-1-typeorm-pitfalls/examples.ts
```

---

## 8가지 ORM 함정 요약

| # | 함정 | 위험도 | 증상 | 해결 |
|---|------|--------|------|------|
| 1 | N+1 Query | 🔴 치명적 | 목록 조회가 느림, 쿼리 수 폭발 | `relations` 옵션 또는 `leftJoinAndSelect` |
| 2 | select: false | 🟡 중간 | 인증 실패, 특정 필드가 항상 undefined | `addSelect()`로 명시적 로딩 |
| 3 | Transaction 미사용 | 🔴 치명적 | 부분 저장, 데이터 불일치 | `dataSource.transaction()` 또는 `@Transactional()` |
| 4 | Lost Update | 🔴 치명적 | 동시 수정 시 한쪽 변경이 사라짐 | `@VersionColumn()` Optimistic Locking |
| 5 | Cascade 삭제 | 🔴 치명적 | 부모 삭제 시 자식 데이터 전부 삭제 | cascade 제거 + 수동 관리 |
| 6 | Circular Reference | 🟡 중간 | JSON.stringify 에러, API 응답 실패 | 필요한 필드만 선택 또는 한쪽만 로딩 |
| 7 | SQL Injection | 🔴 치명적 | 데이터 유출, 테이블 삭제 가능 | 파라미터 바인딩 (`:name` 또는 `?`) |
| 8 | 메모리 폭발 | 🟠 높음 | 서버 OOM 크래시 | `take`/`skip` 페이지네이션 |

---

## 1. N+1 Query 문제

### 왜 문제인가?

목록을 조회한 뒤, 각 항목의 관계 데이터를 **개별 쿼리**로 가져오면 쿼리 수가 `1 + N`이 된다.

- Author 1000명 → 1001개 쿼리
- 네트워크 왕복 1000번 → 응답 시간 수 초

### 문제 코드 vs 해결 코드

```typescript
// ❌ 문제: N+1 (4쿼리 = 1 + 3)
const authors = await authorRepo.find()  // 1쿼리
for (const author of authors) {
    const books = await bookRepo.find({ where: { authorId: author.id } })  // N쿼리
}

// ✅ 해결: JOIN으로 1쿼리
const authors = await authorRepo.find({ relations: ["books"] })

// ✅ 해결: QueryBuilder
const authors = await authorRepo
    .createQueryBuilder("author")
    .leftJoinAndSelect("author.books", "book")
    .getMany()
```

### 이 프로젝트에서

- `assessment.repository.ts:25` — `relations: ["script", "user"]`로 N+1 방지
- `assessment.repository.ts:40-57` — `leftJoinAndSelect`로 복잡한 JOIN

---

## 2. select: false 함정

### 왜 문제인가?

비밀번호처럼 민감한 컬럼에 `select: false`를 설정하면 일반 조회에서 제외된다. 그런데 **인증 로직에서도 조회가 안 되어** 로그인이 항상 실패한다.

### 문제 코드 vs 해결 코드

```typescript
// 엔티티 정의
@Column({ select: false })
password: string

// ❌ 문제: password가 undefined
const user = await userRepo.findOne({ where: { email } })
user.password  // undefined!

// ✅ 해결: addSelect로 명시적 로딩
const user = await userRepo
    .createQueryBuilder("user")
    .where("user.email = :email", { email })
    .addSelect("user.password")
    .getOne()
```

### 이 프로젝트에서

- `user.entity.ts:41` — `@Column({ select: false })`
- `user.repository.ts:47` — `.addSelect("user.password")`

---

## 3. Transaction 없는 부분 저장

### 왜 문제인가?

여러 DB 작업을 순차 실행할 때, 중간에 에러가 발생하면 **앞의 변경은 커밋되고 뒤의 변경은 실행 안 됨**. 이체에서 출금은 됐는데 입금이 안 되면 돈이 사라진다.

### 문제 코드 vs 해결 코드

```typescript
// ❌ 문제: 트랜잭션 없이 이체
accountA.balance -= 500
await accountRepo.save(accountA)  // 커밋됨
throw new Error("에러!")           // 중간에 터짐
accountB.balance += 500
await accountRepo.save(accountB)  // 실행 안 됨 → 500원 증발

// ✅ 해결: 트랜잭션으로 감싸기
await dataSource.transaction(async (manager) => {
    const repo = manager.getRepository(Account)
    const a = await repo.findOneBy({ id: accountA.id })
    a.balance -= 500
    await repo.save(a)

    throw new Error("에러!")  // → 자동 롤백!

    const b = await repo.findOneBy({ id: accountB.id })
    b.balance += 500
    await repo.save(b)
})
```

### 이 프로젝트에서

- `auth.service.ts:75` — `@Transactional()` 데코레이터로 회원가입 원자성 보장
- `analysis-result.subscriber.ts:76-79` — `dataSource.transaction()`으로 assessment + log 동시 저장

---

## 4. Lost Update (동시 수정)

### 왜 문제인가?

두 사용자가 **같은 데이터를 동시에 읽고 수정**하면, 나중에 저장한 쪽이 먼저 저장한 변경을 덮어쓴다.

```
User A: 잔액 1000 읽음 → +100 → 저장(1100)
User B: 잔액 1000 읽음 → +100 → 저장(1100)  ← A의 변경 사라짐!
```

### 문제 코드 vs 해결 코드

```typescript
// ❌ 문제: 버전 관리 없음 → Last Write Wins
const readA = await repo.findOneBy({ id: 1 })  // version 없음
const readB = await repo.findOneBy({ id: 1 })
readA.balance += 100
await repo.save(readA)  // 1100
readB.balance += 100
await repo.save(readB)  // 1100 (A 변경 덮어씀)

// ✅ 해결: @VersionColumn으로 Optimistic Locking
@VersionColumn()
version: number

const readA = await repo.findOneBy({ id: 1 })  // version: 1
const readB = await repo.findOneBy({ id: 1 })  // version: 1
await repo.save(readA)  // OK, version → 2
await repo.save(readB)  // Error! WHERE version=1 매칭 실패
```

### 이 프로젝트에서

- 프로젝트에 Optimistic Locking 미적용 → 동시성 문제 발생 가능한 **개선 포인트**

---

## 5. Cascade 삭제 사고

### 왜 문제인가?

`onDelete: "CASCADE"` 설정 시, 부모를 삭제하면 **연결된 자식이 DB 레벨에서 자동 삭제**된다. DELETE 쿼리 1개만 실행되지만, 자식 N건이 조용히 사라지는 의도하지 않은 대량 데이터 손실.

### 문제 코드 vs 해결 코드

```typescript
// ❌ 위험: onDelete CASCADE 설정
@ManyToOne(() => Parent, { onDelete: "CASCADE" })  // 부모 삭제 → 자식 전부 삭제!
parent: Parent

// DELETE 1건 실행 → 자식 N건이 조용히 사라짐 (로그에 안 보임!)

// ✅ 해결: 안전한 삭제 정책
@ManyToOne(() => Parent, { onDelete: "RESTRICT" })   // 자식 있으면 삭제 거부
@ManyToOne(() => Parent, { onDelete: "SET NULL" })    // 부모 삭제 시 FK를 NULL로
```

### 이 프로젝트에서

- 프로젝트에서 `cascade: ["remove"]`를 사용하지 않음 (가장 안전한 선택)

---

## 6. Circular Reference

### 왜 문제인가?

양방향 관계(Author ↔ Book)에서 양쪽 모두 로딩 후 `JSON.stringify()` 호출 시 **무한루프** 발생.

```
author → books[0] → author → books[0] → ... → "Converting circular structure to JSON"
```

### 해결 코드

```typescript
// ✅ 해결 1: 필요한 필드만 수동 선택
const safe = {
    id: author.id,
    name: author.name,
    books: author.books.map(b => ({ id: b.id, title: b.title })),
}

// ✅ 해결 2: 관계 한쪽만 로딩
const author = await repo.findOne({
    where: { id: 1 },
    relations: ["books"],  // books만 로딩, books.author는 안 로딩
})

// ✅ 해결 3: select로 필요한 컬럼만
const author = await repo
    .createQueryBuilder("author")
    .select(["author.id", "author.name"])
    .leftJoin("author.books", "book")
    .addSelect(["book.id", "book.title"])
    .getOne()
```

### 이 프로젝트에서

- 프로젝트에서 relations를 필요한 쪽만 선택적으로 로딩

---

## 7. SQL Injection

### 왜 문제인가?

QueryBuilder에서 **문자열 연결**로 SQL을 조립하면, 악의적 입력으로 쿼리를 조작할 수 있다.

```sql
-- 입력: ' OR '1'='1
SELECT * FROM posts WHERE title = '' OR '1'='1'
-- → 전체 데이터 노출!
```

### 문제 코드 vs 해결 코드

```typescript
// ❌ 문제: 문자열 연결
const result = await dataSource.query(
    `SELECT * FROM posts WHERE title = '${userInput}'`
)

// ✅ 해결 1: 파라미터 바인딩
await repo.createQueryBuilder("post")
    .where("post.title = :title", { title: userInput })
    .getMany()

// ✅ 해결 2: find() 자동 바인딩
await repo.find({ where: { title: userInput } })

// ✅ 해결 3: raw query 파라미터
await dataSource.query("SELECT * FROM posts WHERE title = ?", [userInput])
```

### 이 프로젝트에서

- 모든 쿼리가 파라미터 바인딩 사용 (`assessment.repository.ts` 전체)

---

## 8. find() 메모리 폭발

### 왜 문제인가?

`find()`에 조건 없이 호출하면 **테이블 전체를 메모리에 로딩**한다. 운영 DB에 100만 건이면 서버가 OOM(Out of Memory)으로 크래시.

### 문제 코드 vs 해결 코드

```typescript
// ❌ 문제: 전체 로딩
const posts = await postRepo.find()  // 100만 건 → OOM

// ✅ 해결 1: take/skip 페이지네이션
const page = await postRepo.find({ take: 20, skip: 0 })

// ✅ 해결 2: findAndCount (총 수 + 페이지)
const [items, total] = await postRepo.findAndCount({
    take: 20,
    skip: 0,
    order: { id: "DESC" },
})

// ✅ 해결 3: 청크 단위 배치 처리
let offset = 0
const chunkSize = 100
while (true) {
    const chunk = await postRepo.find({ take: chunkSize, skip: offset, order: { id: "ASC" } })
    if (chunk.length === 0) break
    // chunk 처리...
    offset += chunkSize
}
// PostgreSQL에서는 .stream()도 사용 가능
```

### 이 프로젝트에서

- `assessment.repository.ts:29-38` — `findAndCount` + `take`/`skip`
- `user.repository.ts:54-61` — 기본 limit=50

---

## 실제 프로젝트에서 찾아보기

| 함정 | 파일 경로 | 핵심 코드 |
|------|----------|-----------|
| N+1 방지 | `assessment.repository.ts:25` | `relations: ["script", "user"]` |
| select: false | `user.entity.ts:41` | `@Column({ select: false })` |
| addSelect | `user.repository.ts:47` | `.addSelect("user.password")` |
| Transaction | `auth.service.ts:75` | `@Transactional()` |
| Transaction | `analysis-result.subscriber.ts:76` | `dataSource.transaction()` |
| 페이지네이션 | `assessment.repository.ts:29` | `findAndCount + take/skip` |
| 기본 limit | `user.repository.ts:54` | `limit = 50` |

---

## 학습 후 체크리스트

- [ ] N+1 쿼리가 무엇인지 설명할 수 있는가?
- [ ] `select: false` 컬럼을 인증에서 사용하는 방법을 아는가?
- [ ] 왜 트랜잭션이 필요한지, 없으면 어떤 문제가 생기는지 아는가?
- [ ] Optimistic Locking의 원리를 이해하는가?
- [ ] cascade 설정의 위험성을 인식하고 있는가?
- [ ] API 응답에서 순환 참조를 피하는 방법을 아는가?
- [ ] SQL Injection을 방지하는 파라미터 바인딩을 사용하는가?
- [ ] 항상 `take`/`skip`으로 페이지네이션하는가?
