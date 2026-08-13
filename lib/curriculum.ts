export interface CurriculumTopic {
  id: string;
  label: string;
}

export interface CurriculumUnit {
  id: string;
  label: string;
  topics: CurriculumTopic[];
}

export interface CurriculumPart {
  id: string;
  label: string;
  units: CurriculumUnit[];
}

function part(id: string, label: string): CurriculumPart {
  return { id, label, units: [] };
}

// The computer-general defaults intentionally keep only the publicly listed part names.
// Users can add their own unit and topic labels in the generation form.
const computerGeneralParts: CurriculumPart[] = [
  part("part-01", "PART 01. 전자계산기구조론"),
  part("part-02", "PART 02. 운영체제론"),
  part("part-03", "PART 03. 데이터통신"),
  part("part-04", "PART 04. 정보보호론"),
  part("part-05", "PART 05. 데이터베이스론"),
  part("part-06", "PART 06. 소프트웨어공학"),
  part("part-07", "PART 07. 스프레드시트"),
];

const ncsParts: CurriculumPart[] = [
  part("communication", "의사소통능력"),
  part("problem-solving", "문제해결능력"),
  part("numeracy", "수리능력"),
];

const securityParts: CurriculumPart[] = [
  part("security-foundation", "정보보호 개론"),
  part("security-technology", "정보보호 기술"),
  part("security-management", "정보보호 관리"),
];

export const CURRICULUMS: Record<string, CurriculumPart[]> = {
  ncs: ncsParts,
  computer_general: computerGeneralParts,
  information_security: securityParts,
};

export function getCurriculum(examType: string): CurriculumPart[] {
  return CURRICULUMS[examType] || computerGeneralParts;
}

export function getDefaultCriteria(examType: string): { part: string; unit: string; topic: string } {
  const firstPart = getCurriculum(examType)[0];
  return {
    part: firstPart?.label || "",
    unit: "",
    topic: "",
  };
}
