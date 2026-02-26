# 00-1. Node.js 개발자의 실전 워크플로우

> VS Code 단축키와 개발 습관으로 코드를 읽고, 추적하고, 테스트하는 법

## 왜 이 문서가 먼저인가?

코드를 "작성"하는 시간보다 "읽고 추적하는" 시간이 훨씬 길다. 좋은 개발자와 보통 개발자의 차이는 **코드를 얼마나 빠르게 탐색하고 이해하는가**에 있다. 이 문서는 IDE를 능숙하게 다루는 것이 코드 품질과 생산성에 직결된다는 전제에서 시작한다.

> macOS 기준. Windows는 `Cmd` → `Ctrl`, `Option` → `Alt`로 대체.

---

## 1. 코드 탐색 (Code Navigation) — 가장 중요한 단축키

### "이 함수의 구현은 어디에?"

| 단축키 | 동작 | 사용 상황 |
|--------|------|----------|
| `F12` 또는 `Cmd+Click` | **Go to Definition** | 함수/클래스/타입의 원본 코드로 이동 |
| `Option+F12` | **Peek Definition** | 현재 파일을 떠나지 않고 정의를 팝업으로 확인 |
| `Shift+F12` | **Find All References** | 이 함수를 호출하는 모든 곳을 목록으로 표시 |
| `Cmd+Shift+F12` | **Go to Implementation** | interface/abstract의 실제 구현체로 이동 |

#### 실전 예시: 이 프로젝트에서 연습

```
1. src/features/user/user.service.ts를 열고
2. updateWeeklyGoal 메서드 안의 user.updateWeeklyGoal(weeklyGoal)에 커서를 놓고
3. F12 → user.entity.ts의 실제 구현으로 이동
4. Ctrl+- → 다시 user.service.ts로 돌아옴
5. Shift+F12 → updateWeeklyGoal을 호출하는 모든 곳 확인
```

### "이 파일은 어디에?"

| 단축키 | 동작 | 사용 상황 |
|--------|------|----------|
| `Cmd+P` | **Quick Open** | 파일명의 일부만 입력하면 즉시 이동 |
| `Cmd+Shift+O` | **Go to Symbol in File** | 현재 파일의 함수/클래스/변수 목록 |
| `Cmd+T` | **Go to Symbol in Workspace** | 프로젝트 전체에서 클래스/함수 검색 |
| `Ctrl+-` | **Navigate Back** | 직전 위치로 돌아가기 |
| `Ctrl+Shift+-` | **Navigate Forward** | 앞으로 이동 |

#### 실전 예시: Quick Open의 위력

```
Cmd+P → "user.ent" 입력 → user.entity.ts 즉시 열기
Cmd+P → "email.vo" 입력 → email.vo.ts 즉시 열기
Cmd+P → ":145" 추가 → 145번 줄로 바로 이동 (Cmd+P → "user.ent:145")
```

> **핵심 습관**: 파일 탐색기(Explorer)를 마우스로 클릭하지 말 것. `Cmd+P`가 10배 빠르다.

### "이 코드의 흐름을 추적하고 싶다"

