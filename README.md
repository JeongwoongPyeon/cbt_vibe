# cbt_vibe

AI 기반 CBT(Computer Based Test) 풀이 사이트입니다.

## 목표

- 사용자가 CBT 문제를 풀고 즉시 채점 결과를 확인할 수 있습니다.
- GPT와 Gemini API를 활용해 문제 해설, 오답 분석, 학습 힌트를 제공합니다.
- 문제 풀이 기록을 바탕으로 취약 유형을 정리하고 복습 흐름을 지원합니다.

## 현재 구성

Vite 기반 React SPA와 로컬 Node.js API, Python AI Worker로 구성됩니다.

- `client/`: React 화면, TailwindCSS, Noto Sans KR
- `server/`: Hono 기반 로컬 API와 개발/빌드 실행 서버
- `lib/`: 문제 검증, SQLite 저장, 공통 타입과 UI 클래스
- `ai-worker/`: FastAPI 기반 AI 워크플로우
- `README.md`: 프로젝트 개요와 실행 준비 문서
- `docs/DEVELOPMENT_PLAN.md`: AI CBT 사이트 개발 계획
- `docs/DESIGN_SYSTEM.md`: Notion 계열 기반 디자인 시스템 가이드
- `.env.example`: 필요한 환경변수 예시
- `.gitignore`: 로컬 환경 파일, 의존성, 빌드 산출물 제외 규칙

## MVP 범위

- 로컬 SQLite 기반 문제/풀이 기록/오답노트 저장
- 4지선다형, 5지선다형, 단답형 풀이
- 수동 문제 등록
- 엑셀 파일 문제 가져오기
- GPT/Gemini 기반 문제 생성 API 연결
- Python FastAPI AI Worker 기반 일반 문제 생성 워크플로우
- 문제집 사진 인식 및 CBT 문제 미리보기 워크플로우
- NCS, 컴퓨터일반, 정보보호론별 문제/풀이/오답노트 분리
- Noto Sans KR 로컬 폰트와 TailwindCSS 기반 UI
- 컴퓨터일반 목차 기준 대단원 선택 및 사용자 지정 단원/세부 기준

상단 시험 선택기에서 시험 종류를 바꾸면 해당 시험의 문제, 풀이 기록, 정답률,
오답노트만 표시됩니다. 기존 로컬 SQLite 데이터는 마이그레이션 시 컴퓨터일반으로
분류되고, NCS와 정보보호론 샘플 데이터가 자동으로 보충됩니다.

AI 생성 화면의 기준 설정에서 대단원, 단원, 세부 기준을 지정할 수 있습니다.
컴퓨터일반의 대단원 기본값과 적용 원칙은 [docs/CURRICULUM.md](docs/CURRICULUM.md)에
기록되어 있습니다.

## 환경변수

로컬 개발 시 `.env.example`을 참고해 `.env` 파일에 API 키를 설정합니다.

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
OPENAI_VISION_MODEL=gpt-4.1-mini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
GEMINI_VISION_MODEL=gemini-2.0-flash
AI_DEFAULT_PROVIDER=openai
AI_WORKER_URL=http://127.0.0.1:8001
AI_WORKER_TIMEOUT_MS=90000
AI_WORKER_REQUEST_TIMEOUT=90
AI_PROMPT_VERSION=question-v1
```

실제 API 키가 들어간 `.env` 파일은 Git에 커밋하지 않습니다.
키는 Node 서버와 Python Worker에서만 읽습니다. 브라우저에 공개되는 `VITE_`
접두사를 API 키에 붙이지 마세요. `PORT`로 웹 포트를, `CBT_DATA_DIR`로 데이터
폴더를 변경할 수 있습니다. 기존 데이터의 기본 위치는 바뀌지 않습니다.

## 로컬 실행

Node.js 24 이상이 필요합니다. 아래 명령은 저장소 루트에서 실행합니다.

```bash
npm install
npm run dev
```

AI 문제 생성을 사용하려면 별도 터미널에서 Worker도 실행합니다.

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r ai-worker/requirements.txt
python -m uvicorn app.main:app --app-dir ai-worker --host 127.0.0.1 --port 8001
```

Worker의 `GET /health`가 `status: ok`를 반환하면 웹앱의 AI 생성 화면에서
일반 문제 생성과 AI 화면의 `사진 인식` 모드가 동작합니다. 사진 결과는 정답과
형식 검토 후 저장하며, 정답이 누락된 항목은 직접 수정할 수 있습니다.

두 서버를 한 번에 실행하려면 PowerShell에서 다음 명령을 사용합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1
```

또는 `npm run dev:all`로 실행할 수 있습니다. 스크립트는 현재 터미널에서
Python Worker와 Vite + Node API를 함께 실행하고, `Ctrl+C`로 함께 종료합니다.
웹 기본 포트는 3000이며 사용 중이면 다음 포트로 이동합니다(최대 20회).
Worker 기본 포트 8001이 사용 중이면 기존 프로세스를 건드리지 않고 종료합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1 -WebPort 3001 -WorkerPort 8002
```

