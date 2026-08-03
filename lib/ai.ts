import { getExamTypeLabel } from "./types";
import type { ExamType, Question, QuestionDraft, QuestionType } from "./types";
import { normalizeExamType, getQuestionTypeLabel, validateQuestionDraft } from "./validation";

type AiProvider = "openai" | "gemini";

export interface GenerateQuestionsInput {
  provider: AiProvider;
  examType: ExamType;
  category: string;
  difficulty: string;
  type: QuestionType;
  count: number;
  instruction: string;
  baseQuestion?: Question;
}

export interface GenerateQuestionsResult {
  questions: QuestionDraft[];
  errors: string[];
  rawText: string;
}

export async function generateQuestions(
  input: GenerateQuestionsInput,
): Promise<GenerateQuestionsResult> {
  const prompt = buildGenerationPrompt(input);
  const rawText =
    input.provider === "gemini"
      ? await generateWithGemini(prompt)
      : await generateWithOpenAI(prompt);

  return parseGeneratedQuestions(rawText, input.examType);
}

function buildGenerationPrompt(input: GenerateQuestionsInput): string {
  const base = input.baseQuestion
    ? `
기준 문제:
- 유형: ${getQuestionTypeLabel(input.baseQuestion.type)}
- 카테고리: ${input.baseQuestion.category}
- 난이도: ${input.baseQuestion.difficulty}
- 지문: ${input.baseQuestion.stem}
- 보기: ${input.baseQuestion.choices.join(" / ")}
- 정답: ${input.baseQuestion.answer}
- 해설: ${input.baseQuestion.explanation}
`
    : "";

  return `
너는 CBT 문제를 구조화해서 만드는 출제 보조자다.
아래 조건에 맞는 한국어 CBT 문제 ${input.count}개를 생성한다.

조건:
- 시험 종류: ${getExamTypeLabel(input.examType)}
- 문제 유형: ${getQuestionTypeLabel(input.type)} (${input.type})
- 카테고리: ${input.category || "미분류"}
- 난이도: ${input.difficulty || "보통"}
- 추가 요청: ${input.instruction || "없음"}
${base}
반드시 JSON만 출력한다. 마크다운 코드블록은 사용하지 않는다.
출력 형식:
{
  "questions": [
    {
      "type": "${input.type}",
      "category": "카테고리",
      "tags": ["태그"],
      "difficulty": "난이도",
      "stem": "문제 지문",
      "choices": ["보기1", "보기2", "보기3", "보기4"],
      "answer": "정답 또는 보기 번호",
      "acceptableAnswers": ["단답형 허용 정답"],
      "explanation": "해설",
      "sourceType": "${input.baseQuestion ? "ai_expanded" : "ai_generated"}",
      "sourceNote": "AI 생성"
    }
  ]
}
4지선다형은 choices 4개, 5지선다형은 choices 5개, 단답형은 choices 빈 배열을 사용한다.
`;
}

async function generateWithOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되어 있지 않습니다.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: prompt,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const json = await response.json();
  return extractOpenAIText(json);
}

async function generateWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되어 있지 않습니다.");
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const json = await response.json();
  return json.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n") || "";
}

function extractOpenAIText(json: Record<string, unknown>): string {
  if (typeof json.output_text === "string") {
    return json.output_text;
  }

  const output = Array.isArray(json.output) ? json.output : [];
  const texts: string[] = [];

  for (const item of output) {
    const content = (item as { content?: unknown }).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      const text = (part as { text?: unknown }).text;

      if (typeof text === "string") {
        texts.push(text);
      }
    }
  }

  return texts.join("\n");
}

function parseGeneratedQuestions(rawText: string, examType: ExamType): GenerateQuestionsResult {
  const cleaned = rawText
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const errors: string[] = [];

  try {
    const parsed = JSON.parse(cleaned);
    const items = Array.isArray(parsed) ? parsed : parsed.questions;

    if (!Array.isArray(items)) {
      return {
        questions: [],
        errors: ["AI 응답에서 questions 배열을 찾을 수 없습니다."],
        rawText,
      };
    }

    const questions: QuestionDraft[] = [];

    for (const item of items) {
      const validation = validateQuestionDraft({
        ...(item as Record<string, unknown>),
        examType: normalizeExamType((item as Record<string, unknown>).examType || examType),
      });

      if (validation.ok) {
        questions.push(validation.question);
      } else {
        errors.push(...validation.errors);
      }
    }

    return { questions, errors, rawText };
  } catch {
    return {
      questions: [],
      errors: ["AI 응답을 JSON으로 해석하지 못했습니다."],
      rawText,
    };
  }
}
