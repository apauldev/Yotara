import { parseTaskCommand } from './task-command-parser';

describe('parseTaskCommand', () => {
  it('parses priority shorthand and strips it from the title', () => {
    const result = parseTaskCommand('Water the plants !h');
    expect(result.title).toBe('Water the plants');
    expect(result.priority).toBe('high');
  });

  it('leaves a priority token that continues with a non-ASCII letter alone', () => {
    const result = parseTaskCommand('Water the plants !highé');
    expect(result.title).toBe('Water the plants !highé');
    expect(result.priority).toBeUndefined();
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

    it('strips the resolved tag rather than an unresolved tag sharing its prefix', () => {
      const result = parseTaskCommand('Do #homework and #home', { knownLabelNames: ['home'] });
      expect(result.title).toBe('Do #homework and');
      expect(result.labelNames).toEqual(['home']);
      expect(result.unresolvedLabelNames).toEqual(['homework']);
    });

    it('never resolves a shorter label when the word continues with a letter', () => {
      const result = parseTaskCommand('Do #Café things', { knownLabelNames: ['caf'] });
      expect(result.title).toBe('Do #Café things');
      expect(result.labelNames).toEqual([]);
      expect(result.unresolvedLabelNames).toEqual([]);
    });
  });

  describe('with known project names', () => {
    const projects = ['Admin', 'Ideas', 'work-project'];

    it('resolves case-insensitively and strips the token from the title', () => {
      const result = parseTaskCommand('go to meeting @admin', { knownProjectNames: projects });
      expect(result.title).toBe('go to meeting');
      expect(result.projectName).toBe('admin');
      expect(result.unappliedProjectNames).toEqual([]);
      expect(result.unresolvedProjectNames).toEqual([]);
    });

    it('keeps the typed casing of the resolved token in the result', () => {
      const result = parseTaskCommand('go to meeting @ADMIN', { knownProjectNames: projects });
      expect(result.projectName).toBe('ADMIN');
    });

    it('leaves an unresolved @token in the title and reports it', () => {
      const result = parseTaskCommand('Say hi to @nobody', { knownProjectNames: projects });
      expect(result.title).toBe('Say hi to @nobody');
      expect(result.projectName).toBeUndefined();
      expect(result.unresolvedProjectNames).toEqual(['nobody']);
    });

    it('applies the first resolved token and strips every resolved one', () => {
      const result = parseTaskCommand('Check @ideas and @admin', { knownProjectNames: projects });
      expect(result.title).toBe('Check and');
      expect(result.projectName).toBe('ideas');
      expect(result.unappliedProjectNames).toEqual(['admin']);
    });

    it('de-duplicates unapplied resolved project names', () => {
      const result = parseTaskCommand('Check @ideas and @ideas', { knownProjectNames: projects });
      expect(result.projectName).toBe('ideas');
      expect(result.unappliedProjectNames).toEqual(['ideas']);
    });

    it('keeps unresolved tokens next to resolved ones and reports both kinds', () => {
      const result = parseTaskCommand('Check @admin and @missing', { knownProjectNames: projects });
      expect(result.title).toBe('Check and @missing');
      expect(result.projectName).toBe('admin');
      expect(result.unresolvedProjectNames).toEqual(['missing']);
    });

    it('does not match mid-word or after punctuation-preceded tokens', () => {
      const result = parseTaskCommand('email bob@bar and weird"@admin later', {
        knownProjectNames: projects,
      });
      expect(result.title).toBe('email bob@bar and weird"@admin later');
      expect(result.projectName).toBeUndefined();
    });

    it('never resolves a shorter project when the word continues with a letter', () => {
      const result = parseTaskCommand('Say hi to @Café', { knownProjectNames: ['Caf'] });
      expect(result.title).toBe('Say hi to @Café');
      expect(result.projectName).toBeUndefined();
      expect(result.unresolvedProjectNames).toEqual([]);
    });

    it('matches hyphenated project names', () => {
      const result = parseTaskCommand('Plan the sprint @work-project', {
        knownProjectNames: projects,
      });
      expect(result.title).toBe('Plan the sprint');
      expect(result.projectName).toBe('work-project');
    });

    it('de-duplicates unresolved project names', () => {
      const result = parseTaskCommand('Check @oops and @oops', { knownProjectNames: projects });
      expect(result.unresolvedProjectNames).toEqual(['oops']);
      expect(result.title).toBe('Check @oops and @oops');
    });

    it('strips the resolved project rather than an unresolved project sharing its prefix', () => {
      const result = parseTaskCommand('Do @homework and @home', { knownProjectNames: ['home'] });
      expect(result.title).toBe('Do @homework and');
      expect(result.projectName).toBe('home');
      expect(result.unresolvedProjectNames).toEqual(['homework']);
    });
  });

  describe('without known project names (legacy behavior)', () => {
    it('never extracts or strips @tokens but reports them as unresolved', () => {
      const result = parseTaskCommand('Check @admin');
      expect(result.title).toBe('Check @admin');
      expect(result.projectName).toBeUndefined();
      expect(result.unresolvedProjectNames).toEqual(['admin']);
    });
  });

  describe('combined commands', () => {
    const knownLabels = ['call'];
    const knownProjects = ['Admin'];

    it('parses priority, label, and project together in one order', () => {
      const result = parseTaskCommand('go to meeting tomorrow at 9am !high #call @admin', {
        knownLabelNames: knownLabels,
        knownProjectNames: knownProjects,
      });
      expect(result.title).toBe('go to meeting tomorrow at 9am');
      expect(result.priority).toBe('high');
      expect(result.labelNames).toEqual(['call']);
      expect(result.projectName).toBe('admin');
      expect(result.unresolvedLabelNames).toEqual([]);
      expect(result.unresolvedProjectNames).toEqual([]);
    });

    it('parses priority, label, and project together in the other order', () => {
      const result = parseTaskCommand('go to meeting @admin #call !high', {
        knownLabelNames: knownLabels,
        knownProjectNames: knownProjects,
      });
      expect(result.title).toBe('go to meeting');
      expect(result.priority).toBe('high');
      expect(result.labelNames).toEqual(['call']);
      expect(result.projectName).toBe('admin');
    });

    it('leaves a project sigil holding an unknown word untouched', () => {
      const result = parseTaskCommand('go to meeting tomorrow at 9am !admin', {
        knownLabelNames: knownLabels,
        knownProjectNames: knownProjects,
      });
      expect(result.title).toBe('go to meeting tomorrow at 9am !admin');
      expect(result.priority).toBeUndefined();
      expect(result.projectName).toBeUndefined();
    });
  });
});
