import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { CliError } from '../output/errors';
import { cliConfigSchema } from './schemas';
import type { CliConfig, Environment } from './types';
import { getXdgPaths, type XdgPaths } from './paths';

export class ConfigStore {
  private readonly paths: XdgPaths;

  constructor(opts?: { paths?: XdgPaths }) {
    this.paths = opts?.paths ?? getXdgPaths();
  }

  read(): CliConfig {
    if (!fs.existsSync(this.paths.configFile)) {
      return {};
    }
    const raw = fs.readFileSync(this.paths.configFile, 'utf8');
    let parsed: unknown;
    try {
      parsed = parseYaml(raw) ?? {};
    } catch (cause) {
      throw new CliError({
        code: 'INVALID_CONFIG_FILE',
        message: `Failed to parse config.yaml: ${(cause as Error).message}`,
        category: 'local_state',
        details: { path: this.paths.configFile },
      });
    }
    const result = cliConfigSchema.safeParse(parsed);
    if (!result.success) {
      throw new CliError({
        code: 'INVALID_CONFIG_FILE',
        message: `config.yaml failed validation: ${result.error.message}`,
        category: 'local_state',
        details: { path: this.paths.configFile, issues: result.error.issues },
      });
    }
    return result.data;
  }

  write(config: CliConfig): void {
    fs.mkdirSync(path.dirname(this.paths.configFile), { recursive: true });
    const validated = cliConfigSchema.parse(config);
    fs.writeFileSync(this.paths.configFile, stringifyYaml(validated), 'utf8');
  }

  getActiveCui(): string | undefined {
    return this.read().activeCui;
  }

  setActiveCui(cui: string | undefined): void {
    const current = this.read();
    if (cui === undefined) {
      const { activeCui: _drop, ...rest } = current;
      this.write(rest);
      return;
    }
    this.write({ ...current, activeCui: cui });
  }

  getEnv(): Environment {
    return this.read().env ?? 'test';
  }

  setEnv(env: Environment): void {
    const current = this.read();
    this.write({ ...current, env });
  }
}
