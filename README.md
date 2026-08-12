# cbt_vibe

AI 기반 CBT(Computer Based Test) 풀이 사이트입니다.

## 목표

- 사용자가 CBT 문제를 풀고 즉시 채점 결과를 확인할 수 있습니다.
- GPT와 Gemini API를 활용해 문제 해설, 오답 분석, 학습 힌트를 제공합니다.
- 문제 풀이 기록을 바탕으로 취약 유형을 정리하고 복습 흐름을 지원합니다.

## 현재 구성

이 저장소는 프로젝트 초기 설정 단계입니다.

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
- NCS, 컴퓨터일반, 정보보호론별 문제/풀이/오답노트 분리
- Noto Sans KR 로컬 폰트와 TailwindCSS 기반 UI

상단 시험 선택기에서 시험 종류를 바꾸면 해당 시험의 문제, 풀이 기록, 정답률,
오답노트만 표시됩니다. 기존 로컬 SQLite 데이터는 마이그레이션 시 컴퓨터일반으로
분류되고, NCS와 정보보호론 샘플 데이터가 자동으로 보충됩니다.

## 환경변수

로컬 개발 시 `.env.example`을 참고해 `.env` 파일에 API 키를 설정합니다.

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
AI_DEFAULT_PROVIDER=openai
AI_WORKER_URL=http://127.0.0.1:8001
AI_WORKER_TIMEOUT_MS=90000
AI_WORKER_REQUEST_TIMEOUT=90
AI_PROMPT_VERSION=question-v1
```

실제 API 키가 들어간 `.env` 파일은 Git에 커밋하지 않습니다.

## 로컬 실행

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

Worker의 `GET /health`가 `status: ok`를 반환하면 Next.js의 AI 생성 화면에서
일반 문제 생성이 동작합니다. 문제집 사진 인식은 다음 단계에서 별도 워크플로우로
추가합니다.

앱 데이터는 `local-data/cbt.sqlite`에 저장되며 Git에는 커밋되지 않습니다.
