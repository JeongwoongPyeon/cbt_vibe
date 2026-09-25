import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import * as XLSX from "xlsx";
import { getCurriculum } from "../../lib/curriculum";
import { validateQuestionDraft } from "../../lib/validation";

const groups = Array.from({ length: 7 }, (_, i) => JSON.parse(readFileSync(new URL(
  `../../test-data/computer-general-175/part-0${i + 1}.json`, import.meta.url), "utf8")) as { part: string; items: string[][] });
const book = XLSX.read(readFileSync(new URL("../../outputs/computer-general-175-20260920/컴퓨터일반_PART별25_창작175문항.xlsx", import.meta.url)));
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]], { defval: "" });

test("CG175 imports 25 unique medium-or-harder questions per curriculum PART with evidence and balanced answers", () => {
  assert.equal(book.SheetNames[0], "문제");
  assert.equal(rows.length, 175);
  assert.equal(new Set(rows.map(r => r.question)).size, 175);
  assert.deepEqual(groups.map(g => g.part), getCurriculum("computer_general").map(p => p.label));
  const totalAnswers = [0, 0, 0, 0];
  const meta = JSON.parse(readFileSync(new URL("../../test-data/computer-general-175/sources.json", import.meta.url), "utf8"));
  groups.forEach((group, p) => {
    assert.equal(group.items.length, 25);
    const counts = [0, 0, 0, 0];
    group.items.forEach((item, q) => {
      const i = p * 25 + q;
      const r = rows[i];
      const choices = [r.choice_1, r.choice_2, r.choice_3, r.choice_4].map(String);
      const result = validateQuestionDraft({
        type: r.type, examType: r.exam_type, category: r.category, part: r.part,
        unit: r.unit, topic: r.topic, stem: r.question, choices, answer: r.answer,
        explanation: r.explanation, difficulty: r.difficulty, tags: r.tags,
        sourceType: "excel_import", sourceNote: r.source_note,
      });
      assert.deepEqual(result.errors, [], `Row ${i + 2}`);
      assert.equal(r.no, i + 1);
      assert.equal(r.part, group.part);
      assert.equal(r.unit, item[0]);
      assert.equal(r.topic, item[1]);
      assert.equal(r.difficulty, item[2]);
      assert.ok(["보통", "어려움"].includes(String(r.difficulty)));
      assert.equal(r.question, item[3]);
      assert.equal(r.answer, item[4]);
      assert.deepEqual(new Set(choices), new Set(item.slice(4, 8)));
      assert.equal(new Set(choices).size, 4);
      assert.equal(r.explanation, item[8]);
      assert.ok(String(r.explanation).length >= 45);
      assert.equal(choices[Number(r.answer_no) - 1], r.answer);
      assert.equal(r.choice_5, "");
      assert.ok(String(r.source_note).includes(`CG175-P${p + 1}-${String(q + 1).padStart(2, "0")}`));
      const key = item[9].replace(/-extension$/, "");
      assert.ok(meta.evidence[key]);
      assert.equal(r.source_ids, meta.evidence[key].sources.join(", "));
      for (const source of meta.evidence[key].sources) assert.equal(new URL(meta.sources[source].url).protocol, "https:");
      counts[Number(r.answer_no) - 1]++;
      totalAnswers[Number(r.answer_no) - 1]++;
    });
    assert.deepEqual([...counts].sort(), [6, 6, 6, 7]);
  });
  assert.deepEqual(totalAnswers, [44, 44, 44, 43]);
  assert.equal(rows.filter(r => r.difficulty === "보통").length, 124);
  assert.equal(rows.filter(r => r.difficulty === "어려움").length, 51);
  for (const [address, cell] of Object.entries(book.Sheets["문제"])) {
    if (address.startsWith("!")) continue;
    assert.equal(cell.f, undefined, `Question text must not execute as a formula: ${address}`);
    assert.notEqual(cell.t, "e", address);
  }
  assert.equal(book.Sheets["출제기준"].B17.v, 175);
  assert.equal(book.Sheets["출제기준"].C17.v, 124);
  assert.equal(book.Sheets["출제기준"].D17.v, 51);
});

function answer(part: number, question: number) { return groups[part - 1].items[question - 1][4]; }
function numeric(part: number, question: number, value: number, suffix = "") { assert.equal(answer(part, question), `${Number(value.toPrecision(12))}${suffix}`); }

