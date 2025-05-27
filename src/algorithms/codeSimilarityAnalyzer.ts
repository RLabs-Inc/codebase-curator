import { Glob } from 'bun';
import { createHash } from 'crypto';
import { relative } from 'path';
import type { CodeBlock, SimilarityCluster, CodeSimilarityResult } from '../types/similarity';

export class CodeSimilarityAnalyzer {
  private rootPath: string;
  private codeBlocks: CodeBlock[] = [];
  private minBlockSize: number = 3; // minimum lines for a block
  private similarityThreshold: number = 0.8; // 80% similarity

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  async analyze(): Promise<CodeSimilarityResult> {
    // Collect all code blocks
    await this.collectCodeBlocks();
    
    // Find similar blocks
    const clusters = this.findSimilarClusters();
    
    // Generate statistics and recommendations
    const statistics = this.generateStatistics(clusters);
    const recommendations = this.generateRecommendations(clusters);
    
    return {
      clusters,
      statistics,
      recommendations
    };
  }

  private async collectCodeBlocks(): Promise<void> {
    const patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
    
    for (const pattern of patterns) {
      const glob = new Glob(pattern);
      
      for await (const file of glob.scan({
        cwd: this.rootPath,
        onlyFiles: true,
        followSymlinks: false
      })) {
        if (this.shouldSkipFile(file)) continue;
        
        await this.extractBlocksFromFile(file);
      }
    }
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
      '.d.ts'
    ];
    