| 단축키 | 동작 | 사용 상황 |
|--------|------|----------|
| `Cmd+Shift+F` | **Search Across Files** | 프로젝트 전체에서 텍스트 검색 |
| `Cmd+Shift+H` | **Replace Across Files** | 프로젝트 전체에서 텍스트 교체 |
| `Cmd+G` | **Go to Line** | 특정 줄 번호로 이동 |
| `Cmd+Shift+\` | **Go to Matching Bracket** | 중괄호/괄호의 짝으로 이동 |

#### 실전 예시: API 요청 흐름 추적

```
1. Cmd+Shift+F → "weeklyGoal" 검색
2. 결과에서 routes 파일 찾기 → Controller → Service → Entity 순서 파악
3. 각 단계에서 F12로 다음 레이어로 이동
4. Ctrl+-로 되돌아오며 흐름 정리
```

---

## 2. 편집 (Editing) — 반복 작업을 줄이는 단축키

### 줄 단위 조작

| 단축키 | 동작 |
|--------|------|
| `Option+Up/Down` | 현재 줄 위/아래로 이동 |
| `Shift+Option+Up/Down` | 현재 줄 복사 |
| `Cmd+Shift+K` | 현재 줄 삭제 |
| `Cmd+Enter` | 아래에 빈 줄 삽입 |
| `Cmd+Shift+Enter` | 위에 빈 줄 삽입 |
| `Cmd+/` | 주석 토글 |

### 멀티 커서 — 반복 편집의 핵심

| 단축키 | 동작 | 사용 상황 |
|--------|------|----------|
| `Cmd+D` | **같은 단어 하나씩 선택** | 변수명 일부만 바꿀 때 |
| `Cmd+Shift+L` | **같은 단어 전체 선택** | 파일 내 변수명 일괄 변경 |
| `Option+Click` | **커서 추가** | 여러 줄의 다른 위치에 동시 입력 |
| `Cmd+Option+Up/Down` | **위/아래에 커서 추가** | 연속된 줄에 같은 편집 |

#### 실전 예시: 변수명 변경

```
1. weeklyGoal 위에 커서를 놓고
2. Cmd+D를 반복하여 바꾸고 싶은 것만 선택
3. 한 번에 입력하면 선택된 모든 곳이 동시 변경
```

> **더 안전한 방법**: `F2` (Rename Symbol) — TypeScript가 타입을 인식하여 정확한 참조만 변경. 문자열 안의 동명이인은 건드리지 않음.

### 리팩토링

| 단축키 | 동작 | 사용 상황 |
|--------|------|----------|
| `F2` | **Rename Symbol** | 변수/함수/클래스명 안전하게 변경 (모든 참조 포함) |
| `Cmd+.` | **Quick Fix / Refactor** | 자동 import, 인터페이스 구현, 함수 추출 등 |
| `Ctrl+Shift+R` | **Refactor Menu** | 함수 추출, 변수 추출, 인라인 등 리팩토링 옵션 |

---

## 3. 디버깅 (Debugging) — console.log 대신 디버거 사용

### 왜 디버거인가?

```
console.log(user)           // 한 시점의 스냅샷만 보임
console.log(user.weeklyGoal) // 보고 싶은 값을 매번 추가/삭제해야 함
```

디버거는 **실행을 멈추고**, 그 시점의 **모든 변수**, **콜스택**, **스코프 체인**을 실시간으로 탐색할 수 있다.

### 기본 디버깅 단축키

| 단축키 | 동작 | 설명 |
|--------|------|------|
| `F9` | **Toggle Breakpoint** | 코드 실행이 멈추는 지점 설정 |
| `F5` | **Start/Continue Debugging** | 디버깅 시작 또는 다음 브레이크포인트까지 진행 |
| `F10` | **Step Over** | 현재 줄 실행 후 다음 줄로 (함수 안으로 들어가지 않음) |
| `F11` | **Step Into** | 함수 안으로 들어가기 |
| `Shift+F11` | **Step Out** | 현재 함수에서 빠져나오기 |
| `Shift+F5` | **Stop Debugging** | 디버깅 중단 |

### launch.json 설정 — Node.js 앱 디버깅

`.vscode/launch.json` 파일을 생성하면 `F5`로 바로 디버깅을 시작할 수 있다.

```jsonc
{
    "version": "0.2.0",
    "configurations": [
        // 1. 현재 열린 TypeScript 파일을 디버깅
        {
            "name": "Debug Current TS File",
            "type": "node",
            "request": "launch",
            "runtimeExecutable": "npx",
            "runtimeArgs": ["ts-node"],
            "args": ["${file}"],
            "console": "integratedTerminal",
            "skipFiles": ["<node_internals>/**", "node_modules/**"]
        },

        // 2. Jest 테스트 디버깅 (현재 파일)
        {
            "name": "Debug Jest Current File",
            "type": "node",
            "request": "launch",
            "runtimeExecutable": "npx",
            "runtimeArgs": [
                "jest",
                "--runInBand",
                "--no-cache",
                "${relativeFile}"
            ],
            "console": "integratedTerminal",
            "skipFiles": ["<node_internals>/**", "node_modules/**"]
        },

        // 3. Express 서버 디버깅
        {
            "name": "Debug Server",
            "type": "node",
            "request": "launch",
            "runtimeExecutable": "npx",
            "runtimeArgs": ["ts-node"],
            "args": ["src/index.ts"],
            "console": "integratedTerminal",
            "skipFiles": ["<node_internals>/**", "node_modules/**"],
            "env": {
                "NODE_ENV": "development"
            }
        }
    ]
}
```

### 디버깅 실전 흐름

```
1. user.entity.ts의 updateWeeklyGoal() 안에 F9로 브레이크포인트 설정
2. 테스트 파일 열고 → Debug 패널에서 "Debug Jest Current File" 선택 → F5
3. 실행이 브레이크포인트에서 멈춤
4. VARIABLES 패널에서 this, goal 값 확인
5. WATCH에 this._weeklyGoal 추가하여 값 변화 추적
6. CALL STACK에서 "누가 이 함수를 호출했는지" 확인
7. F10으로 한 줄씩 실행하며 상태 변화 관찰
```

### 조건부 브레이크포인트

브레이크포인트를 우클릭하여 **조건**을 설정할 수 있다.

```
조건: goal < 0           → goal이 음수일 때만 멈춤
조건: userId === 5       → 특정 유저일 때만 멈춤
Hit Count: 10            → 10번째 호출에서만 멈춤
Log Message: goal={goal} → 멈추지 않고 콘솔에 출력 (logpoint)
```

---

## 4. 테스트 (Testing) — TDD 개발 사이클

### 터미널에서 Jest 실행

```bash
# 전체 테스트
npx jest

