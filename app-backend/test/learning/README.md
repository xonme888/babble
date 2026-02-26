# Learning Curriculum - 음성 발음 평가 백엔드

> 새로운 개발자를 위한 단계별 학습 가이드

## 학습 로드맵

```
[00] 프로젝트 전체 구조 파악
 │
 ▼
[00-1] 개발 워크플로우 (VS Code 단축키, 디버깅, TDD 사이클)
 │
 ▼
[01] TypeScript 고급 기능 (데코레이터, 제네릭, Enum)
 │
 ▼
[02] Express 5 + 미들웨어 파이프라인
 │
 ▼
[03] TypeORM 엔티티, 관계, 쿼리
 │
 ▼
[03-1] TypeORM ORM 함정 (N+1, Transaction, Injection 등 8가지)
 │
 ▼
[04] DDD 패턴 (Entity, Value Object, Aggregate, Domain Event)
 │
 ▼
[04-1] DDD 안티패턴 (Anemic Model, Primitive Obsession 등 8가지)
 │
 ▼
[05] tsyringe 의존성 주입 (DI)
 │
 ▼
[05-1] DI 안티패턴 (Service Locator, 순환 의존 등 8가지)
 │
 ▼
[06] class-validator DTO 유효성 검사
 │
 ▼
[07] 계층화된 예외 처리
 │
 ▼
[08] JWT 인증 + 권한 시스템
 │
 ▼
[09] Redis 캐시/큐 + BullMQ 백그라운드 작업
 │
 ▼
[10] 도메인 이벤트 기반 아키텍처
 │
 ▼
[11] Jest 테스트 (단위/통합/E2E)
 │
 ▼
[11-1] 테스트 안티패턴 (Mock 남용, 깨지기 쉬운 테스트 등 8가지)
 │
 ▼
[12] 전체 흐름 End-to-End 추적
```

## 사용 방법

### 문서 읽기
각 디렉토리의 `README.md`를 순서대로 읽습니다.

### 예제 실행
```bash
# 프로젝트 루트에서
npx ts-node test/learning/01-typescript-fundamentals/examples.ts
npx ts-node test/learning/02-express-basics/examples.ts
# ... 각 단계별로 실행
```

> **참고**: 일부 예제(02-express, 03-typeorm 등)는 서버를 시작하므로 Ctrl+C로 종료해야 합니다.

## 각 단계 개요

| 단계 | 주제 | 핵심 질문 | 소요 시간 |
|------|------|-----------|-----------|
| 00 | 프로젝트 개요 | 이 프로젝트는 무엇인가? | 30분 |
| 00-1 | 개발 워크플로우 | 코드를 어떻게 탐색하고 디버깅하는가? | 1시간 |
| 01 | TypeScript | 왜 데코레이터가 필수인가? | 1시간 |
| 02 | Express | 미들웨어가 어떻게 동작하는가? | 1시간 |
| 03 | TypeORM | ORM이 왜 필요한가? | 1.5시간 |
| 03-1 | TypeORM 함정 | ORM 사용 시 어떤 문제가 생기는가? | 1.5시간 |
| 04 | DDD | 왜 도메인 로직을 엔티티에 넣는가? | 1.5시간 |
| 04-1 | DDD 안티패턴 | DDD 설계 시 어떤 실수를 저지르는가? | 1.5시간 |
| 05 | DI | 왜 의존성을 직접 생성하면 안 되는가? | 1시간 |
| 05-1 | DI 안티패턴 | DI를 쓰면서도 어떤 실수를 저지르는가? | 1.5시간 |
| 06 | Validation | 왜 입구에서 검증해야 하는가? | 45분 |
| 07 | Error Handling | 왜 커스텀 예외가 필요한가? | 45분 |
| 08 | Authentication | 왜 JWT 이중 구조인가? | 1.5시간 |
| 09 | Redis/Queue | 왜 작업을 분리하는가? | 1.5시간 |
| 10 | Event Driven | 왜 이벤트로 통신하는가? | 1시간 |
| 11 | Testing | 왜 테스트를 작성하는가? | 1.5시간 |
| 11-1 | 테스트 안티패턴 | 테스트를 작성하면서 어떤 실수를 저지르는가? | 1.5시간 |
| 12 | Full Flow | 모든 것이 어떻게 연결되는가? | 1시간 |

## 학습 원칙

1. **"왜(Why)" 우선** - 모든 기술에 대해 "이것이 없으면 어떤 문제가 생기는지" 설명
2. **실행 가능한 코드** - 각 examples.ts는 독립적으로 실행 가능
3. **실제 프로젝트 참조** - src/ 내 실제 파일 경로 포함
4. **점진적 난이도** - 기초 → 응용 → 프로젝트 적용

## 프로젝트 기술 스택

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.9
- **Framework**: Express 5
- **ORM**: TypeORM 0.3
- **DI**: tsyringe
- **Queue**: BullMQ + Redis
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Validation**: class-validator + class-transformer
- **Logging**: pino + pino-http
- **Testing**: Jest + supertest
