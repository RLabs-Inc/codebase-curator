#!/usr/bin/env bun

import { ImportMapper } from './algorithms/importMapper';
import { FrameworkDetector } from './algorithms/frameworkDetector';
import { FileOrganizationAnalyzer } from './algorithms/fileOrganizationAnalyzer';
import { PatternAggregator } from './algorithms/patternAggregator';
import { CodeSimilarityAnalyzer } from './algorithms/codeSimilarityAnalyzer';
import { resolve, join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

interface CLIArgs {
  path: string;
  command: 'imports' | 'frameworks' | 'organization' | 'patterns' | 'similarity' | 'all';
  output?: 'json' | 'summary' | 'detailed';
  help?: boolean;
  quiet?: boolean;
  curator?: boolean;
  exclude?: string[];
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = { 
    path: '', 
    command: 'all',
    output: 'summary' 
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-h':
      case '--help':
        result.help = true;
        break;
      case '-o':
      case '--output':
        const format = args[++i];
        if (format === 'json' || format === 'summary' || format === 'detailed') {
          result.output = format;
        }
        break;
      case '-q':
      case '--quiet':
        result.quiet = true;
        break;
      case '--curator':
        result.curator = true;
        result.quiet = true; // Curator mode implies quiet
        result.output = 'json'; // Curator mode implies JSON output
        break;
      case '-e':
      case '--exclude':
        const patterns = args[++i];
        if (patterns) {
          // Support comma-separated patterns
          const excludePatterns = patterns.split(',').map(p => p.trim());
          result.exclude = result.exclude ? [...result.exclude, ...excludePatterns] : excludePatterns;
        }
        break;
      case 'imports':
      case 'frameworks':
      case 'organization':
      case 'patterns':
      case 'similarity':
      case 'all':
        result.command = args[i] as any;
        break;
      default:
        if (!args[i].startsWith('-')) {
          result.path = args[i];
        }
    }
  }
  
  return result;
}

function printHelp() {
  console.log(`
Codebase Curator - AI-First Code Analysis Tool

Usage: bun run src/cli.ts [command] [options] <path>

Commands:
  imports       Analyze import dependencies only
  frameworks    Detect frameworks and libraries only
  organization  Analyze file organization patterns only
  patterns      Aggregate code patterns using AST analysis
  similarity    Find similar code blocks and duplication
  all           Run all analyses (default)

Options:
  -h, --help              Show this help message
  -o, --output <format>   Output format: json, summary, or detailed (default: summary)
  -q, --quiet             Suppress informational output (useful for piping)
  -e, --exclude <patterns> Exclude directories/files matching patterns (comma-separated)
                          Can be used multiple times. Example: --exclude docs,examples
                          Default exclusions: node_modules, .git, dist, build, etc.

Examples:
  bun run src/cli.ts .
  bun run src/cli.ts imports /path/to/project --output detailed
  bun run src/cli.ts frameworks ./my-app -o json
  bun run src/cli.ts all . -o summary
`);
}

function printImportSummary(result: any) {
  console.log('\n📊 Import Dependency Analysis\n');
  console.log(`📁 Total Files: ${result.summary.totalFiles}`);
  console.log(`📦 Total Imports: ${result.summary.totalImports}`);
  console.log(`🌐 External Dependencies: ${result.summary.externalDependencies}`);
  console.log(`🔗 Internal Dependencies: ${result.summary.internalDependencies}`);
  console.log(`🔄 Circular Dependencies: ${result.summary.circularDependencies}`);
  
  if (result.graph.externalPackages.size > 0) {
    console.log('\n📚 External Packages:');
    const packages = Array.from(result.graph.externalPackages).sort();
    packages.slice(0, 10).forEach(pkg => console.log(`  - ${pkg}`));
    if (packages.length > 10) {
      console.log(`  ... and ${packages.length - 10} more`);
    }
  }
  
  if (result.graph.circularDependencies.length > 0) {
    console.log('\n⚠️  Circular Dependencies:');
    result.graph.circularDependencies.slice(0, 3).forEach((cycle, i) => {
      console.log(`  ${i + 1}. ${cycle.join(' → ')}`);
    });
  }
}