    return skipPatterns.some(pattern => path.includes(pattern));
  }

  private async extractBlocksFromFile(filePath: string): Promise<void> {
    try {
      const fullPath = `${this.rootPath}/${filePath}`;
      const content = await Bun.file(fullPath).text();
      const lines = content.split('\n');
      
      // Extract functions
      this.extractFunctions(content, filePath, lines);
      
      // Extract classes and methods
      this.extractClasses(content, filePath, lines);
      
      // Extract React components
      this.extractComponents(content, filePath, lines);
      
      // Extract code blocks (if-else, try-catch, etc.)
      this.extractCodeBlocks(content, filePath, lines);
    } catch (error) {
      // Skip files that can't be read
    }
  }

  private extractFunctions(content: string, filePath: string, lines: string[]): void {
    // Function patterns
    const patterns = [
      // Named functions
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/g,
      // Arrow functions assigned to const/let
      /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>\s*{/g
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const [fullMatch, name] = match;
        const startIndex = match.index;
        
        const block = this.extractBlock(content, startIndex, lines);
        if (block && block.endLine - block.startLine >= this.minBlockSize) {
          this.codeBlocks.push({
            ...block,
            filePath: relative(this.rootPath, filePath),
            type: 'function',
            name
          });
        }
      }
    }
  }

  private extractClasses(content: string, filePath: string, lines: string[]): void {
    const classPattern = /class\s+(\w+)(?:\s+extends\s+\w+)?\s*{/g;
    let match;
    
    while ((match = classPattern.exec(content)) !== null) {
      const [, className] = match;
      const startIndex = match.index;
      
      const block = this.extractBlock(content, startIndex, lines);
      if (block && block.endLine - block.startLine >= this.minBlockSize) {
        this.codeBlocks.push({
          ...block,
          filePath: relative(this.rootPath, filePath),
          type: 'class',
          name: className
        });
        
        // Extract methods within the class
        this.extractMethodsFromClass(block.content, filePath, block.startLine);
      }
    }
  }

  private extractMethodsFromClass(classContent: string, filePath: string, classStartLine: number): void {
    const methodPattern = /(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/g;
    let match;
    
    while ((match = methodPattern.exec(classContent)) !== null) {
      const [, methodName] = match;
      if (methodName === 'constructor') continue;
      
      const methodLines = classContent.split('\n');
      const block = this.extractBlock(classContent, match.index, methodLines);
      
      if (block && block.endLine - block.startLine >= this.minBlockSize) {
        this.codeBlocks.push({
          ...block,
          filePath: relative(this.rootPath, filePath),
          startLine: classStartLine + block.startLine,
          endLine: classStartLine + block.endLine,
          type: 'method',
          name: methodName
        });
      }
    }
  }

  private extractComponents(content: string, filePath: string, lines: string[]): void {
    // React component patterns
    const componentPattern = /(?:export\s+)?(?:const|function)\s+([A-Z]\w+)\s*(?::\s*(?:React\.)?FC)?.*?=.*?(?:return\s+)?(?:\(|<)/g;
    let match;
    
    while ((match = componentPattern.exec(content)) !== null) {
      const [, componentName] = match;
      const startIndex = match.index;
      
      const block = this.extractBlock(content, startIndex, lines);
      if (block && block.endLine - block.startLine >= this.minBlockSize) {
        this.codeBlocks.push({
          ...block,
          filePath: relative(this.rootPath, filePath),
          type: 'component',
          name: componentName
        });
      }
    }
  }

  private extractCodeBlocks(content: string, filePath: string, lines: string[]): void {
    // Extract significant code blocks (if statements, loops, try-catch)
    const blockPatterns = [
      /if\s*\([^)]+\)\s*{/g,
      /for\s*\([^)]+\)\s*{/g,
      /while\s*\([^)]+\)\s*{/g,
      /try\s*{/g,
      /catch\s*\([^)]*\)\s*{/g
    ];
    
    for (const pattern of blockPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const block = this.extractBlock(content, match.index, lines);
        
        if (block && block.endLine - block.startLine >= this.minBlockSize) {
          // Only add if it's a substantial block
          const nonEmptyLines = block.content.split('\n').filter(line => line.trim()).length;
          if (nonEmptyLines >= this.minBlockSize) {
            this.codeBlocks.push({
              ...block,
              filePath: relative(this.rootPath, filePath),
              type: 'block'
            });
          }
        }
      }
    }
  }

  private extractBlock(content: string, startIndex: number, lines: string[]): Omit<CodeBlock, 'filePath' | 'type'> | null {
    let braceCount = 0;
    let inBraces = false;
    let endIndex = startIndex;
    
    // Find the opening brace
    while (endIndex < content.length && content[endIndex] !== '{') {
      endIndex++;
    }
    
    if (endIndex >= content.length) return null;
    
    // Count braces to find the matching closing brace
    for (let i = endIndex; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        inBraces = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (braceCount === 0 && inBraces) {
          endIndex = i + 1;
          break;
        }
      }
    }
    
    const blockContent = content.substring(startIndex, endIndex);
    const startLine = content.substring(0, startIndex).split('\n').length;
    const endLine = content.substring(0, endIndex).split('\n').length;
    
    // Create fingerprint
    const fingerprint = this.createFingerprint(blockContent);
    
    return {
      startLine,
      endLine,
      content: blockContent,
      fingerprint
    };
  }

  private createFingerprint(code: string): string {
    // Normalize code for comparison
    const normalized = code
      .replace(/\/\/.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/['"`]([^'"`]*?)['"`]/g, 'STRING') // Replace string literals
      .replace(/\b\d+\b/g, 'NUMBER') // Replace numbers
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Create hash
    return createHash('md5').update(normalized).digest('hex');
  }

  private findSimilarClusters(): SimilarityCluster[] {
    const clusters: SimilarityCluster[] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < this.codeBlocks.length; i++) {
      if (processed.has(i)) continue;
      
      const cluster: SimilarityCluster = {
        id: `cluster-${clusters.length + 1}`,
        similarity: 1.0,
        blocks: [this.codeBlocks[i]],
        pattern: this.codeBlocks[i].type,
        refactoringPotential: 'low'
      };
      
      processed.add(i);
      
      // Find similar blocks
      for (let j = i + 1; j < this.codeBlocks.length; j++) {
        if (processed.has(j)) continue;
        
        const similarity = this.calculateSimilarity(this.codeBlocks[i], this.codeBlocks[j]);
        
        if (similarity >= this.similarityThreshold) {
          cluster.blocks.push(this.codeBlocks[j]);
          cluster.similarity = Math.min(cluster.similarity, similarity);
          processed.add(j);
        }
      }
      
      // Only keep clusters with multiple blocks
      if (cluster.blocks.length > 1) {
        cluster.refactoringPotential = this.assessRefactoringPotential(cluster);
        cluster.suggestedName = this.suggestName(cluster);
        clusters.push(cluster);
      }
    }
    
    return clusters.sort((a, b) => b.blocks.length - a.blocks.length);
  }

  private calculateSimilarity(block1: CodeBlock, block2: CodeBlock): number {
    // Quick check: exact fingerprint match
    if (block1.fingerprint === block2.fingerprint) {
      return 1.0;
    }
    
    // Check structural similarity
    if (block1.type !== block2.type) {
      return 0;
    }
    
    // Calculate text similarity using normalized content
    const norm1 = this.normalizeForComparison(block1.content);
    const norm2 = this.normalizeForComparison(block2.content);
    
    return this.calculateTextSimilarity(norm1, norm2);
  }

  private normalizeForComparison(code: string): string {
    return code
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\b[a-zA-Z_]\w*\b/g, match => {
        // Keep keywords, replace identifiers
        const keywords = ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 
                         'return', 'try', 'catch', 'throw', 'class', 'extends', 'new'];
        return keywords.includes(match) ? match : 'IDENT';
      })
      .replace(/['"`]([^'"`]*?)['"`]/g, 'STRING')
      .replace(/\b\d+\b/g, 'NUM')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const tokens1 = text1.split(' ');
    const tokens2 = text2.split(' ');
    
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    // Jaccard similarity
    const jaccard = intersection.size / union.size;
    
    // Length similarity
    const lengthSim = Math.min(tokens1.length, tokens2.length) / Math.max(tokens1.length, tokens2.length);
    
    // Combined similarity
    return (jaccard * 0.7 + lengthSim * 0.3);
  }

  private assessRefactoringPotential(cluster: SimilarityCluster): 'high' | 'medium' | 'low' {
    const blockCount = cluster.blocks.length;
    const avgLines = cluster.blocks.reduce((sum, b) => sum + (b.endLine - b.startLine), 0) / blockCount;
    
    if (blockCount >= 5 && avgLines >= 10) return 'high';
    if (blockCount >= 3 && avgLines >= 5) return 'medium';
    return 'low';
  }

  private suggestName(cluster: SimilarityCluster): string | undefined {
    // If all blocks have the same name, use it
    const names = cluster.blocks.map(b => b.name).filter(Boolean);
    if (names.length > 0 && new Set(names).size === 1) {
      return names[0];
    }
    
    // Try to find common pattern in names
    if (names.length >= 2) {
      const commonPrefix = this.findCommonPrefix(names);
      if (commonPrefix.length > 3) {
        return commonPrefix;
      }
    }
    
    // Generate based on type and pattern
    return `${cluster.pattern}Pattern${cluster.id.split('-')[1]}`;
  }

  private findCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    if (strings.length === 1) return strings[0];
    
    let prefix = '';
    const minLength = Math.min(...strings.map(s => s.length));
    
    for (let i = 0; i < minLength; i++) {
      const char = strings[0][i];
      if (strings.every(s => s[i] === char)) {
        prefix += char;
      } else {
        break;
      }
    }
    
    return prefix;
  }

  private generateStatistics(clusters: SimilarityCluster[]): CodeSimilarityResult['statistics'] {
    const totalAnalyzedLines = this.codeBlocks.reduce((sum, block) => 
      sum + (block.endLine - block.startLine), 0
    );
    
    const duplicateLines = clusters.reduce((sum, cluster) => 
      sum + (cluster.blocks.length - 1) * 
      Math.max(...cluster.blocks.map(b => b.endLine - b.startLine)), 0
    );
    
    const highPotentialClusters = clusters.filter(c => 
      c.refactoringPotential === 'high'
    ).length;
    
    return {
      totalClusters: clusters.length,
      duplicateCode: duplicateLines,
      totalAnalyzedLines,
      duplicationRatio: totalAnalyzedLines > 0 
        ? Math.round((duplicateLines / totalAnalyzedLines) * 100) 
        : 0,
      highPotentialClusters
    };
  }

  private generateRecommendations(clusters: SimilarityCluster[]): CodeSimilarityResult['recommendations'] {
    const recommendations: CodeSimilarityResult['recommendations'] = [];
    
    // High-impact refactoring opportunities
    const highImpactClusters = clusters.filter(c => c.refactoringPotential === 'high');
    if (highImpactClusters.length > 0) {
      recommendations.push({
        type: 'refactor',
        description: `Extract ${highImpactClusters.length} duplicate code patterns into reusable functions`,
        clusters: highImpactClusters.map(c => c.id),
        estimatedImpact: 'high'
      });
    }
    
    // Component consolidation
    const componentClusters = clusters.filter(c => c.pattern === 'component' && c.blocks.length >= 3);
    if (componentClusters.length > 0) {
      recommendations.push({
        type: 'consolidate',
        description: 'Consolidate similar components into configurable base components',
        clusters: componentClusters.map(c => c.id),
        estimatedImpact: 'medium'
      });
    }
    
    // Utility extraction
    const utilityPatterns = clusters.filter(c => 
      c.pattern === 'function' && 
      c.blocks.some(b => b.content.includes('return')) &&
      c.blocks.length >= 3
    );
    if (utilityPatterns.length > 0) {
      recommendations.push({
        type: 'extract',
        description: 'Extract common utility functions to a shared module',
        clusters: utilityPatterns.map(c => c.id).slice(0, 5),
        estimatedImpact: 'medium'
      });
    }
    
    // Review complex duplications
    const complexDuplicates = clusters.filter(c => 
      c.blocks.some(b => (b.endLine - b.startLine) > 20)
    );
    if (complexDuplicates.length > 0) {
      recommendations.push({
        type: 'review',
        description: 'Review and refactor complex duplicate code blocks',
        clusters: complexDuplicates.map(c => c.id).slice(0, 3),
        estimatedImpact: 'high'
      });
    }
    
    return recommendations;
  }
}