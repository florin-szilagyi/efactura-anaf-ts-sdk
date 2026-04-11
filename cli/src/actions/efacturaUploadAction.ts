import { z } from 'zod';
import { CliError } from '../output/errors';
import { normalizeOutput, normalizeUblBuildAction, ublBuildInputSchema } from './ublBuildAction';
import type { EfacturaUploadAction } from './types';

const standardSchema = z.enum(['UBL', 'CN', 'CII', 'RASP']);

const sourceSchema = z
  .object({
    xmlFile: z.string().min(1).optional(),
    xmlStdin: z.boolean().optional(),
    ublBuild: ublBuildInputSchema.optional(),
  })
  .strict();

const uploadSchema = z
  .object({
    standard: standardSchema.optional(),
    isB2C: z.boolean().optional(),
    isExecutare: z.boolean().optional(),
  })
  .strict();

export const efacturaUploadInputSchema = z
  .object({
    context: z.string().min(1),
    source: sourceSchema,
    upload: uploadSchema,
    output: z
      .object({
        mode: z.enum(['stdout', 'file']).optional(),
        path: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type EfacturaUploadInput = z.infer<typeof efacturaUploadInputSchema>;

export function normalizeEfacturaUploadAction(input: EfacturaUploadInput): EfacturaUploadAction {
  const parsed = efacturaUploadInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new CliError({
      code: 'INVALID_UPLOAD_INPUT',
      message: `efactura upload input failed validation: ${parsed.error.message}`,
      category: 'user_input',
      details: { issues: parsed.error.issues },
    });
  }
  const data = parsed.data;
  const branches = [
    data.source.xmlFile ? 'xmlFile' : null,
    data.source.xmlStdin ? 'xmlStdin' : null,
    data.source.ublBuild ? 'ublBuild' : null,
  ].filter(Boolean);
  if (branches.length !== 1) {
    throw new CliError({
      code: 'INVALID_UPLOAD_INPUT',
      message: `source must have exactly one of xmlFile/xmlStdin/ublBuild (got ${branches.length})`,
      category: 'user_input',
      details: { branches },
    });
  }

  let source: EfacturaUploadAction['source'];
  if (data.source.xmlFile) {
    source = { type: 'xmlFile', path: data.source.xmlFile };
  } else if (data.source.xmlStdin) {
    source = { type: 'xmlStdin' };
  } else {
    source = { type: 'ublBuild', build: normalizeUblBuildAction(data.source.ublBuild!) };
  }

  return {
    kind: 'efactura.upload',
    context: data.context,
    source,
    upload: {
      standard: data.upload.standard ?? 'UBL',
      isB2C: data.upload.isB2C,
      isExecutare: data.upload.isExecutare,
    },
    output: normalizeOutput(data.output),
  };
}
