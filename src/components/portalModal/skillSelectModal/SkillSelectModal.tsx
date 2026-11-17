'use client';

import {
  SKILL_PICK_COUNT,
  SKILLS,
  type SkillId,
} from '@/constants/skills';
import BasicModal from '@/components/portalModal/basicModal/BasicModal';

import shared from '../modal.module.scss';
import s from './skillSelectModal.module.scss';

type SkillSelectModalProps = {
  open: boolean;
  pickedSkills: SkillId[];
  onToggle: (id: SkillId) => void;
  onCancel: () => void;
  onStart: () => void;
};

export default function SkillSelectModal({
  open,
  pickedSkills,
  onToggle,
  onCancel,
  onStart,
}: SkillSelectModalProps) {
  if (!open) return null;

  return (
    <BasicModal
      setOnModal={(next) => {
        const shouldOpen = typeof next === 'function' ? next(true) : next;
        if (!shouldOpen) onCancel();
      }}
      dimClick={false}
      className={`${shared.panel} ${shared.panelMedium}`}
    >
      <h2 className={shared.title}>
        기술 선택 최대 4개 ({pickedSkills.length}/{SKILL_PICK_COUNT})
      </h2>
      <ul className={s.list}>
        {SKILLS.map((skill) => {
          const on = pickedSkills.includes(skill.id);
          const full = !on && pickedSkills.length >= SKILL_PICK_COUNT;
          return (
            <li key={skill.id}>
              <button
                type="button"
                disabled={full}
                onClick={() => onToggle(skill.id)}
                className={`${s.itemBtn} ${on ? s.itemBtnOn : ''}`}
              >
                <div className={s.itemHead}>
                  <span className={s.itemName}>{skill.name}</span>
                  <span className={s.itemCost}>PP {skill.cost}</span>
                </div>
                <p className={s.itemDesc}>{skill.description}</p>
              </button>
            </li>
          );
        })}
      </ul>
      <div className={`${shared.actions} ${s.actions}`}>
        <button
          type="button"
          className={`${shared.btnSecondary} ${shared.btnGrow}`}
          onClick={onCancel}
        >
          취소
        </button>
        <button
          type="button"
          className={`${shared.btnPrimary} ${shared.btnGrow}`}
          onClick={onStart}
        >
          시작
        </button>
      </div>
    </BasicModal>
  );
}
