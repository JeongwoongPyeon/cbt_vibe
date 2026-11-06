"""Build a portable Anki deck; requires genanki==0.13.1 in .local/anki-deps."""
import html
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".local" / "anki-deps"))
import genanki

CONCEPTS = [
    ("investment-property", "투자부동산", "임대용·자가사용·통상 판매용 부동산의 회계 분류는?", "임대수익·장기 시세차익 목적: 투자부동산\n직접 업무에 사용: 유형자산\n통상 영업과정에서 판매: 재고자산", "외형이 아니라 보유 목적을 본다. 같은 건물이라도 목적에 따라 분류가 다르다."),
    ("contribution", "손익분기점", "단위공헌이익은 무엇이며 어떻게 계산하는가?", "단위공헌이익 = 판매단가 − 단위변동비", "단가 8만 원, 변동비 5만 원이면 1대당 3만 원이 고정비 회수와 이익에 기여한다."),
    ("break-even", "손익분기점", "손익분기 판매량의 공식은?", "고정비 ÷ 단위공헌이익", "고정비 900만 원, 단위공헌이익 3만 원이면 300대. 손익분기점의 영업이익은 0이다."),
    ("target-profit", "손익분기점", "세전 목표영업이익이 있을 때 필요한 판매량은?", "(고정비 + 목표영업이익) ÷ 단위공헌이익", "고정비 800만 원, 목표이익 400만 원, 단위공헌이익 4만 원이면 300개다."),
    ("responsibility", "책임중심점", "원가·수익·이익·투자중심점의 책임 범위는?", "원가: 비용\n수익: 매출\n이익: 매출과 비용\n투자: 이익과 투자자산", "설비투자 의사결정 권한까지 있으면 투자중심점이다. 직원 개인 평가와 부문 책임을 구분한다."),
    ("controllability", "책임중심점", "관리자 평가에서 통제가능성 원칙이란?", "관리자의 권한으로 영향을 줄 수 있는 성과를 중심으로 평가한다.", "본사 공통비가 배부되었다고 해서 부문장이 그 비용을 통제할 수 있는 것은 아니다."),
    ("labor-rate", "직접노무원가", "직접노무원가 임률차이 공식에서 사용하는 시간은?", "실제작업시간\n임률차이 = 실제시간 × (실제임률 − 표준임률)", "실제 300시간, 실제 시급 22,000원, 표준 20,000원이면 60만 원 불리. 허용표준시간을 곱하지 않는다."),
    ("labor-efficiency", "직접노무원가", "직접노무원가 능률차이 공식은?", "표준임률 × (실제시간 − 실제생산량에 허용된 표준시간)", "표준 시급 2만 원, 실제 300시간, 허용 280시간이면 40만 원 불리. 실제−표준으로 계산한 양수 비용차이는 불리다."),
    ("transfer-idle", "내부대체가격", "유휴능력이 있고 외부판매를 포기하지 않는 경우 공급부문의 최소대체가격은?", "내부이전 증분원가", "기회비용은 0이다. 내부 주문의 증분원가가 7천 원이면 최소대체가격은 7천 원이다."),
    ("transfer-full", "내부대체가격", "내부 이전으로 외부판매를 포기하면 최소대체가격은?", "내부이전 증분원가 + 포기한 외부 공헌이익", "외부가격 10,000원, 생산변동비 6,000원, 외부판매 수수료 1,000원일 때 6,000+(10,000−6,000−1,000)=9,000원이다."),
    ("transfer-buyer", "내부대체가격", "구매부문이 수용할 대체가격의 상한 기준은?", "동일 조건의 외부 조달비용", "품질·운송·거래조건이 동일하다는 전제다. 공급부문 최저가격과 구매부문 상한을 구분한다."),
    ("qualifying-asset", "차입원가", "차입원가 자본화의 적격자산이란?", "의도한 사용 또는 판매 준비에 상당한 기간이 필요한 자산", "이미 사용 가능한 설비를 대출로 샀다는 사실만으로 이자를 자산 원가에 넣지는 않는다."),
    ("capitalization-start", "차입원가", "차입원가 자본화를 시작하는 세 조건은?", "자산 지출 발생 + 차입원가 발생 + 사용·판매 준비 활동 수행", "세 조건이 모두 충족되어야 한다. 직접 관련되는 차입원가 중 요건을 충족한 금액을 자산 원가에 포함한다."),
    ("capitalization-end", "차입원가", "차입원가 자본화는 언제 종료하는가?", "의도한 사용·판매 준비 활동이 실질적으로 완료될 때", "대출 만기까지 무조건 자본화하는 것이 아니다. 차입금 상환 시점과 자산 사용 준비 완료 시점을 구분한다."),
    ("dol", "레버리지", "영업레버리지도(DOL)의 공식은?", "공헌이익 ÷ 영업이익", "공헌이익 4,000만 원, 영업이익 1,000만 원이면 4배. 기준점 부근에서 다른 조건이 같을 때 매출 1% 변화에 영업이익이 약 4% 변한다는 뜻이다."),
    ("dfl", "레버리지", "우선주 등 조정이 없을 때 재무레버리지도(DFL)의 공식은?", "영업이익 ÷ (영업이익 − 이자비용)", "영업이익 1,200만 원, 이자 400만 원이면 1.5배다. 영업고정비와 이자비용의 효과를 혼동하지 않는다."),
    ("payback", "회수기간", "단순 회수기간은 회계이익과 현금흐름 중 무엇을 누적하는가?", "순현금유입", "900만 원 투자 후 400·300·400만 원 유입이면 2년 말 200만 원 미회수. 연중 균등 유입 시 2.5년, 연말에만 유입되면 3년이다."),
    ("npv", "기업가치", "단순 회수기간법이 놓치는 두 요소와 이를 반영하는 대표 지표는?", "화폐의 시간가치와 회수 이후 현금흐름\n대표 지표: 순현재가치(NPV)", "NPV는 전체 증분현금흐름의 현재가치에서 초기투자액을 뺀다. 회수기간이 같아도 기업가치 증가분은 다를 수 있다."),
    ("conversion-shares", "전환사채", "전환사채를 전액 전환할 때 받는 주식 수의 공식은?", "전환 대상 금액 ÷ 전환가액", "액면 100만 원을 주당 2만 원에 전환하면 50주. 분모에 현재 주가를 넣지 않는다."),
    ("conversion-value", "전환사채", "전환가치의 공식은?", "전환주식 수 × 현재 주가", "50주, 주가 24,000원이면 120만 원. 사채의 장부금액이나 발행가와는 다른 개념이다."),
]

