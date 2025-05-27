import { Glob } from 'bun';
import { basename, extname, relative } from 'path';
import type { CodePattern, PatternAggregationResult, FunctionPattern, ComponentPattern, ErrorHandlingPattern } from '../types/patterns';

interface ASTNode {
  type: string;
  name?: string;
  params?: any[];
  body?: any;
  properties?: any[];
  elements?: any[];
  [key: string]: any;
}

export class PatternAggregator {
  private rootPath: string;
  private patterns: PatternAggregationResult['patterns'];
  private filePatterns: Map<string, Set<string>> = new Map();
  private transpiler: any;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.transpiler = new Bun.Transpiler({ loader: 'tsx' });
    this.patterns = {
      functions: new Map(),
      components: new Map(),
      errorHandling: new Map(),
      hooks: new Map(),
      utilities: new Map()
    };
  }

  async analyze(): Promise<PatternAggregationResult> {
    const files = await this.collectSourceFiles();
    
    // Analyze each file
    for (const file of files) {
      await this.analyzeFile(file);
    }
    
    // Generate statistics and recommendations
    const statistics = this.generateStatistics();
    const recommendations = this.generateRecommendations();
    
    return {
      patterns: this.patterns,
      statistics,
      recommendations
    };
  }

  private async collectSourceFiles(): Promise<string[]> {
    const patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
    const files: string[] = [];
    
    for (const pattern of patterns) {
      const glob = new Glob(pattern);
      
      for await (const file of glob.scan({
        cwd: this.rootPath,
        onlyFiles: true,
        followSymlinks: false
      })) {
        if (!this.shouldSkipFile(file)) {
          files.push(file);
        }
      }
    }
    
    return files;
  }

  private shouldSkipFile(path: string): boolean {
    const skipPatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      '.min.',
      '.test.',
      '.spec.',
      '.d.ts'
    ];
    
    return skipPatterns.some(pattern => path.includes(pattern));
  }

  private async analyzeFile(filePath: string): Promise<void> {
    try {
      const fullPath = `${this.rootPath}/${filePath}`;
      const content = await Bun.file(fullPath).text();
      
      // Try to parse with Bun's transpiler for basic structure
      const { exports, imports } = this.transpiler.scan(content);
      
      // Use regex patterns for detailed analysis
      this.analyzeFunctions(content, filePath);
      this.analyzeComponents(content, filePath);
      this.analyzeErrorHandling(content, filePath);
      this.analyzeHooks(content, filePath);
      this.analyzeUtilities(content, filePath);
    } catch (error) {
      // Skip files that can't be analyzed
    }
  }

  private analyzeFunctions(content: string, filePath: string): void {
    // Function declarations and expressions
    const functionPatterns = [
      // Regular functions
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*{/g,
      // Arrow functions
      /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*([^=]+))?\s*=>\s*[{(]/g,
      // Method definitions
      /(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*{/g
    ];
    
    for (const pattern of functionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const [fullMatch, name, params, returnType] = match;
        
        if (!name || this.isReactHook(name) || this.isComponent(name)) continue;
        
        const signature = this.createFunctionSignature(name, params, returnType);
        this.addPattern('functions', signature, filePath, 'function');
      }
    }
  }

  private analyzeComponents(content: string, filePath: string): void {
    const ext = extname(filePath);
    if (!['.tsx', '.jsx', '.vue', '.svelte'].includes(ext)) return;
    
    // React/Vue/Svelte component patterns
    const componentPatterns = [
      // React functional components
      /(?:export\s+)?(?:const|function)\s+([A-Z]\w+)\s*(?::\s*(?:React\.)?FC)?.*?=.*?(?:return\s+)?[(<]/g,
      // Class components
      /class\s+([A-Z]\w+)\s+extends\s+(?:React\.)?Component/g,
      // Vue components
      /export\s+default\s+{[^}]*name:\s*['"]([A-Z]\w+)['"]/g
    ];
    
    for (const pattern of componentPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const [, name] = match;
        
        // Extract props pattern
        const propsPattern = this.extractPropsPattern(content, name);
        const signature = `Component:${name}:${propsPattern}`;
        
        this.addPattern('components', signature, filePath, 'component');
      }
    }
  }

  private analyzeErrorHandling(content: string, filePath: string): void {
    // Try-catch patterns
    const tryCatchPattern = /try\s*{([^}]+)}\s*catch\s*\((\w+)\)\s*{([^}]+)}/g;
    let match;
    
    while ((match = tryCatchPattern.exec(content)) !== null) {
      const [, tryBlock, errorVar, catchBlock] = match;
      
      // Analyze catch block for patterns
      const handlingType = this.classifyErrorHandling(catchBlock);
      const signature = `ErrorHandling:try-catch:${handlingType}`;
      
      this.addPattern('errorHandling', signature, filePath, 'error-handling');
    }
    
    // Promise catch patterns
    const promiseCatchPattern = /\.catch\s*\(\s*(?:\((\w+)\)\s*=>\s*)?([^)]+)\)/g;
    while ((match = promiseCatchPattern.exec(content)) !== null) {
      const signature = 'ErrorHandling:promise-catch';
      this.addPattern('errorHandling', signature, filePath, 'error-handling');
    }
    
    // Error boundary patterns (React)
    if (content.includes('componentDidCatch') || content.includes('ErrorBoundary')) {
      this.addPattern('errorHandling', 'ErrorHandling:error-boundary', filePath, 'error-handling');
    }
  }

  private analyzeHooks(content: string, filePath: string): void {
    if (!['.tsx', '.jsx'].includes(extname(filePath))) return;
    
    // React hooks
    const hookPatterns = [
      /use[A-Z]\w+/g,
      /(?:const|let)\s+\[[\w\s,]+\]\s*=\s*use\w+/g
    ];
    
    const foundHooks = new Set<string>();
    
    for (const pattern of hookPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const hookMatch = match[0].match(/use\w+/);
        if (hookMatch) {
          foundHooks.add(hookMatch[0]);
        }
      }
    }
    
    // Custom hooks
    const customHookPattern = /(?:export\s+)?(?:const|function)\s+(use[A-Z]\w+)/g;
    let match;
    while ((match = customHookPattern.exec(content)) !== null) {
      const [, hookName] = match;
      const signature = `Hook:${hookName}`;
      this.addPattern('hooks', signature, filePath, 'hook');
    }
  }

  private analyzeUtilities(content: string, filePath: string): void {
    // Common utility patterns
    const utilityPatterns = [
      // Validation functions
      /(?:const|function)\s+(validate\w+|is\w+|has\w+|check\w+)/gi,
      // Transformation functions
      /(?:const|function)\s+(format\w+|parse\w+|transform\w+|convert\w+|normalize\w+)/gi,
      // Helper functions
      /(?:const|function)\s+(get\w+|set\w+|create\w+|build\w+|generate\w+)/gi
    ];
    
    for (const pattern of utilityPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const [, name] = match;
        
        if (this.isComponent(name) || this.isReactHook(name)) continue;
        
        const signature = `Utility:${this.categorizeUtility(name)}`;
        this.addPattern('utilities', signature, filePath, 'utility');
      }
    }
  }

  private createFunctionSignature(name: string, params: string, returnType?: string): string {
    const paramCount = params.trim() ? params.split(',').length : 0;
    const isAsync = name.includes('async') || params.includes('async');
    return `Function:${paramCount}params:${isAsync ? 'async' : 'sync'}`;
  }

  private extractPropsPattern(content: string, componentName: string): string {
    // Try to find props interface or type
    const propsPattern = new RegExp(`(?:interface|type)\\s+${componentName}Props\\s*=?\\s*{([^}]+)}`);
    const match = content.match(propsPattern);
    
    if (match) {
      const propsCount = match[1].split(/[;,]/).filter(p => p.trim()).length;
      return `${propsCount}props`;
    }
    
    return 'unknownProps';
  }

  private classifyErrorHandling(catchBlock: string): string {
    if (catchBlock.includes('console.log') || catchBlock.includes('console.error')) {
      return 'log';
    }
    if (catchBlock.includes('throw')) {
      return 'rethrow';
    }
    if (catchBlock.includes('return')) {
      return 'return';
    }
    if (catchBlock.includes('setState') || catchBlock.includes('dispatch')) {
      return 'state-update';
    }
    return 'custom';
  }

  private isReactHook(name: string): boolean {
    return name.startsWith('use') && name[3] === name[3]?.toUpperCase();
  }

  private isComponent(name: string): boolean {
    return name[0] === name[0]?.toUpperCase() && name.length > 1;
  }

  private categorizeUtility(name: string): string {
    const lowerName = name.toLowerCase();
    
    if (lowerName.startsWith('validate') || lowerName.startsWith('is') || lowerName.startsWith('check')) {
      return 'validation';
    }
    if (lowerName.startsWith('format') || lowerName.startsWith('parse') || lowerName.startsWith('transform')) {
      return 'transformation';
    }
    if (lowerName.startsWith('get') || lowerName.startsWith('fetch')) {
      return 'accessor';
    }
    if (lowerName.startsWith('create') || lowerName.startsWith('build') || lowerName.startsWith('generate')) {
      return 'factory';
    }
    
    return 'general';
  }

  private addPattern(
    category: keyof PatternAggregationResult['patterns'],
    signature: string,
    filePath: string,
    type: CodePattern['type']
  ): void {
    const patterns = this.patterns[category];
    
    if (!patterns.has(signature)) {
      patterns.set(signature, {
        type,
        signature,
        frequency: 0,
        files: [],
        variations: 1,
        complexity: 'low'
      });
    }
    
    const pattern = patterns.get(signature)!;
    pattern.frequency++;
    
    if (!pattern.files.includes(filePath)) {
      pattern.files.push(filePath);
    }
    
    // Track file patterns
    if (!this.filePatterns.has(filePath)) {
      this.filePatterns.set(filePath, new Set());
    }
    this.filePatterns.get(filePath)!.add(signature);
  }

  private generateStatistics(): PatternAggregationResult['statistics'] {
    let totalPatterns = 0;
    const allPatterns: CodePattern[] = [];
    
    // Collect all patterns
    for (const category of Object.values(this.patterns)) {
      for (const pattern of category.values()) {
        totalPatterns++;
        allPatterns.push(pattern);
      }
    }
    
    // Sort by frequency
    const mostFrequentPatterns = allPatterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
    
    // Calculate code reuse
    const filesWithPatterns = this.filePatterns.size;
    const patternsPerFile = filesWithPatterns > 0
      ? Array.from(this.filePatterns.values()).reduce((sum, patterns) => sum + patterns.size, 0) / filesWithPatterns
      : 0;
    
    const codeReuse = Math.min(100, Math.round((patternsPerFile / 10) * 100));
    
    // Find inconsistent patterns
    const inconsistentPatterns = this.findInconsistentPatterns();
    
    return {
      totalPatterns,
      mostFrequentPatterns,
      codeReuse,
      inconsistentPatterns
    };
  }

  private findInconsistentPatterns(): Array<{ pattern: string; variations: string[]; suggestion: string }> {
    const inconsistent: Array<{ pattern: string; variations: string[]; suggestion: string }> = [];
    
    // Check for similar function patterns
    const functionPatterns = Array.from(this.patterns.functions.entries());
    const groups = this.groupSimilarPatterns(functionPatterns);
    
    for (const group of groups) {
      if (group.length > 1) {
        inconsistent.push({
          pattern: 'Function signatures',
          variations: group.map(([sig]) => sig),
          suggestion: 'Consider standardizing function parameter counts and async patterns'
        });
      }
    }
    
    // Check error handling consistency
    const errorPatterns = Array.from(this.patterns.errorHandling.keys());
    if (errorPatterns.length > 3) {
      inconsistent.push({
        pattern: 'Error handling',
        variations: errorPatterns,
        suggestion: 'Consider adopting a consistent error handling strategy across the codebase'
      });
    }
    
    return inconsistent.slice(0, 5);
  }

  private groupSimilarPatterns(patterns: Array<[string, CodePattern]>): Array<Array<[string, CodePattern]>> {
    const groups: Array<Array<[string, CodePattern]>> = [];
    const used = new Set<string>();
    
    for (const [sig, pattern] of patterns) {
      if (used.has(sig)) continue;
      
      const group = patterns.filter(([otherSig]) => 
        this.areSimilarPatterns(sig, otherSig) && !used.has(otherSig)
      );
      
      if (group.length > 1) {
        groups.push(group);
        group.forEach(([s]) => used.add(s));
      }
    }
    
    return groups;
  }

  private areSimilarPatterns(sig1: string, sig2: string): boolean {
    const parts1 = sig1.split(':');
    const parts2 = sig2.split(':');
    
    if (parts1[0] !== parts2[0]) return false;
    
    // For functions, consider them similar if they differ only in param count or async
    if (parts1[0] === 'Function') {
      return Math.abs(parseInt(parts1[1]) - parseInt(parts2[1])) <= 1;
    }
    
    return false;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.generateStatistics();
    
    // Code reuse recommendations
    if (stats.codeReuse < 30) {
      recommendations.push('Consider extracting common patterns into reusable functions or components');
    } else if (stats.codeReuse > 70) {
      recommendations.push('Good code reuse detected! Consider documenting common patterns for team reference');
    }
    
    // Pattern-specific recommendations
    if (this.patterns.errorHandling.size === 0) {
      recommendations.push('No error handling patterns detected - consider implementing consistent error handling');
    } else if (this.patterns.errorHandling.size > 5) {
      recommendations.push('Multiple error handling patterns detected - consider standardizing error handling approach');
    }
    
    if (this.patterns.hooks.size > 10) {
      recommendations.push('Many custom hooks detected - ensure they are well-documented and tested');
    }
    
    if (this.patterns.utilities.size > 20) {
      recommendations.push('Large number of utility functions - consider organizing into logical modules');
    }
    
    // Component recommendations
    const componentCount = this.patterns.components.size;
    if (componentCount > 50) {
      recommendations.push('Large number of components - consider implementing a component library or design system');
    }
    
    // Complexity recommendations
    const highComplexityPatterns = Array.from(this.patterns.functions.values())
      .filter(p => p.complexity === 'high').length;
    
    if (highComplexityPatterns > 10) {
      recommendations.push('Multiple high-complexity functions detected - consider refactoring for better maintainability');
    }
    
    return recommendations;
  }
}