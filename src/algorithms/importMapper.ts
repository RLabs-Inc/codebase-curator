import { Glob } from 'bun';
import { dirname, relative, resolve } from 'path';
import type { ImportStatement, DependencyNode, DependencyGraph, ImportMapResult, CuratorConfig } from '../types';
import { loadConfig, mergeExclusions, shouldExclude } from '../utils/config';

export class ImportMapper {
  private graph: DependencyGraph;
  private rootPath: string;
  private transpiler: any;
  private filePattern: string;
  private exclusions: string[];
  private inclusions: string[];

  constructor(
    rootPath: string, 
    filePattern: string = '**/*.{ts,tsx,js,jsx,mjs}',
    customExclusions?: string[]
  ) {
    this.rootPath = rootPath;
    this.filePattern = filePattern;
    this.transpiler = new Bun.Transpiler({ loader: 'tsx' });
    
    // Load config and merge exclusions
    const config = loadConfig(rootPath);
    this.exclusions = mergeExclusions(
      undefined, // use defaults
      config.exclude,
      customExclusions
    );
    this.inclusions = config.include || [];
    
    this.graph = {
      nodes: new Map(),
      rootFiles: [],
      externalPackages: new Set(),
      circularDependencies: []
    };
  }

  async analyze(): Promise<ImportMapResult> {
    const files = await this.discoverFiles();
    
    await Promise.all(
      files.map(file => this.analyzeFile(file))
    );

    this.updateImportedByReferences();
    this.detectCircularDependencies();
    this.identifyRootFiles();

    return this.generateResult();
  }

  private async discoverFiles(): Promise<string[]> {
    const glob = new Glob(this.filePattern);
    const files: string[] = [];
    
    for await (const file of glob.scan({ 
      cwd: this.rootPath,
      absolute: true,
      onlyFiles: true,
      followSymlinks: false
    })) {
      if (!this.shouldSkipFile(file)) {
        files.push(file);
      }
    }
    
    return files;
  }

  private shouldSkipFile(filePath: string): boolean {
    return shouldExclude(filePath, this.exclusions, this.inclusions);
  }

  private async analyzeFile(filePath: string): Promise<void> {
    try {
      const file = Bun.file(filePath);
      const content = await file.text();
      
      const imports = await this.extractImportsWithTranspiler(content, filePath);
      
      const relativePath = relative(this.rootPath, filePath);
      const node: DependencyNode = {
        filePath: relativePath,
        imports,
        importedBy: [],
        externalDependencies: [],
        internalDependencies: []
      };

      for (const imp of imports) {
        if (imp.isExternal) {
          const packageName = this.extractPackageName(imp.source);
          node.externalDependencies.push(packageName);
          this.graph.externalPackages.add(packageName);
        } else {
          const resolvedPath = await this.resolveInternalImport(imp.source, filePath);
          if (resolvedPath) {
            node.internalDependencies.push(resolvedPath);
          }
        }
      }

      this.graph.nodes.set(relativePath, node);
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
    }
  }

  private async extractImportsWithTranspiler(
    content: string, 
    filePath: string
  ): Promise<ImportStatement[]> {
    // For now, use the regex-based approach as Bun's scanImports 
    // doesn't provide the actual import names, just the paths
    return this.extractImportsFallback(content);
  }

  private extractImportNames(imp: any): string[] {
    const names: string[] = [];
    
    if (imp.default) {
      names.push(imp.default);
    }
    
    if (imp.names && Array.isArray(imp.names)) {
      names.push(...imp.names);
    }
    
    if (imp.namespace) {
      names.push(imp.namespace);
    }
    
    return names.length > 0 ? names : ['*'];
  }

  private getLineNumber(content: string, position: number): number {
    const lines = content.substring(0, position).split('\n');
    return lines.length;
  }

