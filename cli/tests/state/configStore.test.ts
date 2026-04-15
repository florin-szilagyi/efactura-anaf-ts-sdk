import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigStore } from '../../src/state/configStore';
import { getXdgPaths } from '../../src/state/paths';
import { CliError } from '../../src/output/errors';

function freshPaths(): { dir: string; paths: ReturnType<typeof getXdgPaths> } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anaf-cli-state-'));
  const paths = getXdgPaths({
    configHome: path.join(dir, 'config'),
    dataHome: path.join(dir, 'data'),
    cacheHome: path.join(dir, 'cache'),
  });
  return { dir, paths };
}

describe('ConfigStore', () => {
  it('returns an empty config when no file exists', () => {
    const { paths } = freshPaths();
    const store = new ConfigStore({ paths });
    expect(store.read()).toEqual({});
    expect(store.getActiveCui()).toBeUndefined();
  });

  it('writes and reads back a config', () => {
    const { paths } = freshPaths();
    const store = new ConfigStore({ paths });
    store.write({ activeCui: '12345678', env: 'prod' });
    expect(store.read()).toEqual({
      activeCui: '12345678',
      env: 'prod',
    });
  });

  it('setActiveCui updates only that field', () => {
    const { paths } = freshPaths();
    const store = new ConfigStore({ paths });
    store.write({ env: 'test' });
    store.setActiveCui('12345678');
    expect(store.read()).toEqual({ activeCui: '12345678', env: 'test' });
  });

  it('setActiveCui(undefined) clears the field', () => {
    const { paths } = freshPaths();
    const store = new ConfigStore({ paths });
    store.write({ activeCui: '12345678' });
    store.setActiveCui(undefined);
    expect(store.read().activeCui).toBeUndefined();
  });

  it('getEnv defaults to test when not set', () => {
    const { paths } = freshPaths();
    const store = new ConfigStore({ paths });
    expect(store.getEnv()).toBe('test');
  });

  it('setEnv persists the environment', () => {
    const { paths } = freshPaths();
    const store = new ConfigStore({ paths });
    store.setEnv('prod');
    expect(store.getEnv()).toBe('prod');
  });

  it('throws CliError(local_state, INVALID_CONFIG_FILE) on garbage YAML', () => {
    const { paths } = freshPaths();
    fs.mkdirSync(paths.appConfigDir, { recursive: true });
    fs.writeFileSync(paths.configFile, 'activeCui: { not: a string }');
    const store = new ConfigStore({ paths });
    let err: unknown;
    try {
      store.read();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).category).toBe('local_state');
    expect((err as CliError).code).toBe('INVALID_CONFIG_FILE');
  });
});
