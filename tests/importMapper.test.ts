import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ImportMapper } from '../src/algorithms/importMapper';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

describe('ImportMapper', () => {
  const testDir = join(import.meta.dir, 'test-project');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('should detect import statements', async () => {
    const testFile = join(testDir, 'index.ts');
    await writeFile(testFile, `
      import { readFile } from 'fs/promises';
      import React from 'react';
      import { Button } from './components/Button';
      const lodash = require('lodash');
    `);

    const mapper = new ImportMapper(testDir);
    const result = await mapper.analyze();

    expect(result.summary.totalFiles).toBe(1);
    expect(result.summary.totalImports).toBe(4);
    expect(result.summary.externalDependencies).toBe(3);
    expect(result.graph.externalPackages.has('fs/promises')).toBe(true);
    expect(result.graph.externalPackages.has('react')).toBe(true);
    expect(result.graph.externalPackages.has('lodash')).toBe(true);
  });

  test('should detect circular dependencies', async () => {
    await writeFile(join(testDir, 'a.ts'), `
      import { b } from './b';
      export const a = 'a';
    `);
    
    await writeFile(join(testDir, 'b.ts'), `
      import { c } from './c';
      export const b = 'b';
    `);
    
    await writeFile(join(testDir, 'c.ts'), `
      import { a } from './a';
      export const c = 'c';
    `);

    const mapper = new ImportMapper(testDir);
    const result = await mapper.analyze();

    expect(result.summary.circularDependencies).toBe(1);
    expect(result.graph.circularDependencies.length).toBe(1);
  });

  test('should identify root files', async () => {
    await writeFile(join(testDir, 'index.ts'), `
      import { helper } from './helper';
    `);
    
    await writeFile(join(testDir, 'helper.ts'), `
      export const helper = () => 'help';
    `);

    const mapper = new ImportMapper(testDir);
    const result = await mapper.analyze();

    expect(result.graph.rootFiles).toContain('index.ts');
    expect(result.graph.rootFiles).not.toContain('helper.ts');
  });

  test('should handle scoped packages', async () => {
    await writeFile(join(testDir, 'index.ts'), `
      import { something } from '@scope/package';
      import { another } from '@scope/package/subpath';
    `);

    const mapper = new ImportMapper(testDir);
    const result = await mapper.analyze();

    expect(result.graph.externalPackages.has('@scope/package')).toBe(true);
    expect(result.graph.externalPackages.size).toBe(1);
  });
});