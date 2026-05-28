import { downloadCsv, downloadJson, CsvColumn } from './export';

describe('downloadCsv', () => {
  let anchor: { href: string; download: string; click: jasmine.Spy };
  let createObjectURLSpy: jasmine.Spy;
  let revokeObjectURLSpy: jasmine.Spy;
  let createElementSpy: jasmine.Spy;

  interface TestRow {
    name: string;
    age: number;
    role?: string;
  }

  beforeEach(() => {
    anchor = { href: '', download: '', click: jasmine.createSpy('click') };
    createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    revokeObjectURLSpy = spyOn(URL, 'revokeObjectURL').and.returnValue();
    createElementSpy = spyOn(document, 'createElement').and.returnValue(
      anchor as unknown as HTMLElement,
    );
  });

  function lastBlobArg(): Blob {
    const blob = createObjectURLSpy.calls.mostRecent().args[0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    return blob;
  }

  async function lastCsvContent(): Promise<string> {
    const blob = lastBlobArg();
    return await blob.text();
  }

  it('creates an anchor element and triggers a download', () => {
    const data: TestRow[] = [{ name: 'Alice', age: 30 }];
    const columns: CsvColumn<TestRow>[] = [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' },
    ];

    downloadCsv(data, columns, 'test.csv');

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(anchor.download).toBe('test.csv');
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test');
  });

  it('writes a header row followed by data rows', async () => {
    const data: TestRow[] = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const columns: CsvColumn<TestRow>[] = [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' },
    ];

    downloadCsv(data, columns, 'test.csv');
    const content = await lastCsvContent();

    const lines = content.trim().split('\n');
    expect(lines[0]).toBe('Name,Age');
    expect(lines[1]).toBe('Alice,30');
    expect(lines[2]).toBe('Bob,25');
  });

  it('includes a UTF-8 BOM at the start of the byte stream', async () => {
    const data: TestRow[] = [{ name: 'Alice', age: 30 }];
    const columns: CsvColumn<TestRow>[] = [{ key: 'name', label: 'Name' }];

    downloadCsv(data, columns, 'test.csv');
    const blob = lastBlobArg();
    const bytes = new Uint8Array(await blob.arrayBuffer());

    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);
  });

  it('escapes values containing commas', async () => {
    const data: TestRow[] = [{ name: 'Alice, Bob & Co.', age: 30 }];
    const columns: CsvColumn<TestRow>[] = [{ key: 'name', label: 'Name' }];

    downloadCsv(data, columns, 'test.csv');
    const content = await lastCsvContent();

    expect(content).toContain('"Alice, Bob & Co."');
  });

  it('escapes values containing double quotes', async () => {
    const data: TestRow[] = [{ name: 'Alice "The Great"', age: 30 }];
    const columns: CsvColumn<TestRow>[] = [{ key: 'name', label: 'Name' }];

    downloadCsv(data, columns, 'test.csv');
    const content = await lastCsvContent();

    expect(content).toContain('"Alice ""The Great"""');
  });

  it('escapes values containing newlines', async () => {
    const data: TestRow[] = [{ name: 'Alice\nBob', age: 30 }];
    const columns: CsvColumn<TestRow>[] = [{ key: 'name', label: 'Name' }];

    downloadCsv(data, columns, 'test.csv');
    const content = await lastCsvContent();

    expect(content).toContain('"Alice\nBob"');
  });

  it('uses the format function when provided', async () => {
    const data: TestRow[] = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const columns: CsvColumn<TestRow>[] = [
      { key: 'name', label: 'Name' },
      {
        key: 'age',
        label: 'Age Group',
        format: (row) => (row.age >= 30 ? '30+' : '<30'),
      },
    ];

    downloadCsv(data, columns, 'test.csv');
    const content = await lastCsvContent();

    const lines = content.trim().split('\n');
    expect(lines[0]).toBe('Name,Age Group');
    expect(lines[1]).toBe('Alice,30+');
    expect(lines[2]).toBe('Bob,<30');
  });

  it('handles null and undefined values as empty strings', async () => {
    const data: TestRow[] = [{ name: 'Alice', age: 0, role: undefined }];
    (data[0] as any).nonexistent = undefined;
    const columns: CsvColumn<TestRow>[] = [
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role' },
    ];

    downloadCsv(data, columns, 'test.csv');
    const content = await lastCsvContent();

    expect(content).toContain('Alice,');
  });

  it('handles an empty data array', async () => {
    const data: TestRow[] = [];
    const columns: CsvColumn<TestRow>[] = [{ key: 'name', label: 'Name' }];

    downloadCsv(data, columns, 'test.csv');
    const content = await lastCsvContent();

    expect(content).toContain('Name');
    const lines = content.trim().split('\n');
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('Name');
  });
});

describe('downloadJson', () => {
  let anchor: { href: string; download: string; click: jasmine.Spy };
  let createObjectURLSpy: jasmine.Spy;
  let revokeObjectURLSpy: jasmine.Spy;
  let createElementSpy: jasmine.Spy;

  beforeEach(() => {
    anchor = { href: '', download: '', click: jasmine.createSpy('click') };
    createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:json');
    revokeObjectURLSpy = spyOn(URL, 'revokeObjectURL').and.returnValue();
    createElementSpy = spyOn(document, 'createElement').and.returnValue(
      anchor as unknown as HTMLElement,
    );
  });

  function lastBlob(): Blob {
    const blob = createObjectURLSpy.calls.mostRecent().args[0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    return blob;
  }

  async function lastJsonContent(): Promise<string> {
    return await lastBlob().text();
  }

  it('creates an anchor and triggers a download', () => {
    downloadJson([{ name: 'Alice' }], 'test.json');

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(anchor.download).toBe('test.json');
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:json');
  });

  it('serialises data as pretty-printed JSON', async () => {
    const data = [{ name: 'Alice', age: 30 }];

    downloadJson(data, 'test.json');
    const content = await lastJsonContent();

    expect(content).toBe('[\n  {\n    "name": "Alice",\n    "age": 30\n  }\n]');
  });

  it('preserves nested objects and arrays', async () => {
    const data = [{ name: 'Alice', tags: ['urgent', 'design'], meta: { role: 'dev' } }];

    downloadJson(data, 'test.json');
    const content = await lastJsonContent();

    expect(content).toContain('"tags"');
    expect(content).toContain('"urgent"');
    expect(content).toContain('"role"');
    expect(content).toContain('"dev"');
  });

  it('handles an empty array', async () => {
    downloadJson([], 'empty.json');
    const content = await lastJsonContent();

    expect(content).toBe('[]');
  });

  it('handles null and undefined values', async () => {
    const data = [{ name: 'Alice', role: null, description: undefined }];

    downloadJson(data, 'test.json');
    const content = await lastJsonContent();

    expect(content).toContain('"role": null');
    expect(content).not.toContain('"description"');
  });
});
