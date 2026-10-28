import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { krcBusinessQuestions } from "../lib/krc-business-questions";

const destination = path.resolve("outputs/krc-business-40");
mkdirSync(destination, { recursive: true });
const header = "# 한국농어촌공사 경상 대비 창작 40문항\n\n사용자 제공 후기 이미지의 키워드와 비중을 참고한 연습자료입니다. 공식 기출·출제기준이 아니며 실제 시험의 문항 수나 비중을 보장하지 않습니다. 경영학원론 25문항, 회계·재무 15문항.\n\n";
const body = krcBusinessQuestions.map((q, i) =>
  `## ${i + 1}. ${q.part} / ${q.unit}\n\n${q.stem}\n\n${q.choices.map((choice, j) => `${j + 1}. ${choice}`).join("\n")}\n\n**정답: ${q.choices.indexOf(q.answer) + 1}번**\n\n${q.explanation}\n`,
).join("\n");
writeFileSync(path.join(destination, "학습자료.md"), header + body, "utf8");
console.log(`Exported ${krcBusinessQuestions.length} questions to ${destination}`);
