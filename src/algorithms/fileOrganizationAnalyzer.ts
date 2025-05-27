import { Glob } from 'bun';
import { join, dirname, basename, relative, sep } from 'path';
import type { DirectoryPattern, FileOrganizationResult } from '../types/organization';

export class FileOrganizationAnalyzer {
  private rootPath: string;
  private directoryMap: Map<string, DirectoryPattern> = new Map();
  private fileList: string[] = [];
  
  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  async analyze(): Promise<FileOrganizationResult> {
    // Collect all files and build directory structure
    await this.collectFiles();
    await this.analyzeDirectories();
    
    // Analyze patterns
    const architecture = this.detectArchitecturePattern();
    const componentOrg = this.detectComponentOrganization();
    const testingStrategy = this.detectTestingStrategy();
    const configLocation = this.detectConfigLocation();
    const namingConventions = this.detectNamingConventions();
    const conventions = this.detectConventions();
    
    // Generate insights
    const insights = this.generateInsights();
    
    return {
      structure: {
        rootDirectories: this.getRootDirectories(),
        depth: this.getMaxDepth(),
        totalFiles: this.fileList.length,
        totalDirectories: this.directoryMap.size
      },
      patterns: {
        architecture,
        componentOrganization: componentOrg,
        testingStrategy,
        configLocation
      },
      conventions: {
        namingConventions,
        indexFiles: conventions.indexFiles,
        barrelExports: conventions.barrelExports,
        testFileSuffix: conventions.testFileSuffix
      },
      insights
    };
  }

  private async collectFiles(): Promise<void> {
    const glob = new Glob('**/*');
    
    for await (const file of glob.scan({
      cwd: this.rootPath,
      onlyFiles: true,
      followSymlinks: false
    })) {
      if (this.shouldSkipPath(file)) continue;
      
      this.fileList.push(file);
      
      // Build directory hierarchy
      const dir = dirname(file);
      if (dir !== '.') {
        this.ensureDirectoryEntry(dir);
      }
    }
  }

  private shouldSkipPath(path: string): boolean {
    const skipPatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      '.cache',
      'tmp',
      'temp'
    ];
    