# 특정 파일만
npx jest user.service.spec.ts

# 특정 테스트명 매칭
npx jest -t "주간 목표"

# Watch 모드 — 파일 저장 시 자동 재실행
npx jest --watch

# Watch + 특정 파일
npx jest --watch user.service.spec.ts

# 커버리지 포함
npx jest --coverage
```

### Watch 모드 옵션 (가장 많이 사용)

`npx jest --watch` 실행 후 터미널에서 단축키 사용:

| 키 | 동작 |
|----|------|
| `a` | 모든 테스트 실행 |
| `f` | 실패한 테스트만 재실행 |
| `p` | 파일명 패턴으로 필터 |
| `t` | 테스트명 패턴으로 필터 |
| `o` | 변경된 파일의 테스트만 실행 (git 기준) |
| `q` | Watch 모드 종료 |
| `Enter` | 현재 필터로 재실행 |

### VS Code에서 테스트 실행

#### 방법 1: Jest Runner 확장 (권장)

**Jest Runner** 확장 설치 후:
- 각 `describe`/`it` 블록 위에 `Run | Debug` 버튼 표시
- 클릭 한 번으로 개별 테스트 실행/디버깅

#### 방법 2: 터미널 단축키

| 단축키 | 동작 |
|--------|------|
| `` Ctrl+` `` | 터미널 토글 (열기/닫기) |
| `` Cmd+Shift+` `` | 새 터미널 생성 |
| `Cmd+\` | 터미널 분할 (에디터 왼쪽 + 터미널 오른쪽) |
| `Up Arrow` | 이전 명령어 재사용 |

### TDD 사이클 실전 레이아웃

```
┌─────────────────────────────────┐
│  [테스트 파일]    │  [구현 파일]    │  ← Cmd+\ 로 분할
│  user.spec.ts    │  user.entity.ts │
│                  │                 │
│  it('주간 목표    │  updateWeekly   │
│   1 미만이면     │  Goal(goal) {   │
│   에러') {       │    if (goal <1) │
│    ...           │      throw ...  │
│  }               │  }              │
├─────────────────────────────────┤
│  터미널: npx jest --watch        │  ← Ctrl+`
└─────────────────────────────────┘
```

