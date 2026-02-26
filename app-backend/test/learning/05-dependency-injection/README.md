# 05. tsyringe 의존성 주입 (DI)

## 왜 DI가 필요한가?

### Before: 직접 생성 (강결합)
```typescript
class UserService {
    // 문제: DB, Redis에 직접 의존. 테스트 시 실제 DB 필수!
    private repo = new UserRepository(new DataSource({...}))
    private redis = new RedisService("localhost:6379")
    private mailer = new SendGridMailer("api-key")

    async register(email: string) {
        await this.repo.save(...)     // 실제 DB 필요
        await this.redis.set(...)     // 실제 Redis 필요
        await this.mailer.send(...)   // 실제 이메일 발송!
    }
}

// 테스트 불가: DB, Redis, SendGrid 전부 띄워야 함
const service = new UserService() // 내부 의존성 교체 불가
```

### After: DI (느슨한 결합)
```typescript
@injectable()
class UserService {
    constructor(
        @inject("IUserRepo") private repo: IUserRepo,       // 인터페이스에만 의존
        @inject("IRedisService") private redis: IRedisService,
        @inject("INotificationProvider") private mailer: INotificationProvider
    ) {}

    async register(email: string) {
        await this.repo.save(...)     // 인터페이스 호출
        await this.redis.set(...)     // 인터페이스 호출
        await this.mailer.send(...)   // 인터페이스 호출
    }
}

// 테스트: Mock 주입으로 외부 시스템 없이 테스트!
container.register("IUserRepo", { useClass: MockUserRepo })
container.register("IRedisService", { useClass: MockRedis })
container.register("INotificationProvider", { useClass: MockMailer })
```

---

## 왜 tsyringe인가?

| 특징 | tsyringe | inversify | typedi |
|------|---------|-----------|--------|
| 크기 | 5KB (매우 가벼움) | 40KB+ | 15KB |
| TypeScript 네이티브 | ✅ | ✅ | ✅ |
| 데코레이터 기반 | ✅ | ✅ | ✅ |
| Constructor Injection | ✅ | ✅ | ✅ |

tsyringe는 **가볍고 간단**합니다. 복잡한 설정 없이 데코레이터만으로 DI가 동작합니다.

---

## 핵심 개념

### `@injectable()`
**왜?** DI 컨테이너가 이 클래스를 인스턴스화할 수 있다는 표시입니다.
```typescript
@injectable()
export class AuthService {
    // tsyringe가 자동으로 생성자 호출 가능
}
```

### `@inject("토큰")`
**왜 문자열 토큰인가?** TypeScript **인터페이스는 런타임에 사라집니다** (JavaScript에 인터페이스가 없음). 그래서 문자열로 식별합니다.
```typescript
constructor(
    @inject("ITokenProvider") private tokenProvider: ITokenProvider,
    @inject("IRedisService") private redisService: IRedisService,
)
```

### `container.registerSingleton`
**왜 Singleton인가?** DB 연결, Redis 연결 등 **한 번만** 만들어야 하는 것들입니다.
```typescript
container.registerSingleton(RedisService)    // 하나의 인스턴스만 생성
container.registerSingleton(ConfigService)   // 설정도 하나만 필요
```

### `container.register`
인터페이스 토큰과 구현체를 매핑합니다.
```typescript
container.register("IPasswordHasher", { useClass: BcryptPasswordHasher })
container.register("ITokenProvider", { useClass: JwtTokenProvider })
```

---

## 실제 diconfig.ts 분석

`src/shared/infra/di/diconfig.ts`의 핵심 부분:

```typescript
export async function setupDI() {
    // 1. 인터페이스 → 구현체 매핑
    container.register("IPasswordHasher", { useClass: BcryptPasswordHasher })
    container.register("ITokenProvider", { useClass: JwtTokenProvider })
    container.register("ILogger", { useClass: PinoLogger })

    // 2. 싱글톤 (한 번만 생성)
    container.registerSingleton(RedisService)
    container.registerSingleton(ConfigService)
    container.registerSingleton(EventDispatcher)

    // 3. 팩토리 (조건부 생성)
    container.register("INotificationProvider", {
        useFactory: (c) => {
            const config = c.resolve(ConfigService)
            if (config.config.mailProvider === 'sendgrid') {
                return c.resolve(SendGridMailProvider)
            }
            return c.resolve(NodemailerMailProvider)
        }
    })

    // 4. 이벤트 핸들러 등록
    const eventDispatcher = container.resolve(EventDispatcher)
    const userRegisteredHandler = container.resolve(UserRegisteredEventHandler)
    eventDispatcher.register(userRegisteredHandler.eventType(), userRegisteredHandler)
}
```

---

## 실제 프로젝트에서 찾아보기

| 개념 | 파일 경로 |
|------|----------|
| DI 설정 전체 | `src/shared/infra/di/diconfig.ts` |
| @injectable() 사용 | `src/features/auth/auth.service.ts:28` |
| @inject() 사용 | `src/features/auth/auth.service.ts:30-37` |
| 인터페이스 정의 (ITokenProvider) | `src/features/auth/infrastructure/crypto/token-provider.interface.ts` |
| 인터페이스 정의 (IPasswordHasher) | `src/features/auth/infrastructure/crypto/password-hasher.interface.ts` |
| 구현체 (JwtTokenProvider) | `src/features/auth/infrastructure/crypto/jwt-token-provider.ts` |
| 구현체 (BcryptPasswordHasher) | `src/features/auth/infrastructure/crypto/bcrypt-password-hasher.ts` |
| Factory 패턴 (INotificationProvider) | `src/shared/infra/di/diconfig.ts:58-69` |
| Singleton 등록 | `src/shared/infra/di/diconfig.ts:70` |