test("CG175 numerical answers are independently recalculated", () => {
  numeric(1, 1, 2e8 * (0.5 + 0.3 * 3 + 0.2 * 2) / 2e9, "초");
  numeric(1, 2, (6e8 * 1.5 / 3e9) / (6e8 * 0.8 / 2e9), "배");
  numeric(1, 5, 1.5e8 * 2 * 0.5e-9, "초");
  numeric(1, 7, 2 + 0.05 * 60, " ns");
  numeric(1, 8, 1 + 0.1 * (5 + 0.2 * 80), " ns");
  numeric(1, 21, (5 + 20 - 1) * 2, " ns");
  assert.equal(answer(1, 16), ((256 - 45) & 255).toString(2));
  assert.equal(answer(1, 17), (65536 - 20).toString(2));
  numeric(1, 18, -24 >> 2);
  numeric(2, 14, 7 * 1024 + 2500 % 1024);
  numeric(2, 16, 0.9 * 110 + 0.1 * 210, " ns");
  const lru: number[] = [];
  let misses = 0;
  for (const value of [1, 2, 3, 1, 4, 2]) {
    const index = lru.indexOf(value);
    if (index < 0) { misses++; if (lru.length === 3) lru.shift(); }
    else lru.splice(index, 1);
    lru.push(value);
  }
  numeric(2, 17, misses, "회");
  const requests = [10, 42, 80, 90];
  let head = 50, travel = 0;
  while (requests.length) {
    requests.sort((a, b) => Math.abs(a - head) - Math.abs(b - head));
    const next = requests.shift()!;
    travel += Math.abs(next - head); head = next;
  }
  numeric(2, 20, travel, "트랙");
  assert.equal(answer(3, 1), `192.168.10.${173 & 224}`);
  numeric(3, 9, Math.min(12, 8) - 3, " KiB");
  numeric(3, 22, (1500 - 20) / 8);
  numeric(3, 24, 1200 * 8 / 1e7 * 3 * 1000, " ms");
  numeric(4, 2, 12 * 11 / 2, "개");
  const d = Number(answer(4, 3));
  assert.equal(3 * d % ((5 - 1) * (11 - 1)), 1);
  numeric(6, 9, 10 - 8 + 2);
  numeric(6, 23, (2 + 4 * 5 + 14) / 6, "일");
  assert.equal(answer(7, 1), parseInt("17", 8).toString(2).padStart(6, "0"));
  numeric(7, 5, 40 + 30);
  numeric(7, 6, [55, 60, 75, 80, 90].filter(n => n >= 60 && n < 80).length);
  numeric(7, 19, [2, 3, 4].reduce((sum, qty, i) => sum + qty * [10, 20, 15][i], 0));
});

test("CG175 SJF, SRTF and RR answers agree with execution simulations", () => {
  function simulate(jobs: { arrival: number; burst: number }[], policy: "sjf" | "srtf" | "rr", quantum = 2) {
    const remaining = jobs.map(j => j.burst), completed = jobs.map(() => 0);
    let time = 0, running = -1, slice = 0;
    const ready: number[] = [];
    while (remaining.some(n => n > 0)) {
      jobs.forEach((j, i) => { if (j.arrival === time) ready.push(i); });
      if (running >= 0 && (remaining[running] === 0 || (policy === "rr" && slice === quantum))) {
        if (remaining[running] > 0) ready.push(running);
        running = -1;
      }
      if (policy === "srtf" && running >= 0) { ready.push(running); running = -1; }
      if (running < 0 && ready.length) {
        if (policy !== "rr") ready.sort((a,b) => remaining[a] - remaining[b] || a - b);
        running = ready.shift()!; slice = 0;
      }
      time++;
      if (running >= 0) { remaining[running]--; slice++; if (!remaining[running]) completed[running] = time; }
    }
    return { wait: completed.reduce((s,c,i) => s + c - jobs[i].arrival - jobs[i].burst, 0), turnaround: completed.reduce((s,c,i)=>s+c-jobs[i].arrival,0) };
  }
  const make = (a: number[], b: number[]) => a.map((arrival,i)=>({arrival,burst:b[i]}));
  assert.equal(answer(2,1), `${simulate(make([0,0,0],[7,2,4]),"sjf").wait}/3`);
  assert.equal(answer(2,2), `${simulate(make([0,1,2],[6,2,1]),"sjf").turnaround}/3`);
  assert.equal(answer(2,3), `${simulate(make([0,1,2],[8,4,2]),"srtf").wait}/3`);
  assert.equal(answer(2,4), `${simulate(make([0,0,0],[5,3,1]),"rr").wait}/3`);
});

test("CG175 SQL NULL, grouping, join and set examples agree with SQLite", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE T(x); INSERT INTO T VALUES (10),(NULL),(20),(NULL); CREATE TABLE C(id); INSERT INTO C VALUES(1),(2),(3); CREATE TABLE O(customer); INSERT INTO O VALUES(1),(1),(2); CREATE TABLE sales(dept, amount); INSERT INTO sales VALUES('A',40),('A',70),('B',80),('B',10);");
    const counts = db.prepare("SELECT COUNT(*), COUNT(x), SUM(x) FROM T").get()!;
    assert.equal(answer(5,9), Object.values(counts).join(", "));
    assert.equal(db.prepare("SELECT x FROM (SELECT 1 AS x UNION ALL SELECT 2 UNION ALL SELECT NULL) WHERE x NOT IN (1,NULL)").all().length, Number.parseInt(answer(5,10)));
    assert.equal(db.prepare("SELECT dept FROM sales GROUP BY dept HAVING SUM(amount)>=100").all()[0].dept, "A");
    assert.equal(db.prepare("SELECT * FROM C LEFT JOIN O ON C.id=O.customer").all().length, Number.parseInt(answer(5,12)));
    const union = db.prepare("SELECT 1 UNION SELECT 1 UNION SELECT 2 UNION SELECT 2 UNION SELECT 3").all().length;
    const all = db.prepare("SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 2 UNION ALL SELECT 3").all().length;
    assert.equal(answer(5,14), `${union}, ${all}`);
  } finally { db.close(); }
});
