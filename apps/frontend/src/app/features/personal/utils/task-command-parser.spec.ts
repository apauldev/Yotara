import { parseTaskCommand } from './task-command-parser';

describe('parseTaskCommand', () => {
  it('parses priority shorthand and strips it from the title', () => {
    const result = parseTaskCommand('Water the plants !h');
    expect(result.title).toBe('Water the plants');
    expect(result.priority).toBe('high');
  });

  describe('without known label names (legacy behavior)', () => {
    it('extracts and strips every #tag', () => {
      const result = parseTaskCommand('Call the bank #errand #money');
      expect(result.title).toBe('Call the bank');
      expect(result.labelNames).toEqual(['errand', 'money']);
    });
  });

  describe('with known label names', () => {
    const known = ['Errand', 'Writing', 'Idea'];

    it('strips only tags that resolve to existing labels', () => {
      const result = parseTaskCommand('Call the bank #errand', { knownLabelNames: known });
      expect(result.title).toBe('Call the bank');
      expect(result.labelNames).toEqual(['errand']);
      expect(result.unresolvedLabelNames).toEqual([]);
    });

    it('keeps unknown tags in the title and reports them', () => {
      const result = parseTaskCommand('Describe the #prototype flow', { knownLabelNames: known });
      expect(result.title).toBe('Describe the #prototype flow');
      expect(result.labelNames).toEqual([]);
      expect(result.unresolvedLabelNames).toEqual(['prototype']);
    });

    it('resolves case-insensitively and keeps the typed tag untouched otherwise', () => {
      const result = parseTaskCommand('Draft essay #WRITING #vague', { knownLabelNames: known });
      expect(result.title).toBe('Draft essay #vague');
      expect(result.labelNames).toEqual(['WRITING']);
      expect(result.unresolvedLabelNames).toEqual(['vague']);
    });

    it('de-duplicates resolved and unresolved names', () => {
      const result = parseTaskCommand('Mix #errand and #errand and #oops and #oops again', {
        knownLabelNames: known,
      });
      expect(result.labelNames).toEqual(['errand']);
      expect(result.unresolvedLabelNames).toEqual(['oops']);
    });
  });
});
