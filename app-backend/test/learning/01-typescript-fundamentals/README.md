# 01. TypeScript 핵심 기능

## 왜 TypeScript인가?

JavaScript는 동적 타입 언어입니다. 변수에 어떤 타입이든 넣을 수 있습니다.

```javascript
// JavaScript - 런타임까지 에러를 모름
function getUser(id) {
    return { id: id, name: "홍길동" }
}
const user = getUser("abc")  // id에 문자열을 넣어도 에러 없음
user.nmae  // 오타인데도 에러 없음. undefined 반환
```

TypeScript는 **컴파일 타임**에 에러를 잡아줍니다:

```typescript
function getUser(id: number): { id: number; name: string } {
    return { id, name: "홍길동" }
}
const user = getUser("abc")  // ❌ 컴파일 에러: string은 number에 할당 불가
user.nmae  // ❌ 컴파일 에러: 'nmae' 속성이 없음. 'name'을 의미했나요?
```

**사용 안 하면?** 런타임에서야 에러를 발견하고, 리팩토링 시 어디가 깨졌는지 알 수 없습니다.

---

## 왜 데코레이터가 필수인가?

이 프로젝트의 핵심 라이브러리들이 **모두** 데코레이터에 의존합니다:

| 라이브러리 | 사용하는 데코레이터 | 역할 |
|-----------|-------------------|------|
| TypeORM | `@Entity`, `@Column`, `@PrimaryGeneratedColumn` | 클래스 → DB 테이블 매핑 |
| tsyringe | `@injectable`, `@inject` | 의존성 주입 |
| class-validator | `@IsEmail`, `@MinLength`, `@IsString` | 유효성 검사 |

**데코레이터를 이해하지 못하면 이 프로젝트 코드를 읽을 수 없습니다.**

---

## tsconfig.json 핵심 옵션

```json
{
    "compilerOptions": {
        "experimentalDecorators": true,    // 데코레이터 문법 활성화
        "emitDecoratorMetadata": true,     // 데코레이터 메타데이터 생성
        "strictNullChecks": true,          // null/undefined 엄격 검사
        "noImplicitAny": true              // 암묵적 any 타입 금지
    }
}
```

### `experimentalDecorators: true`
**왜 켜야 하는가?** TypeScript는 기본적으로 데코레이터 문법을 지원하지 않습니다. 이 옵션을 켜야 `@Entity`, `@injectable` 같은 데코레이터를 사용할 수 있습니다.

### `emitDecoratorMetadata: true`
**왜 켜야 하는가?** tsyringe가 **생성자 파라미터의 타입 정보**를 런타임에 읽기 위해 필요합니다.
```typescript
// emitDecoratorMetadata가 켜져 있으면
// TypeScript가 컴파일 시 타입 메타데이터를 생성
@injectable()
class UserService {
    constructor(private repo: UserRepository) {} // ← 타입 정보가 런타임에 전달됨
}
```
**꺼져 있으면?** tsyringe가 `UserRepository`라는 타입 정보를 읽지 못해 자동 주입이 불가능합니다.

### `reflect-metadata`
**왜 import 해야 하는가?** `emitDecoratorMetadata`가 생성한 메타데이터를 런타임에 **읽는 API**를 제공합니다.
```typescript
// src/index.ts, src/app.ts 맨 위에 반드시 import
import "reflect-metadata"
```
**import 안 하면?** `Reflect.getMetadata is not a function` 런타임 에러 발생.

---

## 데코레이터 4가지 종류

TypeScript 데코레이터는 **함수**입니다. 클래스, 프로퍼티, 메서드, 파라미터에 붙일 수 있습니다.

### 1. 클래스 데코레이터
```typescript
// 이 프로젝트: @Entity("users"), @injectable()
function Entity(tableName: string) {
    return function(target: Function) {
        Reflect.defineMetadata("table", tableName, target)
    }
}
```
**역할**: 클래스에 메타데이터를 부착. TypeORM이 이 정보로 DB 테이블을 생성합니다.

