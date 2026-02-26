# AI Service (비공개)

> 음성 발음 분석 AI 서비스 — 이 디렉토리의 소스 코드는 비공개입니다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Language | Python 3.12 |
| Framework | FastAPI |
| STT | OpenAI Whisper (large-v3) |
| 발음 평가 | JiWER (WER/CER 계산) |
| GPU | macOS MPS (Metal Performance Shaders) |
| 패키지 관리 | uv |
| 코드 포맷 | Ruff |
| 테스트 | pytest |

## 주요 기능

- **음성→텍스트 변환 (STT)**: Whisper 모델로 음성 파일을 텍스트로 변환
- **발음 정확도 분석**: 원본 스크립트와 STT 결과를 비교하여 점수 산출
- **단어별 피드백**: 각 단어의 정확도, 누락, 삽입 분석 결과 제공
- **비동기 분석**: Backend의 BullMQ 큐와 연동, Redis 결과 큐로 응답

## 아키텍처

```
Backend (BullMQ) ──→ AI Worker ──→ Whisper STT
                         │              │
                         │         음성 → 텍스트
                         │
                    발음 비교 엔진
                         │
                    Redis 결과 큐 ──→ Backend (Subscriber)
```

### 분석 파이프라인

1. Backend에서 분석 요청을 BullMQ 큐에 enqueue
2. AI Worker가 작업을 dequeue하여 처리
3. Whisper로 음성 파일을 텍스트로 변환
4. JiWER로 원본 스크립트와 비교하여 WER/CER 계산
5. 단어별 정확도, pitch 데이터 생성
6. Redis 결과 큐에 분석 결과 push
7. Backend Subscriber가 결과를 수신하여 DB 저장 + SSE 알림

### 통신 방식

| 구간 | 프로토콜 | 비고 |
|------|----------|------|
| Backend → AI | BullMQ (Redis) | 비동기 큐, 재시도/DLQ 지원 |
| AI → Backend | Redis LPUSH | 결과 큐 `ai:results:completed` |
| AI 헬스체크 | Redis 하트비트 | `ai:worker:heartbeat` 키로 감시 |

## API

### POST /analyze
음성 파일과 스크립트를 받아 발음 분석 결과를 반환합니다.

### GET /health
서비스 상태 확인 (Whisper 모델 로드 여부 포함)

## 구조화 로깅

전 서비스 공통 로깅 표준을 따릅니다:
```
Production:  JSON stdout (structlog JSONRenderer)
Development: 컬러 텍스트 (structlog ConsoleRenderer)
```

## 비공개 사유

AI 모델 파이프라인과 발음 평가 알고리즘의 세부 구현은 비공개로 관리합니다.
기술 스택과 아키텍처는 위 설명을 참고해주세요.
