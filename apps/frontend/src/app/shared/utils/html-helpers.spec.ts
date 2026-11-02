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

  describe('projects without validProjects (fallback)', () => {
    it('highlights any @word', () => {
      const result = highlightInlineCommands('filing @work');
      expect(result).toMatch(/<span class="hl-project">@work<\/span>/);
    });

    it('highlights @word at end of input as pending', () => {
      const result = highlightInlineCommands('file into @');
      expect(result).toMatch(/<span class="hl-project">@<\/span>/);
    });

    it('does not highlight an address-style @ mid-word', () => {
      const result = highlightInlineCommands('email bob@example later');
      expect(result).not.toContain('hl-project');
    });
  });

  describe('projects with validProjects', () => {
    const projects = ['Work', 'Ideas'];

    it('highlights a known @project', () => {
      const result = highlightInlineCommands('file into @work', undefined, projects);
      expect(result).toMatch(/<span class="hl-project">@work<\/span>/);
    });

    it('matches project names case-insensitively', () => {
      const result = highlightInlineCommands('file into @Work', undefined, projects);
      expect(result).toMatch(/<span class="hl-project">@Work<\/span>/);
    });

    it('does not wrap an unknown @token as a project', () => {
      const result = highlightInlineCommands('file into @unknown', undefined, ['Work']);
      expect(result).not.toContain('hl-project');
    });

    it('highlights multiple known projects', () => {
      const result = highlightInlineCommands('@work @ideas filing', undefined, projects);
      expect(result.match(/hl-project/g)?.length).toBe(2);
    });

    it('highlights pending @prefix with a matching project', () => {
      const result = highlightInlineCommands('file into @w', undefined, projects);
      expect(result).toMatch(/<span class="hl-project">@w<\/span>/);
    });

    it('highlights bare @ at end as pending project', () => {
      const result = highlightInlineCommands('file into @', undefined, projects);
      expect(result).toMatch(/<span class="hl-project">@<\/span>/);
    });
  });

  describe('entity colors', () => {
    it('tints a resolved label chip with its own color', () => {
      const result = highlightInlineCommands('fix this #urgent', [
        { name: 'urgent', color: '#D44D3C' },
      ]);
      expect(result).toContain(
        '<span class="hl-label" style="--token-color:#d44d3c">#urgent</span>',
      );
    });

    it('tints a resolved project chip with its own color', () => {
      const result = highlightInlineCommands('file into @work', undefined, [
        { name: 'Work', color: '#2d7b75' },
      ]);
      expect(result).toContain(
        '<span class="hl-project" style="--token-color:#2d7b75">@work</span>',
      );
    });

    it('tints a pending prefix with the matched entity color', () => {
      const result = highlightInlineCommands('file into @w', undefined, [
        { name: 'Work', color: '#2d7b75' },
      ]);
      expect(result).toContain('<span class="hl-project" style="--token-color:#2d7b75">@w</span>');
    });

    it('never emits a non-hex color into the style attribute', () => {
      const result = highlightInlineCommands('file into @work', undefined, [
        { name: 'Work', color: 'red; background: url(evil)' },
      ]);
      expect(result).toContain('<span class="hl-project">@work</span>');
      expect(result).not.toContain('style=');
    });

    it('leaves tokens without a color unstyled', () => {
      const result = highlightInlineCommands('file into @work #urgent', ['urgent'], ['Work']);
      expect(result).toContain('<span class="hl-label">#urgent</span>');
      expect(result).toContain('<span class="hl-project">@work</span>');
      expect(result).not.toContain('style=');
    });
  });

  describe('unresolved tokens', () => {
    it('marks an unknown #label as unresolved', () => {
      const result = highlightInlineCommands('fix this #unknown', ['known']);
      expect(result).toMatch(/<span class="hl-unresolved">#unknown<\/span>/);
    });

    it('marks an unknown @project as unresolved', () => {
      const result = highlightInlineCommands('file into @unknown', undefined, ['Work']);
      expect(result).toMatch(/<span class="hl-unresolved">@unknown<\/span>/);
    });

    it('marks a non-whitelist !word as unresolved', () => {
      const result = highlightInlineCommands('call !admin now');
      expect(result).toMatch(/<span class="hl-unresolved">!admin<\/span>/);
      expect(result).not.toContain('hl-priority');
    });

    it('does not mark wrapped tokens twice', () => {
      const result = highlightInlineCommands('file into @work #urgent !h', ['urgent'], ['Work']);
      expect(result.match(/hl-unresolved/g)).toBeNull();
      expect(result.match(/hl-project/g)?.length).toBe(1);
      expect(result.match(/hl-label/g)?.length).toBe(1);
      expect(result.match(/hl-priority/g)?.length).toBe(1);
    });

    it('does not mark a bare sigil mid-sentence as unresolved', () => {
      const result = highlightInlineCommands('add ! and # tokens @ later');
      expect(result).not.toContain('hl-unresolved');
    });

    it('keeps a pending label with a prefix match out of the unresolved pass', () => {
      const result = highlightInlineCommands('work on #f', ['frontend']);
      expect(result).toMatch(/<span class="hl-label">#f<\/span>/);
      expect(result).not.toContain('hl-unresolved');
    });
  });
});