CSS = """
.card { font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; font-size: 19px;
  line-height: 1.75; text-align: left; color: #222; background: #fff; padding: 20px;
  overflow-wrap: anywhere; }
.wrap { max-width: 760px; margin: auto; }
.meta,.source { color: #666; font-size: 13px; }
.question { margin: 18px 0; font-weight: 600; }
ol { padding-left: 30px; } li { padding: 8px 4px; }
.answer { border-left: 4px solid #20835a; padding: 8px 14px; font-weight: 600; }
.explanation { margin: 18px 0; } hr { border: 0; border-top: 1px solid #bbb; }
.nightMode.card { background: #202124; color: #eee; }
.nightMode .meta,.nightMode .source { color: #bbb; }
@media(max-width: 480px) { .card { font-size: 17px; padding: 12px; } }
"""

def esc(value):
    return html.escape(value).replace("\n", "<br>")

def build():
    result = subprocess.run([
        "node", "node_modules/tsx/dist/cli.mjs", "-e",
        "import { krcBusinessQuestions } from './lib/krc-business-questions.ts'; console.log(JSON.stringify(krcBusinessQuestions));",
    ], cwd=ROOT, check=True, capture_output=True, encoding="utf-8")
    questions = json.loads(result.stdout)
    assert len(questions) == 40
    model = genanki.Model(2061106001, "KRC Guidebook Basic v1",
        fields=[{"name": name} for name in ["Key", "Topic", "Question", "Answer", "Explanation", "Source"]],
        templates=[{"name": "문제 → 정답·해설",
            "qfmt": '<div class="wrap"><div class="meta">{{Topic}}</div><div class="question">{{Question}}</div></div>',
            "afmt": '{{FrontSide}}<div class="wrap"><hr id="answer"><div class="answer">{{Answer}}</div><div class="explanation">{{Explanation}}</div><div class="source">{{Source}}</div></div>'}],
        css=CSS, sort_field_index=0)
    prefix = "한국농어촌공사 경상 · 가이드북"
    decks = [genanki.Deck(2061106011 + i, prefix + "::" + name) for i, name in enumerate([
        "01 경영학 문제 25", "02 회계·재무 문제 15", "03 필수 회계·재무 개념 20"])]
    for deck in decks:
        deck.description = "제공 가이드북의 전공 후기·키워드 기반 창작 학습자료. 공식 기출 복원본이 아닙니다."
    for i, q in enumerate(questions):
        assert len(q["choices"]) == 4 and q["answer"] in q["choices"]
        front = esc(q["stem"]) + "<ol>" + "".join("<li>" + esc(c) + "</li>" for c in q["choices"]) + "</ol>"
        answer = f'정답 {q["choices"].index(q["answer"]) + 1}번: {q["answer"]}'
        key = f"krc-guidebook-v2-q-{i + 1:03}"
        decks[0 if i < 25 else 1].add_note(genanki.Note(model=model,
            guid=genanki.guid_for(key), tags=["KRC", "가이드북판", "객관식", q["unit"].replace(" ", "_")],
            fields=[key, esc(f'{i+1:02}. {q["unit"]}'), front, esc(answer), esc(q["explanation"]), esc(q["sourceNote"])]))
    for slug, topic, front, answer, explanation in CONCEPTS:
        key = "krc-guidebook-concept-" + slug
        decks[2].add_note(genanki.Note(model=model, guid=genanki.guid_for(key),
            tags=["KRC", "가이드북판", "핵심개념", topic],
            fields=[key, esc(topic), esc(front), esc(answer), esc(explanation), "필수 회계·재무 개념표 기반 · 창작 학습자료"]))
    out = ROOT / "outputs" / "krc-business-40"
    out.mkdir(parents=True, exist_ok=True)
    target = out / "한국농어촌공사_경상_가이드북_60카드.apkg"
    genanki.Package(decks).write_to_file(str(target))
    with zipfile.ZipFile(target) as archive, tempfile.TemporaryDirectory() as temp:
        assert archive.testzip() is None
        dbfile = Path(temp) / "collection.anki2"
        dbfile.write_bytes(archive.read("collection.anki2"))
        with closing(sqlite3.connect(dbfile)) as db:
            assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
            assert db.execute("SELECT count(*), count(DISTINCT guid) FROM notes").fetchone() == (60, 60)
            assert db.execute("SELECT count(*) FROM cards WHERE type=0 AND reps=0").fetchone()[0] == 60
            assert sorted(n for _, n in db.execute("SELECT did,count(*) FROM cards GROUP BY did")) == [15, 20, 25]
            assert all(len(fields.split("\x1f")) == 6 for (fields,) in db.execute("SELECT flds FROM notes"))
    print(f"Verified 60 new cards (25 + 15 + 20): {target}")

if __name__ == "__main__":
    build()
