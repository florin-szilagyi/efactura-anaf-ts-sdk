import fs from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { CliError } from '../output/errors';
import { companyFileSchema } from './schemas';
import type { Company } from './types';
import { getXdgPaths, type XdgPaths } from './paths';

export class CompanyService {
  private readonly paths: XdgPaths;

  constructor(opts?: { paths?: XdgPaths }) {
    this.paths = opts?.paths ?? getXdgPaths();
  }

  list(): Company[] {
    if (!fs.existsSync(this.paths.companiesDir)) return [];
    const entries = fs
      .readdirSync(this.paths.companiesDir)
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => f.slice(0, -'.yaml'.length))
      .sort();
    const results: Company[] = [];
    for (const cui of entries) {
      try {
        results.push(this.get(cui));
      } catch {
        // Skip unparseable company files
      }
    }
    return results;
  }

  exists(cui: string): boolean {
    return fs.existsSync(this.paths.companyFile(cui));
  }

  get(cui: string): Company {
    const filePath = this.paths.companyFile(cui);
    if (!fs.existsSync(filePath)) {
      throw new CliError({
        code: 'COMPANY_NOT_FOUND',
        message: `Company "${cui}" is not registered. Run \`anaf-cli auth login ${cui}\` first.`,
        category: 'local_state',
        details: { cui, path: filePath },
      });
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = parseYaml(raw) ?? {};
    } catch (cause) {
      throw new CliError({
        code: 'INVALID_COMPANY_FILE',
        message: `Failed to parse company file for "${cui}": ${(cause as Error).message}`,
        category: 'local_state',
        details: { cui, path: filePath },
      });
    }
    const result = companyFileSchema.safeParse(parsed);
    if (!result.success) {
      throw new CliError({
        code: 'INVALID_COMPANY_FILE',
        message: `Company file for "${cui}" failed validation: ${result.error.message}`,
        category: 'local_state',
        details: { cui, path: filePath, issues: result.error.issues },
      });
    }
    return result.data;
  }

  add(company: Company): Company {
    this.writeFile(company);
    return company;
  }

  remove(cui: string): void {
    const filePath = this.paths.companyFile(cui);
    if (!fs.existsSync(filePath)) {
      throw new CliError({
        code: 'COMPANY_NOT_FOUND',
        message: `Company "${cui}" is not registered`,
        category: 'local_state',
        details: { cui },
      });
    }
    fs.unlinkSync(filePath);
  }

  private writeFile(company: Company): void {
    fs.mkdirSync(this.paths.companiesDir, { recursive: true });
    const validated = companyFileSchema.parse(company);
    fs.writeFileSync(this.paths.companyFile(company.cui), stringifyYaml(validated), 'utf8');
  }
}
