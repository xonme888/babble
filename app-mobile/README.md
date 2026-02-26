# Mobile App (비공개)

> 영어 발음 연습 Flutter 모바일 앱 — 이 디렉토리의 소스 코드는 비공개입니다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Flutter 3.3+, Dart |
| 상태관리 | Provider + SafeChangeNotifier |
| HTTP | http (BaseApiService 래퍼) |
| 보안 저장 | flutter_secure_storage |
| 음성 | record, speech_to_text, just_audio |
| UI 애니메이션 | flutter_animate |
| 차트 | fl_chart |
| 테스트 | mocktail |

## 주요 기능

- **인증**: 로그인/회원가입/이메일 인증/토큰 자동 갱신/게스트 체험
- **발음 연습**: 스크립트 선택 → 음성 녹음 → AI 분석 → 피드백 확인
- **학습 경로**: 챕터/번들 기반 커리큘럼, 진행도 추적
- **단어 게임**: 드래그 앤 드롭 단어 배치, 일일 챌린지
- **게이미피케이션**: XP/레벨/뱃지/리더보드/스트릭
- **대시보드**: 학습 통계, 최근 평가, 일일 목표 달성률
- **프로필 & 설정**: 테마 전환, 알림, 주간 목표 설정
- **실시간 알림**: SSE로 분석 완료 알림 수신
- **오프라인 대응**: 네트워크 상태 오버레이

## 아키텍처

```
Feature-First + MVVM

lib/
├── core/              # 공통 모듈
│   ├── config/        # 환경 설정, 상수
│   ├── models/        # OpenAPI 생성 모델 (자동 생성)
│   ├── services/      # API 서비스, SSE, 인증
│   ├── widgets/       # 공용 위젯
│   └── utils/         # 유틸리티
│
└── features/          # 기능별 모듈
    ├── auth/          # 인증 (로그인, 회원가입, 게스트)
    ├── home/          # 대시보드
    ├── practice/      # 발음 연습 + 피드백
    ├── history/       # 평가 이력
    ├── game/          # 게임 세션
    ├── word_game/     # 단어 배치 게임
    ├── gamification/  # XP, 뱃지, 리더보드
    └── profile/       # 프로필, 설정
```

### 설계 패턴

| 패턴 | 적용 |
|------|------|
| **MVVM** | ViewModel(ChangeNotifier) + View(Widget) 분리 |
| **Sealed State** | 타입 안전 UI 상태 머신 (Loading/Loaded/Error) |
| **BaseApiService** | 인증 토큰 자동 갱신, 구조화 로깅, 민감 데이터 마스킹 |
| **OpenAPI 코드 생성** | Backend openapi.json → Dart 모델 자동 생성 |

### Backend 연동

```
Mobile ──HTTP──→ Backend API (REST)
Mobile ──SSE───→ Backend (분석 완료 실시간 알림)
```

- API 모델은 Backend의 `openapi.json`에서 자동 생성
- JWT 토큰은 flutter_secure_storage에 안전 저장
- 토큰 만료 시 자동 refresh, 실패 시 로그인 화면으로 이동

## 비공개 사유

모바일 앱의 UI/UX 구현과 클라이언트 로직은 비공개로 관리합니다.
아키텍처와 기능 목록은 위 설명을 참고해주세요.
