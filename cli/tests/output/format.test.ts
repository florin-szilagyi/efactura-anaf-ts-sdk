import { kv, table } from '../../src/output/format';

describe('kv', () => {
  it('aligns key-value pairs', () => {
    const result = kv([
      ['Name', 'Acme SRL'],
      ['CUI', 'RO12345678'],
    ]);
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('Name  Acme SRL');
    expect(lines[1]).toBe('CUI   RO12345678');
  });

  it('skips undefined and null values', () => {
    const result = kv([
      ['Name', 'Acme'],
      ['Phone', undefined],
      ['City', null],
      ['CUI', 'RO123'],
    ]);
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Acme');
    expect(lines[1]).toContain('RO123');
  });

  it('returns empty string when all values are undefined', () => {
    expect(kv([['A', undefined]])).toBe('');
  });
});

describe('table', () => {
  it('renders header, separator, and data rows', () => {
    const result = table(
      [
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'Name' },
      ],
      [
        { id: '1', name: 'Alpha' },
        { id: '2', name: 'Beta' },
      ]
    );
    const lines = result.split('\n');
    expect(lines).toHaveLength(4); // header + separator + 2 rows
    expect(lines[0]).toContain('ID');
    expect(lines[0]).toContain('Name');
    expect(lines[1]).toMatch(/^─+───+$/);
    expect(lines[2]).toContain('Alpha');
    expect(lines[3]).toContain('Beta');
  });

  it('returns "(none)" for empty rows', () => {
    expect(table([{ key: 'id', header: 'ID' }], [])).toBe('(none)');
  });

  it('pads columns to the widest value', () => {
    const result = table([{ key: 'x', header: 'X' }], [{ x: 'short' }, { x: 'much longer value' }]);
    const lines = result.split('\n');
    // Header should be padded to match the longest value
    expect(lines[0].length).toBe(lines[2].length);
  });
});