`-NextPort`는 이전 스크립트와의 호환을 위한 `-WebPort` 별칭으로 남겨 두었습니다.
웹과 `/api/*`는 같은 주소에서 제공됩니다. 개발 중 React 변경은 Vite HMR로,
Node API 변경은 tsx watch로 반영됩니다. AI Worker 코드를 수정하면 재시작합니다.

## 학습과 모의고사

- 학습모드: 이전/다음 문항 이동, 답안 유지, 즉시 채점과 해설, 다시 풀기.
- 모의고사: 현재 검색/단원/풀이 상태 조건에서 최대 100문항을 무작위 선택합니다.
  문항 수와 제한시간(1~180분)을 설정하고 답안표에서 자유롭게 이동하거나 검토 표시를 남깁니다.
  보유 문항 수가 요청 수보다 적으면 보유 문항만 출제합니다.
- 모의고사에서는 제출 전 정답과 해설을 표시하지 않습니다. 수동 제출 또는 시간 만료 시
  일괄 채점하며, 미응답은 오답으로 기록합니다. 시험 중에는 다른 메뉴와 시험 종류 변경을 잠급니다.
- 진행 중 답안, 문항 순서, 검토 표시와 종료 시각은 브라우저 로컬 저장소에 보관됩니다.
  같은 주소/브라우저에서 새로고침하면 이어서 진행하며, 닫아둔 시간도 제한시간에 포함됩니다.
  주소나 포트 변경, 브라우저 데이터 삭제 시 임시 시험은 복원되지 않습니다.
- 제출한 기록은 기존 SQLite 풀이/오답노트에 저장됩니다. 통신 실패 시 같은 제출 건을
  재시도해도 중복 기록이 생성되지 않으며, 일부 문항만 저장되는 것도 방지합니다.
- 문제 은행과 학습 목록에서 대단원/단원/풀이 상태를 함께 필터링할 수 있습니다.
  같은 문항의 최근 5회 정오답은 최신순으로 표시하며, 아이콘에 마우스를 올리면 시각과 모드를 확인합니다.
- 유사문제는 같은 시험의 기존 문제를 세부 주제, 단원, 대단원, 카테고리, 공통 태그 순으로 비교합니다.
  별도 AI 호출이나 비용이 없으며, `AI로 새 문제 생성`은 기존 AI 생성 기능입니다.

이 모의고사는 개인 학습용입니다. 공식 시험용 부정행위 방지나 서버 기준 제한시간 검증은 제공하지 않습니다.

## 필터와 학습 통계

- 학습/문제 관리의 대단원·단원 필터는 Radix Popover와 cmdk 기반 검색 메뉴입니다.
  방향키/Enter로 선택하고 Escape로 닫습니다. 대단원 변경 시 단원 선택은 초기화됩니다.
- 풀이 상태는 전체/푼 문제/미풀이 버튼으로 전환하며, 초기화 버튼으로 필터를 해제합니다.
  모의고사 진행 중에는 기존과 동일하게 필터를 변경할 수 없습니다.
- 대시보드는 Chart.js로 정오답 비율, 일별 정답률, 풀이 횟수 상위 8개 단원 성과를 표시합니다.
  선택한 시험의 최근 7일/30일 기록을 한국 시간 날짜 기준으로 집계합니다.
- 반복 풀이도 각각 집계하고, 모의고사 미응답은 오답에 포함합니다. 풀이가 없는 날은
  0% 대신 빈 구간으로 표시합니다. 상세 기록 표에는 전체 단원과 날짜별 수치가 제공됩니다.
- 차트 코드는 대시보드에서 지연 로딩하며, 외부 통계 서비스로 데이터를 전송하지 않습니다.

## 빌드와 검증

```bash
npm test
npm run build
npm start
```

빌드는 타입 검사 후 `dist/client`에 브라우저 파일을, `dist/server`에 Node API를
생성합니다. `npm start`는 Vite 개발 서버 없이 빌드된 화면과 API를 제공합니다.
빌드 실행에서도 AI 기능을 사용하려면 Worker를 별도로 켜야 합니다.
`npm test`는 임시 SQLite와 가짜 Worker로 저장/채점/오답노트/AI 중계를 검사하며,
실제 API 비용이나 기존 데이터 변경은 발생하지 않습니다.

모든 서버는 `127.0.0.1`에서만 수신하며, 외부 배포나 공개 서비스용 인증은 포함하지 않습니다.
Vite 개발 서버의 파일 접근에서도 환경 파일, DB, 서버 코드와 Worker 폴더를 차단합니다.

앱 데이터는 `local-data/cbt.sqlite`에 저장되며 Git에는 커밋되지 않습니다.
