export type DueDateDraftSource = 'none' | 'inferred' | 'manual' | 'cleared';

export interface DueDateDraft {
  value: string;
  source: DueDateDraftSource;
  matchedText: string | null;
  matchStart: number | null;
  matchEnd: number | null;
}

export function createEmptyDueDateDraft(): DueDateDraft {
  return {
    value: '',
    source: 'none',
    matchedText: null,
    matchStart: null,
    matchEnd: null,
  };
}

export function createClearedDueDateDraft(draft: DueDateDraft): DueDateDraft {
  return {
    ...draft,
    value: '',
    source: 'cleared',
  };
}