### 2. 프로퍼티 데코레이터
```typescript
// 이 프로젝트: @Column(), @IsEmail()
function Column(options?: { type?: string }) {
    return function(target: any, propertyKey: string) {
        Reflect.defineMetadata("column", options, target, propertyKey)
    }
}
```
**역할**: 프로퍼티에 메타데이터를 부착. TypeORM이 이 정보로 DB 컬럼을 정의합니다.

### 3. 메서드 데코레이터
```typescript
// 이 프로젝트: @Transactional()
function Log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    descriptor.value = function(...args: any[]) {
        console.log(`[호출] ${propertyKey}`)
        return originalMethod.apply(this, args)
    }
}
```
**역할**: 메서드 실행 전후에 로직 추가. AOP(관점 지향 프로그래밍) 구현.

### 4. 파라미터 데코레이터
```typescript
// 이 프로젝트: @inject("ITokenProvider")
function inject(token: string) {
    return function(target: any, propertyKey: string | undefined, parameterIndex: number) {
        Reflect.defineMetadata(`inject:${parameterIndex}`, token, target)
    }
}
```
**역할**: 생성자 파라미터에 주입할 의존성의 토큰을 지정합니다.

---

## 제네릭 (Generic)

**왜 쓰는가?** 타입 안전한 재사용 가능한 코드를 작성하기 위해.

이 프로젝트에서 제네릭을 사용하는 곳:
```typescript
// src/shared/core/domain-event-handler.interface.ts
export interface IDomainEventHandler<T extends DomainEvent> {
    handle(event: T): Promise<void>  // T는 반드시 DomainEvent의 하위 타입
}

// 사용: 타입 안전하게 특정 이벤트만 처리
class UserRegisteredEventHandler implements IDomainEventHandler<UserRegisteredEvent> {
    async handle(event: UserRegisteredEvent): Promise<void> {
        // event.email ← 자동완성 지원! (UserRegisteredEvent의 속성)
    }
}
```

**제네릭 없이 구현하면?**
```typescript
interface IDomainEventHandler {
    handle(event: any): Promise<void>  // any → 타입 안전성 없음
}
// event.email ← 자동완성 없음. 오타나도 컴파일 에러 없음
```

---

## 문자열 Enum

**왜 문자열 Enum인가?** DB에 저장될 때 가독성 때문입니다.

```typescript
// 이 프로젝트: src/features/user/domain/user.entity.ts
export enum UserRole {
    USER = 'USER',     // DB에 'USER' 문자열로 저장
    ADMIN = 'ADMIN'    // DB에 'ADMIN' 문자열로 저장
}

// src/features/assessment/domain/assessment.entity.ts
export enum AssessmentStatus {
    PENDING = "PENDING",
    ANALYZING = "ANALYZING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED"
}
```

**숫자 Enum이면?**
```typescript
enum UserRole {
    USER = 0,    // DB에 0으로 저장 → "이 0이 뭐지?"
    ADMIN = 1    // DB에 1로 저장 → 의미 파악 불가
}
```
DB를 직접 조회할 때 `status = 'COMPLETED'`는 바로 이해되지만, `status = 2`는 코드를 확인해야 합니다.

---

## 실제 프로젝트에서 찾아보기

| 개념 | 파일 경로 |
|------|----------|
| reflect-metadata import | `src/index.ts:1`, `src/app.ts:1` |
| 클래스 데코레이터 (@Entity) | `src/features/user/domain/user.entity.ts:27` |
| 프로퍼티 데코레이터 (@Column) | `src/features/user/domain/user.entity.ts:30-54` |
| 파라미터 데코레이터 (@inject) | `src/features/auth/auth.service.ts:29-37` |
| 메서드 데코레이터 (@Transactional) | `src/features/auth/auth.service.ts:75` |
| 제네릭 (IDomainEventHandler\<T\>) | `src/shared/core/domain-event-handler.interface.ts` |
| 문자열 Enum (UserRole) | `src/features/user/domain/user.entity.ts:12-15` |
| 문자열 Enum (AssessmentStatus) | `src/features/assessment/domain/assessment.entity.ts:11-17` |
| tsconfig 설정 | `tsconfig.json` |
