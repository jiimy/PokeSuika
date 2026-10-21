export type SkillId =
  | 'blowAway'
  | 'shrink'
  | 'earthquake'
  | 'trick'
  | 'trickRoom'
  | 'mimic'
  | 'bind';

export type SkillDef = {
  id: SkillId;
  name: string;
  description: string;
  cost: number;
};

export const SKILL_PICK_COUNT = 4;

export const SKILLS: SkillDef[] = [
  {
    id: 'blowAway',
    name: '날려버리기',
    description: '현재 공을 원하는 다른 공으로 변경',
    cost: 10,
  },
  {
    id: 'shrink',
    name: '작아지기',
    description: '선택한 공을 그 이하 단계의 아무 공으로 변경',
    cost: 5,
  },
  {
    id: 'earthquake',
    name: '지진',
    description: '필드 공을 공중으로 띄워 다시 섞음',
    cost: 5,
  },
  {
    id: 'trick',
    name: '트릭',
    description: '선택한 공끼리 위치를 서로 바꿈',
    cost: 15,
  },
  {
    id: 'trickRoom',
    name: '트릭룸',
    description: '1~2단계 공이 나올 확률 증가 (10턴)',
    cost: 5,
  },
  {
    id: 'mimic',
    name: '흉내내기',
    description: '현재 공이 3턴 동안 계속 나옴',
    cost: 5,
  },
  {
    id: 'bind',
    name: '사슬묶기',
    description: '현재 공이 3턴 동안 나오지 않음',
    cost: 3,
  },
];

export function getSkill(id: SkillId): SkillDef {
  return SKILLS.find((s) => s.id === id)!;
}