1. **Red**: 테스트 파일에서 실패하는 테스트 작성 → 저장 → Watch 모드가 자동 실행 → 빨간색
2. **Green**: 구현 파일에서 최소 코드 작성 → 저장 → 초록색
3. **Refactor**: 코드 정리 → 저장 → 여전히 초록색 확인

---

## 5. Git 통합 — 코드 히스토리 활용

### VS Code 내장 Git

| 단축키 | 동작 |
|--------|------|
| `Ctrl+Shift+G` | Source Control 패널 열기 |
| 파일 클릭 | 변경 내용 diff 보기 |

### GitLens 확장 (강력 추천)

설치 후 얻는 기능:

| 기능 | 설명 | 사용 상황 |
|------|------|----------|
| **Inline Blame** | 각 줄 옆에 마지막 수정자/날짜 표시 | "이 줄을 누가 왜 바꿨지?" |
| **File History** | 파일의 전체 커밋 히스토리 | "이 파일이 어떻게 변해왔지?" |
| **Line History** | 특정 줄/블록의 변경 이력 | "이 로직이 왜 이렇게 바뀌었지?" |
| **Compare** | 브랜치/커밋 간 차이 비교 | "main과 뭐가 달라졌지?" |

### 터미널 Git 명령어 (자주 사용)

```bash
# 변경된 파일 확인
git status

# 변경 내용 확인
git diff                    # 아직 stage 안 된 변경
git diff --staged           # stage된 변경

# 특정 파일의 히스토리
git log --oneline -10       # 최근 10개 커밋
git log -p -- src/features/user/domain/user.entity.ts  # 파일별 변경 이력

# 특정 줄의 히스토리 (blame)
git blame src/features/user/domain/user.entity.ts -L 145,150
```

---

## 6. 생산성 확장 (VS Code Extensions)

### 필수 확장

| 확장 | 용도 | 왜 필요한가 |
|------|------|------------|
| **ESLint** | 코드 품질 검사 | 저장 시 자동으로 문제 표시 |
| **Prettier** | 코드 포매팅 | 저장 시 자동 정렬 (`Cmd+S`) |
| **GitLens** | Git 히스토리/blame | 코드 변경 이력 추적 |
| **Jest Runner** | 테스트 실행/디버깅 | 개별 테스트를 클릭으로 실행 |
| **Error Lens** | 에러 인라인 표시 | 에러가 발생한 줄에 바로 메시지 표시 |

### 권장 확장

| 확장 | 용도 |
|------|------|
| **Thunder Client** | VS Code 내장 REST 클라이언트 (Postman 대체) |
| **Todo Highlight** | TODO, FIXME 등 강조 표시 |
| **Import Cost** | import 옆에 번들 크기 표시 |
| **Path Intellisense** | 파일 경로 자동 완성 |

### settings.json 권장 설정

```jsonc
{
    // 저장 시 자동 포매팅
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",

    // 저장 시 ESLint 자동 수정
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": "explicit"
    },

    // 탭 크기 (Node.js 표준)
    "editor.tabSize": 4,

    // 미니맵 끄기 (화면 공간 확보)
    "editor.minimap.enabled": false,

    // 브래킷 색상 매칭
    "editor.bracketPairColorization.enabled": true,

    // 파일 탐색기에서 node_modules 숨기기
    "files.exclude": {
        "node_modules": true
    },

    // TypeScript import 경로 설정
    "typescript.preferences.importModuleSpecifier": "relative",

    // 터미널 기본 쉘
    "terminal.integrated.defaultProfile.osx": "zsh"
}
```