  private extractImportsFallback(content: string): ImportStatement[] {
    const imports: ImportStatement[] = [];
    const lines = content.split('\n');
    
    const importRegex = /(?:import|export)\s+(?:type\s+)?(?:(\*\s+as\s+\w+)|(\w+)|({[^}]+}))\s+from\s+['"]([^'"]+)['"]/g;
    const requireRegex = /(?:const|let|var)\s+(?:(\w+)|({[^}]+}))\s*=\s*require\s*\(['"]([^'"]+)['"]\)/g;
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    lines.forEach((line, index) => {
      let match;
      
      while ((match = importRegex.exec(line)) !== null) {
        const [, namespace, defaultImport, namedImports, source] = match;
        
        imports.push({
          source,
          imports: this.parseImportNames(namespace, defaultImport, namedImports),
          isDefault: !!defaultImport,
          isNamespace: !!namespace,
          isExternal: this.isExternalImport(source),
          line: index + 1
        });
      }
      
      while ((match = requireRegex.exec(line)) !== null) {
        const [, defaultImport, destructured, source] = match;
        
        imports.push({
          source,
          imports: defaultImport ? [defaultImport] : this.parseDestructured(destructured),
          isDefault: !!defaultImport,
          isNamespace: false,
          isExternal: this.isExternalImport(source),
          line: index + 1
        });
      }
      
      while ((match = dynamicImportRegex.exec(line)) !== null) {
        const [, source] = match;
        
        imports.push({
          source,
          imports: ['*'],
          isDefault: false,
          isNamespace: false,
          isExternal: this.isExternalImport(source),
          line: index + 1
        });
      }
    });
    
    return imports;
  }

  private parseImportNames(namespace: string, defaultImport: string, namedImports: string): string[] {
    if (namespace) {
      return [namespace.replace(/\*\s+as\s+/, '').trim()];
    }
    
    const names: string[] = [];
    
    if (defaultImport) {
      names.push(defaultImport);
    }
    
    if (namedImports) {
      const cleaned = namedImports.replace(/[{}]/g, '').trim();
      names.push(...cleaned.split(',').map(n => n.trim().split(/\s+as\s+/)[0]));
    }
    
    return names;
  }

  private parseDestructured(destructured: string): string[] {
    if (!destructured) return [];
    return destructured.replace(/[{}]/g, '').split(',').map(n => n.trim());
  }

  private isExternalImport(source: string): boolean {
    return !source.startsWith('.') && !source.startsWith('/');
  }

  private extractPackageName(source: string): string {
    // Handle scoped packages like @scope/package
    if (source.startsWith('@')) {
      const parts = source.split('/');
      return parts.slice(0, 2).join('/');
    }
    
    // For Node.js built-in modules with subpaths (like fs/promises),
    // keep the full path as they're distinct modules
    if (source.startsWith('node:') || this.isNodeBuiltin(source)) {
      return source;
    }
    
    // For regular packages, extract just the package name
    return source.split('/')[0];
  }
  
  private isNodeBuiltin(source: string): boolean {
    const builtins = [
      'fs', 'path', 'http', 'https', 'crypto', 'os', 'util', 'stream',
      'buffer', 'events', 'querystring', 'url', 'child_process', 'cluster',
      'dgram', 'dns', 'net', 'readline', 'tls', 'vm', 'zlib'
    ];
    const baseName = source.split('/')[0];
    return builtins.includes(baseName);
  }

  private async resolveInternalImport(importPath: string, fromFile: string): Promise<string | null> {
    if (!importPath.startsWith('.')) return null;
    
    try {
      const resolved = Bun.resolveSync(importPath, dirname(fromFile));
      return relative(this.rootPath, resolved);
    } catch {
      const fromDir = dirname(fromFile);
      const resolved = resolve(fromDir, importPath);
      const relativePath = relative(this.rootPath, resolved);
      
      const possiblePaths = [
        relativePath,
        relativePath + '.ts',
        relativePath + '.tsx',
        relativePath + '.js',
        relativePath + '.jsx',
        relativePath + '/index.ts',
        relativePath + '/index.tsx',
        relativePath + '/index.js',
        relativePath + '/index.jsx'
      ];
      
      for (const path of possiblePaths) {
        if (this.graph.nodes.has(path)) {
          return path;
        }
      }
      
      return relativePath;
    }
  }

  private updateImportedByReferences(): void {
    for (const [filePath, node] of this.graph.nodes) {
      for (const dep of node.internalDependencies) {
        const depNode = this.graph.nodes.get(dep);
        if (depNode) {
          depNode.importedBy.push(filePath);
        }
      }
    }
  }

  private detectCircularDependencies(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (filePath: string, path: string[] = []): void => {
      visited.add(filePath);
      recursionStack.add(filePath);
      path.push(filePath);

      const node = this.graph.nodes.get(filePath);
      if (node) {
        for (const dep of node.internalDependencies) {
          if (!visited.has(dep)) {
            dfs(dep, [...path]);
          } else if (recursionStack.has(dep)) {
            const cycleStart = path.indexOf(dep);
            if (cycleStart !== -1) {
              cycles.push([...path.slice(cycleStart), dep]);
            }
          }
        }
      }

      recursionStack.delete(filePath);
    };

    for (const filePath of this.graph.nodes.keys()) {
      if (!visited.has(filePath)) {
        dfs(filePath);
      }
    }

    this.graph.circularDependencies = this.deduplicateCycles(cycles);
  }

  private deduplicateCycles(cycles: string[][]): string[][] {
    const uniqueCycles: string[][] = [];
    const seen = new Set<string>();

    for (const cycle of cycles) {
      const normalized = this.normalizeCycle(cycle);
      const key = normalized.join('->');
      
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCycles.push(cycle);
      }
    }

    return uniqueCycles;
  }

  private normalizeCycle(cycle: string[]): string[] {
    const minIndex = cycle.reduce((minIdx, _, idx) => 
      cycle[idx] < cycle[minIdx] ? idx : minIdx, 0);
    return [...cycle.slice(minIndex), ...cycle.slice(0, minIndex)];
  }

  private identifyRootFiles(): void {
    this.graph.rootFiles = Array.from(this.graph.nodes.keys())
      .filter(filePath => {
        const node = this.graph.nodes.get(filePath);
        return node && node.importedBy.length === 0;
      });
  }

  private generateResult(): ImportMapResult {
    let totalImports = 0;
    let externalDeps = 0;
    let internalDeps = 0;

    for (const node of this.graph.nodes.values()) {
      totalImports += node.imports.length;
      externalDeps += node.externalDependencies.length;
      internalDeps += node.internalDependencies.length;
    }

    return {
      graph: this.graph,
      summary: {
        totalFiles: this.graph.nodes.size,
        totalImports,
        externalDependencies: externalDeps,
        internalDependencies: internalDeps,
        circularDependencies: this.graph.circularDependencies.length
      }
    };
  }
}