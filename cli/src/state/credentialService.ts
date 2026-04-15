import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { CliError } from '../output/errors';
import { credentialFileSchema } from './schemas';
import type { Credential } from './types';
import { getXdgPaths, type XdgPaths } from './paths';

export class CredentialService {
  private readonly paths: XdgPaths;

  constructor(opts?: { paths?: XdgPaths }) {
    this.paths = opts?.paths ?? getXdgPaths();
  }

  exists(): boolean {
    return fs.existsSync(this.paths.credentialFile);
  }

  get(): Credential {
    const filePath = this.paths.credentialFile;
    if (!fs.existsSync(filePath)) {
      throw new CliError({
        code: 'CREDENTIAL_NOT_FOUND',
        message: 'No credential configured. Run `anaf-cli cred set` first.',
        category: 'local_state',
        details: { path: filePath },
      });
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = parseYaml(raw) ?? {};
    } catch (cause) {
      throw new CliError({
        code: 'INVALID_CREDENTIAL_FILE',
        message: `Failed to parse credential file: ${(cause as Error).message}`,
        category: 'local_state',
        details: { path: filePath },
      });
    }
    const result = credentialFileSchema.safeParse(parsed);
    if (!result.success) {
      throw new CliError({
        code: 'INVALID_CREDENTIAL_FILE',
        message: `Credential file failed validation: ${result.error.message}`,
        category: 'local_state',
        details: { path: filePath, issues: result.error.issues },
      });
    }
    return result.data;
  }

  set(cred: Credential): void {
    fs.mkdirSync(path.dirname(this.paths.credentialFile), { recursive: true });
    const validated = credentialFileSchema.parse(cred);
    fs.writeFileSync(this.paths.credentialFile, stringifyYaml(validated), 'utf8');
  }

  clear(): void {
    const filePath = this.paths.credentialFile;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