---

## 7. 코드 추적 실전 시나리오

### 시나리오: "updateWeeklyGoal API가 어떻게 동작하는지 추적"

```
[1단계] 진입점 찾기
    Cmd+Shift+F → "weeklyGoal" 검색 → routes 파일에서 라우트 정의 찾기

[2단계] Controller 확인
    F12 → Controller의 핸들러 메서드로 이동
    "DTO 검증 → Service 호출" 패턴 확인

[3단계] Service 레이어
    F12 → Service의 updateWeeklyGoal() 이동
    "Entity 조회 → Entity 메서드 호출 → 저장" 패턴 확인

[4단계] Entity 도메인 로직
    F12 → Entity의 updateWeeklyGoal() 이동
    "검증 → 상태 변경" 패턴 확인

[5단계] 역방향 추적
    Shift+F12 → 이 Entity 메서드를 호출하는 모든 곳 확인
    "Service 외에 다른 곳에서도 호출하는가?"
```

### 시나리오: "테스트가 실패했는데 원인을 모르겠다"

```
[1단계] 에러 메시지 확인
    터미널에서 실패한 테스트의 에러 메시지 확인
    Expected vs Received 값 비교

[2단계] 디버거로 진입
    실패한 테스트의 it() 블록에 브레이크포인트 설정
    Debug 패널 → "Debug Jest Current File" → F5

[3단계] 단계별 추적
    F10으로 한 줄씩 실행하며 VARIABLES 패널에서 값 변화 관찰
    "어느 시점에서 기대값과 달라지는가?"

[4단계] 원인이 다른 레이어에 있다면
    F11로 호출된 함수 안으로 진입
    CALL STACK에서 전체 호출 체인 확인
```

---

## 단축키 요약 치트시트

### 매일 쓰는 TOP 10

| 순위 | 단축키 | 동작 | 빈도 |
|------|--------|------|------|
| 1 | `Cmd+P` | 파일 열기 | 수백 회/일 |
| 2 | `F12` | 정의로 이동 | 수십 회/일 |
| 3 | `Ctrl+-` | 뒤로 가기 | 수십 회/일 |
| 4 | `Cmd+Shift+F` | 전체 검색 | 수십 회/일 |
| 5 | `Shift+F12` | 모든 참조 찾기 | 수십 회/일 |
| 6 | `Cmd+D` | 같은 단어 선택 | 수십 회/일 |
| 7 | `F2` | 심볼 이름 변경 | 수 회/일 |
| 8 | `Cmd+/` | 주석 토글 | 수십 회/일 |
| 9 | `F9` | 브레이크포인트 토글 | 수 회/일 |
| 10 | `` Ctrl+` `` | 터미널 토글 | 수십 회/일 |

### 디버깅 5종 세트

| 단축키 | 동작 |
|--------|------|
| `F9` | 브레이크포인트 |
| `F5` | 시작/계속 |
| `F10` | Step Over |
| `F11` | Step Into |
| `Shift+F11` | Step Out |

---

## 학습 후 체크리스트

- [ ] `Cmd+P`로 파일을 열 수 있는가? (마우스로 탐색기 클릭하지 않기)
- [ ] `F12`로 함수 정의를 따라갈 수 있는가?
- [ ] `Ctrl+-`로 돌아올 수 있는가?
- [ ] `Shift+F12`로 "누가 이 함수를 쓰는지" 찾을 수 있는가?
- [ ] `F9` + `F5`로 디버거를 사용하여 변수 값을 확인할 수 있는가?
- [ ] `npx jest --watch`로 TDD 사이클을 돌릴 수 있는가?
- [ ] `F2`로 변수명을 안전하게 변경할 수 있는가?
- [ ] `Cmd+Shift+F`로 프로젝트 전체에서 코드를 검색할 수 있는가?
