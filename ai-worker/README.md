# CBT AI Worker

AI 문제 생성 전용 로컬 FastAPI 서비스입니다. Next.js 앱은 이 서비스를 호출하고,
사용자 승인 전까지 생성 결과를 데이터베이스에 저장하지 않습니다.

## 실행

저장소 루트에서 다음 명령을 실행합니다.

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r ai-worker/requirements.txt
python -m uvicorn app.main:app --app-dir ai-worker --host 127.0.0.1 --port 8001
```

루트 `.env`의 `OPENAI_API_KEY` 또는 `GEMINI_API_KEY`를 사용합니다.

## API

- `GET /health`
- `POST /v1/workflows/questions/generate`
- `POST /v1/workflows/questions/import-images`

사진 인식 endpoint는 JPG, PNG, WEBP 이미지를 최대 5장까지 받아 문제 본문,
보기, 정답, 페이지, 추출 신뢰도를 구조화합니다. 정답이 없거나 형식이 불명확한
항목은 `review_required` 상태로 반환하며, 사용자 검토 전에는 저장하지 않습니다.
