# lib/i18n/

국제화(i18n) 설정 및 번역 파일 관리

## 구조

```
lib/i18n/
├── i18n.config.ts          # i18next 설정
├── index.ts                # exports
└── locales/
    ├── en/
    │   └── common.json     # 영어 번역
    └── ko/
        └── common.json     # 한국어 번역
```

## 사용법

```typescript
import { i18nMiddleware } from '@lib/i18n'

// Express 미들웨어로 사용
app.use(i18nMiddleware)

// 요청 객체에서 번역 함수 사용
req.t('validation.email.invalid_format')
```

## 지원 언어

- `en`: English (기본)
- `ko`: 한국어

## 언어 감지 순서

1. HTTP Header (`Accept-Language`)
2. Query String (`?lng=ko`)
3. Cookie (`i18next`)

## 번역 파일 구조

```json
{
  "validation": {
    "email": {
      "empty": "...",
      "invalid_format": "..."
    }
  },
  "auth": { ... },
  "user": { ... },
  "error": { ... }
}
```
