import { notImplemented, NotImplementedCode } from '../../src/commands/notImplemented';
import { CliError } from '../../src/output/errors';

describe('notImplemented', () => {
  it('throws CliError with code NOT_IMPLEMENTED, category generic, and the command path in details', () => {
    let err: unknown;
    try {
      notImplemented('ctx use');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    const c = err as CliError;
    expect(c.code).toBe(NotImplementedCode);
    expect(c.code).toBe('NOT_IMPLEMENTED');
    expect(c.category).toBe('generic');
    expect(c.message).toContain('ctx use');
    expect(c.details).toEqual({ command: 'ctx use' });
  });
});
