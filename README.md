# cbt_vibe

AI 기반 CBT(Computer Based Test) 풀이 사이트입니다.

## 목표

- 사용자가 CBT 문제를 풀고 즉시 채점 결과를 확인할 수 있습니다.
- GPT와 Gemini API를 활용해 문제 해설, 오답 분석, 학습 힌트를 제공합니다.
- 문제 풀이 기록을 바탕으로 취약 유형을 정리하고 복습 흐름을 지원합니다.

## 초기 구성

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
- Notion 계열 디자인 시스템 기반 앱 셸

## 환경변수

로컬 개발 시 `.env.example`을 참고해 `.env` 파일에 API 키를 설정합니다.

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
AI_DEFAULT_PROVIDER=openai
```

실제 API 키가 들어간 `.env` 파일은 Git에 커밋하지 않습니다.

## 로컬 실행

```bash
npm install
npm run dev
```

앱 데이터는 `local-data/cbt.sqlite`에 저장되며 Git에는 커밋되지 않습니다.