    return skipPatterns.some(pattern => path.includes(pattern));
  }

  private ensureDirectoryEntry(dirPath: string): void {
    if (this.directoryMap.has(dirPath)) return;
    
    const entry: DirectoryPattern = {
      path: dirPath,
      type: 'other',
      confidence: 0,
      fileCount: 0,
      subDirectories: [],
      fileTypes: new Map()
    };
    
    this.directoryMap.set(dirPath, entry);
    
    // Ensure parent directories exist
    const parent = dirname(dirPath);
    if (parent !== '.' && parent !== dirPath) {
      this.ensureDirectoryEntry(parent);
      const parentEntry = this.directoryMap.get(parent);
      if (parentEntry && !parentEntry.subDirectories.includes(basename(dirPath))) {
        parentEntry.subDirectories.push(basename(dirPath));
      }
    }
  }

  private async analyzeDirectories(): Promise<void> {
    // Count files and types in each directory
    for (const file of this.fileList) {
      const dir = dirname(file);
      const ext = this.getFileExtension(file);
      
      if (dir === '.') continue;
      
      const dirEntry = this.directoryMap.get(dir);
      if (dirEntry) {
        dirEntry.fileCount++;
        dirEntry.fileTypes.set(ext, (dirEntry.fileTypes.get(ext) || 0) + 1);
      }
    }
    
    // Classify directories
    for (const [path, entry] of this.directoryMap) {
      entry.type = this.classifyDirectory(path, entry);
      entry.confidence = this.calculateDirectoryConfidence(entry);
    }
  }

  private getFileExtension(filePath: string): string {
    const base = basename(filePath);
    const lastDot = base.lastIndexOf('.');
    return lastDot > 0 ? base.substring(lastDot + 1) : '';
  }

  private classifyDirectory(path: string, entry: DirectoryPattern): DirectoryPattern['type'] {
    const dirName = basename(path).toLowerCase();
    const parentDir = basename(dirname(path)).toLowerCase();
    
    // Component directories
    if (
      dirName.includes('component') ||
      dirName === 'ui' ||
      dirName === 'elements' ||
      dirName === 'atoms' ||
      dirName === 'molecules' ||
      dirName === 'organisms' ||
      dirName === 'templates' ||
      dirName === 'pages' ||
      (parentDir.includes('component') && entry.fileTypes.has('tsx') || entry.fileTypes.has('jsx') || entry.fileTypes.has('vue') || entry.fileTypes.has('svelte'))
    ) {
      return 'component';
    }
    
    // Feature directories
    if (
      dirName === 'features' ||
      dirName === 'modules' ||
      dirName === 'domains' ||
      (parentDir === 'features' || parentDir === 'modules')
    ) {
      return 'feature';
    }
    
    // Utility directories
    if (
      dirName === 'utils' ||
      dirName === 'utilities' ||
      dirName === 'helpers' ||
      dirName === 'lib' ||
      dirName === 'core' ||
      dirName === 'common' ||
      dirName === 'shared'
    ) {
      return 'utility';
    }
    
    // Config directories
    if (
      dirName === 'config' ||
      dirName === 'configs' ||
      dirName === 'settings' ||
      dirName === 'constants'
    ) {
      return 'config';
    }
    
    // Test directories
    if (
      dirName === 'test' ||
      dirName === 'tests' ||
      dirName === '__tests__' ||
      dirName === 'spec' ||
      dirName === 'specs' ||
      dirName.endsWith('.test') ||
      dirName.endsWith('.spec')
    ) {
      return 'test';
    }
    
    // Asset directories
    if (
      dirName === 'assets' ||
      dirName === 'images' ||
      dirName === 'img' ||
      dirName === 'icons' ||
      dirName === 'fonts' ||
      dirName === 'media' ||
      dirName === 'static' ||
      dirName === 'public'
    ) {
      return 'asset';
    }
    
    // Route directories
    if (
      dirName === 'routes' ||
      dirName === 'pages' ||
      dirName === 'views' ||
      dirName === 'screens' ||
      dirName === 'app' ||
      (parentDir === 'app' && this.hasRouteFiles(entry))
    ) {
      return 'route';
    }
    
    // Service directories
    if (
      dirName === 'services' ||
      dirName === 'api' ||
      dirName === 'apis' ||
      dirName === 'providers' ||
      dirName === 'repositories'
    ) {
      return 'service';
    }
    
    // Model directories
    if (
      dirName === 'models' ||
      dirName === 'entities' ||
      dirName === 'schemas' ||
      dirName === 'types' ||
      dirName === 'interfaces'
    ) {
      return 'model';
    }
    
    // Style directories
    if (
      dirName === 'styles' ||
      dirName === 'css' ||
      dirName === 'scss' ||
      dirName === 'sass' ||
      entry.fileTypes.has('css') ||
      entry.fileTypes.has('scss') ||
      entry.fileTypes.has('sass')
    ) {
      return 'style';
    }
    
    // Documentation
    if (
      dirName === 'docs' ||
      dirName === 'documentation' ||
      entry.fileTypes.has('md') ||
      entry.fileTypes.has('mdx')
    ) {
      return 'documentation';
    }
    
    return 'other';
  }

  private hasRouteFiles(entry: DirectoryPattern): boolean {
    // Check for Next.js/Nuxt style route files
    return entry.fileTypes.has('tsx') || entry.fileTypes.has('jsx') || 
           entry.fileTypes.has('vue') || entry.fileTypes.has('svelte');
  }

  private calculateDirectoryConfidence(entry: DirectoryPattern): number {
    if (entry.type === 'other') return 0;
    
    // Base confidence on file count and type consistency
    const hasRelevantFiles = entry.fileCount > 0;
    const typeConsistency = this.calculateTypeConsistency(entry);
    
    return hasRelevantFiles ? Math.min(0.5 + (typeConsistency * 0.5), 1) : 0.3;
  }

  private calculateTypeConsistency(entry: DirectoryPattern): number {
    if (entry.fileTypes.size === 0) return 0;
    
    const totalFiles = Array.from(entry.fileTypes.values()).reduce((a, b) => a + b, 0);
    const dominantType = Math.max(...entry.fileTypes.values());
    
    return dominantType / totalFiles;
  }

  private getRootDirectories(): DirectoryPattern[] {
    const rootDirs: DirectoryPattern[] = [];
    
    for (const [path, entry] of this.directoryMap) {
      if (!path.includes(sep) && entry.type !== 'other') {
        rootDirs.push(entry);
      }
    }
    
    return rootDirs.sort((a, b) => b.confidence - a.confidence);
  }

  private getMaxDepth(): number {
    let maxDepth = 0;
    
    for (const path of this.directoryMap.keys()) {
      const depth = path.split(sep).length;
      maxDepth = Math.max(maxDepth, depth);
    }
    
    return maxDepth;
  }

  private detectArchitecturePattern(): FileOrganizationResult['patterns']['architecture'] {
    const rootDirs = this.getRootDirectories();
    const hasFeatures = rootDirs.some(d => d.type === 'feature');
    const hasLayers = rootDirs.filter(d => 
      ['component', 'service', 'model', 'utility'].includes(d.type)
    ).length >= 3;
    
    // Check for domain directories
    const hasDomains = Array.from(this.directoryMap.entries()).some(([path, entry]) => 
      path.includes('domain') || path.includes('modules')
    );
    
    if (hasFeatures && !hasLayers) return 'feature-based';
    if (hasLayers && !hasFeatures) return 'layer-based';
    if (hasDomains) return 'domain-driven';
    if (hasFeatures && hasLayers) return 'mixed';
    
    return 'unknown';
  }

  private detectComponentOrganization(): FileOrganizationResult['patterns']['componentOrganization'] {
    const componentDirs = Array.from(this.directoryMap.entries())
      .filter(([_, entry]) => entry.type === 'component');
    
    if (componentDirs.length === 0) return 'none';
    
    // Check for atomic design
    const atomicKeywords = ['atoms', 'molecules', 'organisms', 'templates', 'pages'];
    const hasAtomic = componentDirs.some(([path]) => 
      atomicKeywords.some(keyword => path.includes(keyword))
    );
    
    if (hasAtomic) return 'atomic';
    
    // Check if components are organized by feature
    const componentsByFeature = componentDirs.filter(([path]) => 
      path.includes('features') || path.includes('modules')
    );
    
    if (componentsByFeature.length > componentDirs.length / 2) return 'by-feature';
    
    // Check if all components are in a single directory
    const uniqueParents = new Set(
      componentDirs.map(([path]) => dirname(path))
    );
    
    if (uniqueParents.size === 1) return 'by-type';
    
    return 'mixed';
  }

  private detectTestingStrategy(): FileOrganizationResult['patterns']['testingStrategy'] {
    const testDirs = Array.from(this.directoryMap.entries())
      .filter(([_, entry]) => entry.type === 'test');
    
    const testFiles = this.fileList.filter(f => 
      f.includes('.test.') || f.includes('.spec.') || 
      f.includes('__tests__') || f.includes('test/')
    );
    
    if (testFiles.length === 0) return 'none';
    
    // Check if tests are colocated with source files
    const colocatedTests = testFiles.filter(f => 
      !f.includes('__tests__') && !f.includes('/test/') && !f.includes('/tests/')
    );
    
    const separateTests = testFiles.filter(f =>
      f.includes('__tests__') || f.includes('/test/') || f.includes('/tests/')
    );
    
    if (colocatedTests.length > separateTests.length * 2) return 'colocated';
    if (separateTests.length > colocatedTests.length * 2) return 'separate-directory';
    
    return 'mixed';
  }

  private detectConfigLocation(): FileOrganizationResult['patterns']['configLocation'] {
    const configFiles = this.fileList.filter(f => {
      const name = basename(f).toLowerCase();
      return name.includes('config') || name.includes('settings') || 
             name.endsWith('.config.js') || name.endsWith('.config.ts');
    });
    
    if (configFiles.length === 0) return 'root';
    
    const rootConfigs = configFiles.filter(f => !f.includes('/'));
    const configDirConfigs = configFiles.filter(f => 
      f.includes('/config/') || f.includes('/configs/')
    );
    
    if (rootConfigs.length > configFiles.length * 0.7) return 'root';
    if (configDirConfigs.length > configFiles.length * 0.7) return 'config-directory';
    if (configFiles.length > 5) return 'distributed';
    
    return 'mixed';
  }

  private detectNamingConventions(): FileOrganizationResult['conventions']['namingConventions'] {
    const components = this.fileList.filter(f => 
      f.endsWith('.tsx') || f.endsWith('.jsx') || 
      f.endsWith('.vue') || f.endsWith('.svelte')
    ).map(f => basename(f).split('.')[0]);
    
    const files = this.fileList.map(f => basename(f).split('.')[0]);
    const directories = Array.from(this.directoryMap.keys()).map(d => basename(d));
    
    return {
      components: this.detectNamingPattern(components),
      files: this.detectNamingPattern(files),
      directories: this.detectNamingPattern(directories)
    };
  }

  private detectNamingPattern(names: string[]): 'PascalCase' | 'camelCase' | 'kebab-case' | 'snake_case' | 'mixed' {
    if (names.length === 0) return 'mixed';
    
    const patterns = {
      PascalCase: 0,
      camelCase: 0,
      'kebab-case': 0,
      snake_case: 0
    };
    
    for (const name of names) {
      if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) patterns.PascalCase++;
      else if (/^[a-z][a-zA-Z0-9]*$/.test(name)) patterns.camelCase++;
      else if (/^[a-z]+(-[a-z]+)*$/.test(name)) patterns['kebab-case']++;
      else if (/^[a-z]+(_[a-z]+)*$/.test(name)) patterns.snake_case++;
    }
    
    const total = names.length;
    for (const [pattern, count] of Object.entries(patterns)) {
      if (count > total * 0.7) return pattern as any;
    }
    
    return 'mixed';
  }

  private detectConventions(): { indexFiles: boolean; barrelExports: boolean; testFileSuffix: string[] } {
    const indexFiles = this.fileList.filter(f => basename(f).startsWith('index.'));
    const hasBarrelExports = indexFiles.length > 5;
    
    const testSuffixes = new Set<string>();
    const testFiles = this.fileList.filter(f => 
      f.includes('.test.') || f.includes('.spec.')
    );
    
    for (const file of testFiles) {
      if (file.includes('.test.')) testSuffixes.add('.test');
      if (file.includes('.spec.')) testSuffixes.add('.spec');
    }
    
    return {
      indexFiles: indexFiles.length > 0,
      barrelExports: hasBarrelExports,
      testFileSuffix: Array.from(testSuffixes)
    };
  }

  private generateInsights(): string[] {
    const insights: string[] = [];
    const rootDirs = this.getRootDirectories();
    
    // Architecture insights
    const architecture = this.detectArchitecturePattern();
    if (architecture === 'feature-based') {
      insights.push('✅ Feature-based architecture promotes better code organization and scalability');
    } else if (architecture === 'layer-based') {
      insights.push('📋 Layer-based architecture separates concerns but may lead to feature fragmentation');
    }
    
    // Component organization
    const componentOrg = this.detectComponentOrganization();
    if (componentOrg === 'atomic') {
      insights.push('🎨 Atomic design pattern detected - good for design system consistency');
    }
    
    // Testing insights
    const testingStrategy = this.detectTestingStrategy();
    if (testingStrategy === 'none') {
      insights.push('⚠️ No test files detected - consider adding tests for better code quality');
    } else if (testingStrategy === 'colocated') {
      insights.push('✅ Colocated tests make it easier to maintain test coverage');
    }
    
    // Naming conventions
    const conventions = this.detectNamingConventions();
    if (conventions.components === 'PascalCase' && conventions.files !== 'PascalCase') {
      insights.push('💡 Consider using consistent naming between components and their files');
    }
    
    // Barrel exports
    const { barrelExports } = this.detectConventions();
    if (barrelExports) {
      insights.push('📦 Barrel exports (index files) detected - helps with cleaner imports');
    }
    
    // Directory depth
    const depth = this.getMaxDepth();
    if (depth > 5) {
      insights.push('🔍 Deep directory nesting detected - consider flattening structure for easier navigation');
    }
    
    return insights;
  }
}