function printFrameworkSummary(result: any) {
  console.log('\n🛠️  Technology Stack Analysis\n');
  
  if (result.primaryFramework) {
    console.log(`🎯 Primary Framework: ${result.primaryFramework.name} (${Math.round(result.primaryFramework.confidence * 100)}% confidence)`);
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`  Total Frameworks: ${result.summary.totalFrameworks}`);
  console.log(`  Frontend: ${result.summary.frontendFrameworks}`);
  console.log(`  Backend: ${result.summary.backendFrameworks}`);
  console.log(`  Average Confidence: ${Math.round(result.summary.confidence * 100)}%`);
  
  if (result.techStack.frameworks.length > 0) {
    console.log('\n🔧 Detected Frameworks:');
    result.techStack.frameworks.forEach(fw => {
      const confidence = Math.round(fw.confidence * 100);
      const version = fw.version ? ` (${fw.version})` : '';
      console.log(`  - ${fw.name}${version} [${fw.type}] - ${confidence}% confidence`);
      if (fw.indicators.length > 0) {
        console.log(`    Evidence: ${fw.indicators.join(', ')}`);
      }
    });
  }
  
  if (result.techStack.languages.size > 0) {
    console.log('\n💻 Languages:');
    const sortedLangs = Array.from(result.techStack.languages.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    sortedLangs.forEach(([lang, count]) => {
      console.log(`  - ${lang}: ${count} files`);
    });
  }
  
  if (result.techStack.buildTools.length > 0) {
    console.log('\n🏗️  Build Tools:', result.techStack.buildTools.join(', '));
  }
  
  if (result.techStack.testingFrameworks.length > 0) {
    console.log('🧪 Testing:', result.techStack.testingFrameworks.join(', '));
  }
  
  if (result.techStack.stateManagement.length > 0) {
    console.log('📦 State Management:', result.techStack.stateManagement.join(', '));
  }
  
  if (result.techStack.styling.length > 0) {
    console.log('🎨 Styling:', result.techStack.styling.join(', '));
  }
  
  if (result.techStack.databases.length > 0) {
    console.log('🗄️  Databases:', result.techStack.databases.join(', '));
  }
  
  if (result.techStack.deployment.length > 0) {
    console.log('🚀 Deployment:', result.techStack.deployment.join(', '));
  }
}

function printOrganizationSummary(result: any) {
  console.log('\n📁 File Organization Analysis\n');
  
  // Structure overview
  console.log(`📊 Structure Overview:`);
  console.log(`  Total Files: ${result.structure.totalFiles}`);
  console.log(`  Total Directories: ${result.structure.totalDirectories}`);
  console.log(`  Max Depth: ${result.structure.depth} levels`);
  
  // Architecture pattern
  console.log(`\n🏗️  Architecture: ${result.patterns.architecture}`);
  console.log(`  Component Organization: ${result.patterns.componentOrganization}`);
  console.log(`  Testing Strategy: ${result.patterns.testingStrategy}`);
  console.log(`  Config Location: ${result.patterns.configLocation}`);
  
  // Root directories
  if (result.structure.rootDirectories.length > 0) {
    console.log('\n📂 Key Directories:');
    result.structure.rootDirectories.slice(0, 8).forEach(dir => {
      console.log(`  - /${dir.path} [${dir.type}] - ${dir.fileCount} files`);
    });
  }
  
  // Naming conventions
  console.log('\n✏️  Naming Conventions:');
  console.log(`  Components: ${result.conventions.namingConventions.components}`);
  console.log(`  Files: ${result.conventions.namingConventions.files}`);
  console.log(`  Directories: ${result.conventions.namingConventions.directories}`);
  
  // Other conventions
  if (result.conventions.indexFiles) {
    console.log(`  ✓ Uses index files`);
  }
  if (result.conventions.barrelExports) {
    console.log(`  ✓ Uses barrel exports`);
  }
  if (result.conventions.testFileSuffix.length > 0) {
    console.log(`  Test files: ${result.conventions.testFileSuffix.join(', ')}`);
  }
  
  // Insights
  if (result.insights.length > 0) {
    console.log('\n💡 Insights:');
    result.insights.forEach(insight => console.log(`  ${insight}`));
  }
}

function printPatternSummary(result: any) {
  console.log('\n🔍 Code Pattern Analysis\n');
  
  // Statistics
  console.log(`📊 Pattern Statistics:`);
  console.log(`  Total Patterns: ${result.statistics.totalPatterns}`);
  console.log(`  Code Reuse: ${result.statistics.codeReuse}%`);
  
  // Most frequent patterns
  if (result.statistics.mostFrequentPatterns.length > 0) {
    console.log('\n🔥 Most Frequent Patterns:');
    result.statistics.mostFrequentPatterns.slice(0, 5).forEach((pattern, i) => {
      console.log(`  ${i + 1}. ${pattern.signature} - ${pattern.frequency} occurrences in ${pattern.files.length} files`);
    });
  }
  
  // Pattern breakdown
  const categories = ['functions', 'components', 'errorHandling', 'hooks', 'utilities'];
  console.log('\n📋 Pattern Categories:');
  
  categories.forEach(category => {
    const count = result.patterns[category]?.size || 0;
    if (count > 0) {
      const emoji = {
        functions: '⚡',
        components: '🧩',
        errorHandling: '🛡️',
        hooks: '🪝',
        utilities: '🔧'
      }[category] || '📌';
      
      console.log(`  ${emoji} ${category}: ${count} patterns`);
    }
  });
  
  // Inconsistent patterns
  if (result.statistics.inconsistentPatterns.length > 0) {
    console.log('\n⚠️  Inconsistent Patterns:');
    result.statistics.inconsistentPatterns.forEach(inc => {
      console.log(`  - ${inc.pattern}`);
      console.log(`    Variations: ${inc.variations.length}`);
      console.log(`    💡 ${inc.suggestion}`);
    });
  }
  
  // Recommendations
  if (result.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    result.recommendations.forEach(rec => console.log(`  - ${rec}`));
  }
}

function printSimilaritySummary(result: any) {
  console.log('\n🔬 Code Similarity Analysis\n');
  
  // Statistics
  console.log(`📊 Duplication Statistics:`);
  console.log(`  Total Clusters: ${result.statistics.totalClusters}`);
  console.log(`  Duplicate Lines: ${result.statistics.duplicateCode}`);
  console.log(`  Total Analyzed: ${result.statistics.totalAnalyzedLines} lines`);
  console.log(`  Duplication Ratio: ${result.statistics.duplicationRatio}%`);
  console.log(`  High-Impact Clusters: ${result.statistics.highPotentialClusters}`);
  
  // Top clusters
  if (result.clusters.length > 0) {
    console.log('\n🎯 Top Duplication Clusters:');
    result.clusters.slice(0, 5).forEach((cluster, i) => {
      const avgLines = Math.round(
        cluster.blocks.reduce((sum, b) => sum + (b.endLine - b.startLine), 0) / cluster.blocks.length
      );
      console.log(`  ${i + 1}. ${cluster.suggestedName || cluster.id}`);
      console.log(`     - ${cluster.blocks.length} duplicates (~${avgLines} lines each)`);
      console.log(`     - ${Math.round(cluster.similarity * 100)}% similarity`);
      console.log(`     - Refactoring potential: ${cluster.refactoringPotential}`);
      console.log(`     - Files: ${[...new Set(cluster.blocks.map(b => b.filePath))].slice(0, 3).join(', ')}${cluster.blocks.length > 3 ? '...' : ''}`);
    });
  }
  
  // Recommendations
  if (result.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    result.recommendations.forEach(rec => {
      const icon = {
        refactor: '♻️',
        extract: '📤',
        consolidate: '🔗',
        review: '👀'
      }[rec.type] || '📌';
      
      console.log(`  ${icon} ${rec.description}`);
      console.log(`     Impact: ${rec.estimatedImpact}`);
    });
  }
}

async function main() {
  const args = parseArgs();
  
  if (args.help || !args.path) {
    printHelp();
    process.exit(0);
  }
  
  const targetPath = resolve(args.path);
  
  if (!args.quiet) {
    console.log(`🔍 Analyzing codebase at: ${targetPath}`);
  }
  
  try {
    let importResult: any = null;
    let frameworkResult: any = null;
    let organizationResult: any = null;
    let patternResult: any = null;
    let similarityResult: any = null;
    
    // Run import analysis if needed
    if (args.command === 'imports' || args.command === 'all') {
      const mapper = new ImportMapper(targetPath, undefined, args.exclude);
      importResult = await mapper.analyze();
    }
    
    // Run framework detection if needed
    if (args.command === 'frameworks' || args.command === 'all') {
      const detector = new FrameworkDetector(targetPath, importResult);
      frameworkResult = await detector.detect();
    }
    
    // Run organization analysis if needed
    if (args.command === 'organization' || args.command === 'all') {
      const analyzer = new FileOrganizationAnalyzer(targetPath);
      organizationResult = await analyzer.analyze();
    }
    
    // Run pattern analysis if needed
    if (args.command === 'patterns' || args.command === 'all') {
      const aggregator = new PatternAggregator(targetPath);
      patternResult = await aggregator.analyze();
    }
    
    // Run similarity analysis if needed
    if (args.command === 'similarity' || args.command === 'all') {
      const analyzer = new CodeSimilarityAnalyzer(targetPath);
      similarityResult = await analyzer.analyze();
    }
    
    // Output results
    switch (args.output) {
      case 'json':
        const output: any = {};
        if (importResult) {
          output.imports = {
            ...importResult,
            graph: {
              ...importResult.graph,
              nodes: Array.from(importResult.graph.nodes.entries()).map(([k, v]) => ({
                filePath: k,
                ...v
              })),
              externalPackages: Array.from(importResult.graph.externalPackages)
            }
          };
        }
        if (frameworkResult) {
          output.frameworks = {
            ...frameworkResult,
            techStack: {
              ...frameworkResult.techStack,
              languages: Array.from(frameworkResult.techStack.languages.entries())
            }
          };
        }
        if (organizationResult) {
          output.organization = organizationResult;
        }
        if (patternResult) {
          output.patterns = {
            ...patternResult,
            patterns: {
              functions: Array.from(patternResult.patterns.functions.entries()),
              components: Array.from(patternResult.patterns.components.entries()),
              errorHandling: Array.from(patternResult.patterns.errorHandling.entries()),
              hooks: Array.from(patternResult.patterns.hooks.entries()),
              utilities: Array.from(patternResult.patterns.utilities.entries())
            }
          };
        }
        if (similarityResult) {
          output.similarity = similarityResult;
        }
        
        // In curator mode, save to file instead of stdout
        if (args.curator) {
          const curatorDir = join(targetPath, '.curator');
          if (!existsSync(curatorDir)) {
            mkdirSync(curatorDir, { recursive: true });
          }
          
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `${args.command}-${timestamp}.json`;
          const filepath = join(curatorDir, filename);
          
          writeFileSync(filepath, JSON.stringify(output, null, 2));
          
          // Output just the filepath for the curator to read
          console.log(filepath);
        } else {
          console.log(JSON.stringify(output, null, 2));
        }
        break;
        
      case 'detailed':
      case 'summary':
      default:
        if (importResult) {
          printImportSummary(importResult);
        }
        if (frameworkResult) {
          printFrameworkSummary(frameworkResult);
        }
        if (organizationResult) {
          printOrganizationSummary(organizationResult);
        }
        if (patternResult) {
          printPatternSummary(patternResult);
        }
        if (similarityResult) {
          printSimilaritySummary(similarityResult);
        }
    }
  } catch (error) {
    console.error('❌ Error analyzing codebase:', error);
    process.exit(1);
  }
}

main();