# 03. TypeORM 엔티티, 관계, 쿼리

## 왜 ORM(TypeORM)인가?

ORM은 **Object-Relational Mapper**입니다. TypeScript 클래스를 DB 테이블로 자동 변환합니다.

### SQL 직접 작성의 문제
```typescript
// ❌ SQL 직접 작성
const result = await db.query("SELECT * FROM users WHERE email = $1", [email])
// 문제 1: SQL 오타를 컴파일 타임에 못 잡음 (emial = $1)
// 문제 2: SQL injection 위험 ("'; DROP TABLE users; --")
// 문제 3: PostgreSQL → MySQL 변경 시 모든 쿼리 수정
```

### TypeORM 방식
```typescript
// ✅ TypeORM
const user = await userRepository.findOne({ where: { email } })
// 장점 1: TypeScript 타입 체크 (오타 컴파일 에러)
// 장점 2: SQL injection 자동 방지 (파라미터 바인딩)
// 장점 3: DB 종류 변경 시 DataSource 설정만 변경
```

**사용 안 하면?** SQL을 모든 곳에 직접 작성해야 하고, DB 변경 시 전체 쿼리를 수정해야 합니다.

---

## 왜 TypeORM인가?

| 특징 | TypeORM | Prisma | Sequelize |
|------|---------|--------|-----------|
| 데코레이터 기반 | ✅ (`@Entity`, `@Column`) | ❌ (스키마 파일) | ❌ (config 기반) |
| TypeScript 네이티브 | ✅ | ✅ | △ (후발 지원) |
| Data Mapper 패턴 | ✅ | ❌ | ❌ |

이 프로젝트에서 TypeORM을 선택한 이유: **데코레이터 기반**으로 TypeScript 클래스 위에 바로 DB 매핑을 정의할 수 있어 DDD 패턴과 잘 맞습니다.

---

## DataSource 설정

```typescript
// src/shared/infra/persistence/data-source.ts (간소화)
export const AppDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5433,
    database: "babble",
    synchronize: false,     // 프로덕션: 반드시 false — 마이그레이션으로 관리
    entities: [User, Assessment, Script, ...]
})
```

### 왜 개발/테스트/운영 모두 PostgreSQL인가?
- **일관성**: 개발/테스트에서 다른 DB를 쓰면 타입 호환 문제, 함수 차이 등으로 프로덕션에서만 발생하는 버그가 생김
- **Docker Compose**: `docker compose up postgres -d` 한 줄로 로컬 PostgreSQL 실행

### `synchronize: true` vs Migration
- **`synchronize: true`**: 엔티티 변경 시 DB 스키마를 **자동으로 동기화**. 편리하지만 **데이터 손실 가능**
- **Migration**: 스키마 변경을 **SQL 스크립트로 기록**. 안전하지만 수동 관리 필요

**왜 운영에서 synchronize를 끄는가?** 컬럼 타입 변경 시 기존 데이터가 삭제될 수 있습니다. 이 프로젝트에서는 실제로 방어 코드가 있습니다:
```typescript
// src/shared/infra/persistence/data-source.ts:19
if (isProduction && dbConfig.synchronize) {
    throw new Error('DATABASE_SYNCHRONIZE=true is not allowed in production.')
}
```

---

## 핵심 데코레이터

### `@Entity("table_name")`
**왜?** 클래스와 DB 테이블을 매핑합니다.
```typescript
@Entity("users")  // "users" 테이블과 매핑
export class User {
    // ...
}
```

### `@PrimaryGeneratedColumn()`
**왜?** 자동 증가하는 고유 ID 컬럼. 모든 레코드를 고유하게 식별합니다.
```typescript
@PrimaryGeneratedColumn()  // id = 1, 2, 3, ... 자동 증가
id: number
```

### `@Column({ type, nullable, default })`
**왜 type을 명시하는가?** PostgreSQL은 TypeScript 타입을 자동 추론하지 못합니다.
```typescript
@Column({ type: "varchar", nullable: true })  // DB에 VARCHAR 타입, NULL 허용
lastName: string | null

@Column({ default: false })  // 기본값 false
isVerified: boolean

@Column({ select: false })   // 보안: 기본 쿼리에서 제외 (비밀번호)
password: string
```

### 관계 데코레이터
**왜?** 외래키 관계를 객체 참조로 표현합니다. JOIN 쿼리가 자동 생성됩니다.

```typescript
// User는 여러 Assessment를 가짐 (1:N)
@OneToMany("Assessment", (assessment) => assessment.user)
assessments: Assessment[]

// Assessment는 하나의 User에 속함 (N:1)
@ManyToOne("User", (user) => user.assessments)
@JoinColumn({ name: "userId" })
user: User
```

### `@Index`
**왜?** WHERE 절 검색 속도를 향상시킵니다.
```typescript
@Entity("assessments")
@Index(["userId"])          // userId로 자주 검색
@Index(["status"])          // status로 필터링
@Index(["userId", "status"]) // 복합 인덱스: userId + status 동시 검색
export class Assessment { ... }
```
**없으면?** 수백만 행에서 전체 테이블 스캔(Full Table Scan). 쿼리가 수초~수분 걸릴 수 있습니다.

---

## QueryBuilder vs find()

```typescript
// find() - 단순 쿼리에 적합
const users = await repository.find({ where: { isActive: true } })

// QueryBuilder - 복잡한 쿼리에 적합
const result = await repository
    .createQueryBuilder("assessment")
    .where("assessment.userId = :userId", { userId })
    .andWhere("assessment.status = :status", { status: "COMPLETED" })
    .orderBy("assessment.createdAt", "DESC")
    .take(10)
    .getMany()
```

---

## 실제 프로젝트에서 찾아보기

| 개념 | 파일 경로 |
|------|----------|
| DataSource 설정 | `src/shared/infra/persistence/data-source.ts` |
| User 엔티티 | `src/features/user/domain/user.entity.ts` |
| Assessment 엔티티 | `src/features/assessment/domain/assessment.entity.ts` |
| Script 엔티티 | `src/features/script/domain/script.entity.ts` |
| ManyToOne 관계 | `src/features/assessment/domain/assessment.entity.ts:58-61` |
| @Index 사용 | `src/features/assessment/domain/assessment.entity.ts:28-31` |
| @Column select:false | `src/features/user/domain/user.entity.ts:41` |
| synchronize 방어 | `src/shared/infra/persistence/data-source.ts:19-21` |
