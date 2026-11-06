# Anki 가져오기

`한국농어촌공사_경상_가이드북_60카드.apkg`를 Anki의 파일 가져오기로 선택한다. 필드 매핑이나 플러그인은 필요하지 않다. 모바일에서는 파일을 다운로드한 뒤 AnkiMobile 또는 AnkiDroid로 연다.

- 경영학 객관식: 25장
- 회계·재무 객관식: 15장
- 필수 회계·재무 개념: 20장

객관식은 보기까지 읽고 답을 떠올린 뒤 Anki의 정답 보기로 확인한다. 보기를 누르는 자동 채점형은 아니다. 뒷면에 정답 번호·정답 문구·해설이 나온다. 개념 카드는 질문에 답을 떠올린 뒤 공식과 사례를 확인한다. 학습 이력 없이 모두 새 카드로 제작했다.

제공 가이드북의 과거 전공 후기와 키워드를 바탕으로 만든 창작 학습자료이며 공식 기출 복원본은 아니다. 동일 노트 식별자를 유지하므로 재생성 파일을 다시 가져올 때 중복 방지에 도움이 된다. 실제 업데이트 처리는 Anki의 가져오기 설정에 따른다.

제작 검증: ZIP 무결성, SQLite 무결성, 고유 노트 60개·카드 60개, 하위 덱별 25/15/20개, 전체 신규 카드 상태. 실제 Anki 앱에서의 가져오기는 별도 확인하지 않았다.

재생성(프로젝트 루트, Python 및 Node 필요):

```powershell
.venv/Scripts/python.exe -m pip install --target .local/anki-deps genanki==0.13.1
.venv/Scripts/python.exe -X utf8 scripts/export-krc-anki.py
```

[Anki 공식 패키지 안내](https://docs.ankiweb.net/manual/importing/packaged-decks)
