import { HighlightPipe } from './highlight.pipe';

describe('HighlightPipe', () => {
  let pipe: HighlightPipe;

  beforeEach(() => {
    pipe = new HighlightPipe();
  });

  it('wraps the query in <mark> tags', () => {
    expect(pipe.transform('Hello world', 'world')).toBe('Hello <mark>world</mark>');
  });

  it('is case-insensitive', () => {
    expect(pipe.transform('Hello World', 'world')).toBe('Hello <mark>World</mark>');
  });

  it('escapes HTML in the input text', () => {
    expect(pipe.transform('<script>alert("xss")</script>', 'script')).toBe(
      '&lt;<mark>script</mark>&gt;alert(&quot;xss&quot;)&lt;/<mark>script</mark>&gt;',
    );
  });

  it('escapes HTML but still highlights the match', () => {
    expect(pipe.transform('<img src=x onerror=alert(1)>', 'img')).toBe(
      '&lt;<mark>img</mark> src=x onerror=alert(1)&gt;',
    );
  });

  it('handles special regex characters in the query', () => {
    expect(pipe.transform('Find (me) please', '(me)')).toBe('Find <mark>(me)</mark> please');
  });

  it('returns the input as-is when query is empty', () => {
    expect(pipe.transform('hello', '')).toBe('hello');
  });

  it('returns the input as-is when query is whitespace', () => {
    expect(pipe.transform('hello', '   ')).toBe('hello');
  });

  it('returns the input as-is when text is empty', () => {
    expect(pipe.transform('', 'test')).toBe('');
  });

  it('escapes ampersands before adding mark tags', () => {
    expect(pipe.transform('Rock & roll', 'roll')).toBe('Rock &amp; <mark>roll</mark>');
  });

  it('escapes quotes in the input', () => {
    expect(pipe.transform('say "hello" world', 'hello')).toBe(
      'say &quot;<mark>hello</mark>&quot; world',
    );
  });

  it('does not split HTML entities when query matches an entity char', () => {
    expect(pipe.transform('R&D', '&')).toBe('R<mark>&amp;</mark>D');
    expect(pipe.transform('A < B', '<')).toBe('A <mark>&lt;</mark> B');
    expect(pipe.transform('x > y', '>')).toBe('x <mark>&gt;</mark> y');
  });
});
