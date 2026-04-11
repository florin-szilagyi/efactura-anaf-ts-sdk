import { buildProgram } from '../../../src/commands/buildProgram';
import { makeOutputContext } from '../../../src/output';

describe('efactura group', () => {
  it('registers all eight document operations', () => {
    const program = buildProgram({ output: makeOutputContext({ format: 'text' }), services: {} });
    const ef = program.commands.find((c) => c.name() === 'efactura')!;
    expect(ef.commands.map((c) => c.name()).sort()).toEqual([
      'download',
      'messages',
      'pdf',
      'status',
      'upload',
      'upload-b2c',
      'validate',
      'validate-signature',
    ]);
  });
});
