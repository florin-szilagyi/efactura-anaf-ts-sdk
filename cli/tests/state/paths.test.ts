import os from 'node:os';
import path from 'node:path';
import { defaultXdgPaths, getXdgPaths } from '../../src/state/paths';

describe('defaultXdgPaths', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('honors XDG_CONFIG_HOME / XDG_DATA_HOME / XDG_CACHE_HOME when set', () => {
    process.env.XDG_CONFIG_HOME = '/tmp/cfg';
    process.env.XDG_DATA_HOME = '/tmp/data';
    process.env.XDG_CACHE_HOME = '/tmp/cache';
    const p = defaultXdgPaths();
    expect(p.configHome).toBe('/tmp/cfg');
    expect(p.dataHome).toBe('/tmp/data');
    expect(p.cacheHome).toBe('/tmp/cache');
  });

  it('falls back to ~/.config, ~/.local/share, ~/.cache when env vars unset', () => {
    delete process.env.XDG_CONFIG_HOME;
    delete process.env.XDG_DATA_HOME;
    delete process.env.XDG_CACHE_HOME;
    const home = os.homedir();
    const p = defaultXdgPaths();
    expect(p.configHome).toBe(path.join(home, '.config'));
    expect(p.dataHome).toBe(path.join(home, '.local', 'share'));
    expect(p.cacheHome).toBe(path.join(home, '.cache'));
  });
});

describe('getXdgPaths', () => {
  it('joins anaf-cli onto each XDG root and exposes per-resource subpaths', () => {
    const p = getXdgPaths({ configHome: '/c', dataHome: '/d', cacheHome: '/x' });
    expect(p.appConfigDir).toBe('/c/anaf-cli');
    expect(p.appDataDir).toBe('/d/anaf-cli');
    expect(p.appCacheDir).toBe('/x/anaf-cli');
    expect(p.configFile).toBe('/c/anaf-cli/config.yaml');
    expect(p.credentialFile).toBe('/c/anaf-cli/credential.yaml');
    expect(p.companiesDir).toBe('/c/anaf-cli/companies');
    expect(p.tokensDir).toBe('/d/anaf-cli/tokens');
    expect(p.companyCacheDir).toBe('/x/anaf-cli/company-cache');
  });

  it('companyFile/tokenFile/cacheFile derive from argument', () => {
    const p = getXdgPaths({ configHome: '/c', dataHome: '/d', cacheHome: '/x' });
    expect(p.companyFile('12345678')).toBe('/c/anaf-cli/companies/12345678.yaml');
    expect(p.tokenFile('_default')).toBe('/d/anaf-cli/tokens/_default.json');
    expect(p.cacheFile('12345678')).toBe('/x/anaf-cli/company-cache/12345678.json');
  });
});
