#!/usr/bin/env node
export async function main(): Promise<void> {
  throw new Error('server not yet implemented');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
