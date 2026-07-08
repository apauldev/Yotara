import { escapeHtml, highlightInlineCommands } from './html-helpers';

describe('escapeHtml', () => {
  it('escapes & < > " \'', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#039;');
  });

  it('passes through plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('highlightInlineCommands', () => {
  it('escapes HTML special chars before highlighting', () => {
    const result = highlightInlineCommands('!h <script>alert(1)</script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('hl-priority');
  });

  describe('priorities', () => {
    it('highlights !h at start', () => {
      const result = highlightInlineCommands('!h meeting');
      expect(result).toMatch(/<span class="hl-priority">!h<\/span>/);
    });

    it('highlights !high', () => {
      const result = highlightInlineCommands('do this !high');
      expect(result).toMatch(/<span class="hl-priority">!high<\/span>/);
    });

    it('highlights !m', () => {
      const result = highlightInlineCommands('!m task');
      expect(result).toMatch(/<span class="hl-priority">!m<\/span>/);
    });

    it('highlights !medium', () => {
      const result = highlightInlineCommands('!medium task');
      expect(result).toMatch(/<span class="hl-priority">!medium<\/span>/);
    });

    it('highlights !l', () => {
      const result = highlightInlineCommands('!l task');
      expect(result).toMatch(/<span class="hl-priority">!l<\/span>/);
    });

    it('highlights !low', () => {
      const result = highlightInlineCommands('!low task');
      expect(result).toMatch(/<span class="hl-priority">!low<\/span>/);
    });

    it('only highlights the first priority', () => {
      const result = highlightInlineCommands('!h !m task');
      const matches = result.match(/hl-priority/g);
      expect(matches?.length).toBe(1);
    });

    it('does not highlight unknown !word as priority', () => {
      const result = highlightInlineCommands('!unknown task');
      expect(result).not.toContain('hl-priority');
    });

    it('highlights ! alone at end as pending priority', () => {
      const result = highlightInlineCommands('do something !');
      expect(result).toMatch(/<span class="hl-priority">!<\/span>/);
    });

    it('does not highlight ! alone mid-sentence', () => {
      const result = highlightInlineCommands('! in the middle');
      expect(result).not.toContain('hl-priority');
    });
  });

  describe('labels without validLabels (fallback)', () => {
    it('highlights any #word', () => {
      const result = highlightInlineCommands('meeting #design');
      expect(result).toMatch(/<span class="hl-label">#design<\/span>/);
    });

    it('highlights multiple #words', () => {
      const result = highlightInlineCommands('#urgent #design task');
      const matches = result.match(/hl-label/g);
      expect(matches?.length).toBe(2);
    });

    it('highlights #word at end of input as pending', () => {
      const result = highlightInlineCommands('tag #');
      expect(result).toMatch(/<span class="hl-label">#<\/span>/);
    });

    it('highlights #prefix at end as pending', () => {
      const result = highlightInlineCommands('tag #de');
      expect(result).toMatch(/<span class="hl-label">#de<\/span>/);
    });
  });

  describe('labels with validLabels', () => {
    const labels = ['urgent', 'design', 'frontend'];

    it('highlights a known #label', () => {
      const result = highlightInlineCommands('fix this #urgent', labels);
      expect(result).toMatch(/<span class="hl-label">#urgent<\/span>/);
    });

    it('does not highlight an unknown #label', () => {
      const result = highlightInlineCommands('fix this #unknown', labels);
      expect(result).not.toContain('hl-label');
    });

    it('highlights multiple known labels', () => {
      const result = highlightInlineCommands('#urgent #design task', labels);
      const matches = result.match(/hl-label/g);
      expect(matches?.length).toBe(2);
    });

    it('does not highlight unknown label mixed with known ones', () => {
      const result = highlightInlineCommands('#urgent #bogus task', labels);
      const matches = result.match(/hl-label/g);
      expect(matches?.length).toBe(1);
    });

    it('highlights pending label with matching prefix', () => {
      const result = highlightInlineCommands('work on #f', labels);
      expect(result).toMatch(/<span class="hl-label">#f<\/span>/);
    });

    it('does not highlight pending label with non-matching prefix', () => {
      const result = highlightInlineCommands('work on #z', labels);
      expect(result).not.toContain('hl-label');
    });

    it('highlights bare # at end as pending label', () => {
      const result = highlightInlineCommands('add tag #', labels);
      expect(result).toMatch(/<span class="hl-label">#<\/span>/);
    });

    it('matches labels case-insensitively', () => {
      const result = highlightInlineCommands('#Urgent task', labels);
      expect(result).toMatch(/<span class="hl-label">#Urgent<\/span>/);
    });
  });

  describe('combined priorities and labels', () => {
    it('highlights both priority and label', () => {
      const result = highlightInlineCommands('!h fix this #urgent', ['urgent']);
      expect(result).toContain('hl-priority');
      expect(result).toContain('hl-label');
    });

    it('only one priority highlighted even with labels present', () => {
      const result = highlightInlineCommands('!h !m #urgent', ['urgent']);
      const priorityMatches = result.match(/hl-priority/g);
      expect(priorityMatches?.length).toBe(1);
    });
  });
});
