#!/usr/bin/env bun

/**
 * Incremental Indexing Monitor CLI
 * Real-time monitoring of file changes and reindexing activity
 */

import { IncrementalIndexer, type IndexingStatus } from './IncrementalIndexer.js';
import { type HashTreeDiff } from './HashTree.js';
import * as path from 'path';

interface MonitorStats {
  totalChanges: number;
  filesAdded: number;
  filesModified: number;
  filesDeleted: number;
  reindexOperations: number;
  startTime: number;
  lastActivity: number;
}

class IndexingMonitor {
  private indexer: IncrementalIndexer;
  private stats: MonitorStats;
  private isRunning = false;
  private updateInterval?: Timer;
  private showLiveOverview = false;
  private overviewData: any = null;
  private isUpdatingOverview = false;

  constructor(projectPath: string) {
    this.indexer = new IncrementalIndexer(projectPath);
    this.stats = {
      totalChanges: 0,
      filesAdded: 0,
      filesModified: 0,
      filesDeleted: 0,
      reindexOperations: 0,
      startTime: Date.now(),
      lastActivity: Date.now()
    };
  }

  async start(withOverview: boolean = false): Promise<void> {
    console.log('🔍 Initializing incremental indexer...');
    
    // Initialize the indexer
    await this.indexer.initialize();
    
    // Build initial index if needed
    const status = await this.indexer.getStatus();
    if (status.indexedFiles === 0) {
      console.log('📦 Building initial index...');
      await this.indexer.buildIndex();
      console.log('✅ Initial index built');
    } else {
      console.log(`📖 Loaded existing index (${status.indexedFiles} files)`);
    }

    // Start watching for changes
    await this.indexer.startWatching();
    
    // Hook into change events
    const hashTree = await this.indexer.getHashTree();
    hashTree.startWatching((diff) => {
      this.onFileChanges(diff);
    });

    this.isRunning = true;
    this.showLiveOverview = withOverview;
    
    if (withOverview) {
      console.log('👀 Monitoring file changes with live overview...\n');
      await this.updateOverviewData();
      
      // Start periodic display updates (every 2 seconds for smooth refresh)
      this.updateInterval = setInterval(async () => {
        await this.displayLiveOverview();
      }, 2000);
      
      // Display initial overview
      await this.displayLiveOverview();
    } else {
      console.log('👀 Monitoring file changes...\n');
      
      // Start periodic status updates
      this.updateInterval = setInterval(() => {
        this.displayStatus();
      }, 2000);
      
      // Display initial status
      this.displayStatus();
    }
  }

  private onFileChanges(diff: HashTreeDiff): void {
    this.stats.totalChanges++;
    this.stats.filesAdded += diff.added.length;
    this.stats.filesModified += diff.modified.length;
    this.stats.filesDeleted += diff.deleted.length;
    this.stats.reindexOperations++;
    this.stats.lastActivity = Date.now();

    // Log the specific changes
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n[${timestamp}] 📁 File Changes Detected:`);
    
    if (diff.added.length > 0) {
      console.log(`  ✅ Added (${diff.added.length}):`);
      diff.added.forEach(file => {
        console.log(`    + ${this.relativePath(file)}`);
      });
    }
    
    if (diff.modified.length > 0) {
      console.log(`  🔄 Modified (${diff.modified.length}):`);
      diff.modified.forEach(file => {
        console.log(`    ~ ${this.relativePath(file)}`);
      });
    }
    
    if (diff.deleted.length > 0) {
      console.log(`  ❌ Deleted (${diff.deleted.length}):`);
      diff.deleted.forEach(file => {
        console.log(`    - ${this.relativePath(file)}`);
      });
    }

    console.log(`  🔄 Reindexing ${diff.added.length + diff.modified.length} files...`);
    
    // Update overview data immediately when changes occur (if in live overview mode)
    if (this.showLiveOverview) {
      // Update after a small delay to allow indexing to complete
      setTimeout(async () => {
        await this.updateOverviewData();
        // Force immediate display update to show changes right away
        await this.displayLiveOverview();
      }, 1500);
    }
  }

  private async displayStatus(): Promise<void> {
    if (!this.isRunning) return;

    const status = await this.indexer.getStatus();
    const uptime = this.formatDuration(Date.now() - this.stats.startTime);
    const timeSinceLastActivity = this.formatDuration(Date.now() - this.stats.lastActivity);

    // Clear previous status (move cursor up and clear lines)
    process.stdout.write('\x1b[8A\x1b[2K\x1b[1G');

    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│               📊 INDEXING MONITOR STATUS                │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ Uptime: ${uptime.padEnd(20)} │ Watching: ${status.isWatching ? '✅' : '❌'.padEnd(15)} │`);
    console.log(`│ Total Files: ${status.totalFiles.toString().padEnd(13)} │ Indexed: ${status.indexedFiles.toString().padEnd(16)} │`);
    console.log(`│ Total Changes: ${this.stats.totalChanges.toString().padEnd(11)} │ Last Activity: ${timeSinceLastActivity.padEnd(10)} │`);
    console.log(`│ Added: ${this.stats.filesAdded.toString().padEnd(6)} Modified: ${this.stats.filesModified.toString().padEnd(6)} Deleted: ${this.stats.filesDeleted.toString().padEnd(11)} │`);
    console.log('└─────────────────────────────────────────────────────────┘');
  }

  private async updateOverviewData(): Promise<void> {
    this.isUpdatingOverview = true;
    try {
      const semanticService = await this.indexer.getSemanticService();
      const stats = semanticService.getStats();
      const allResults = semanticService.search('', { maxResults: 1000 });
      
      // Analyze by type
      const byType = new Map<string, number>();
      const byFile = new Map<string, number>();
      
      allResults.forEach(result => {
        const type = result.info.type;
        const file = result.info.location.file;
        
        byType.set(type, (byType.get(type) || 0) + 1);
        byFile.set(file, (byFile.get(file) || 0) + 1);
      });
      
      // Store the computed data
      this.overviewData = {
        stats,
        byType: Array.from(byType.entries()).sort((a, b) => b[1] - a[1]),
        byFile: Array.from(byFile.entries()).sort((a, b) => b[1] - a[1]),
        totalDeclarations: allResults.length,
        lastUpdate: Date.now()
      };
    } catch (error) {
      console.error('Error updating overview data:', error);
    } finally {
      this.isUpdatingOverview = false;
    }
  }

  private async displayLiveOverview(): Promise<void> {
    if (!this.isRunning || !this.overviewData) return;

    const status = await this.indexer.getStatus();
    const uptime = this.formatDuration(Date.now() - this.stats.startTime);
    const timeSinceLastActivity = this.formatDuration(Date.now() - this.stats.lastActivity);
    const timeSinceOverviewUpdate = this.formatDuration(Date.now() - this.overviewData.lastUpdate);

    // Clear screen and move to top
    process.stdout.write('\x1b[2J\x1b[H');

    console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                        🔥 LIVE CODEBASE MONITOR                              ║');
    console.log('╠═══════════════════════════════════════════════════════════════════════════════╣');
    
    // Status bar with update indicator
    const updateIndicator = this.isUpdatingOverview ? '🔄' : '✅';
    console.log(`║ 📊 Files: ${status.totalFiles.toString().padEnd(4)} │ Indexed: ${status.indexedFiles.toString().padEnd(4)} │ Uptime: ${uptime.padEnd(8)} │ Watching: ${status.isWatching ? '✅' : '❌'} ║`);
    console.log(`║ 📈 Changes: ${this.stats.totalChanges.toString().padEnd(3)} │ Last Activity: ${timeSinceLastActivity.padEnd(6)} │ Overview: ${updateIndicator} ${timeSinceOverviewUpdate.padEnd(6)} ago    ║`);
    console.log('╠═══════════════════════════════════════════════════════════════════════════════╣');
    
    // Live overview data
    console.log('║ 🏷️  CODE DISTRIBUTION:                                                       ║');
    
    // Show top 6 declaration types
    const topTypes = this.overviewData.byType.slice(0, 6);
    topTypes.forEach(([type, count]: [string, number]) => {
      const percentage = ((count / this.overviewData.totalDeclarations) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(count / Math.max(...this.overviewData.byType.map((t: any) => t[1])) * 25));
      const line = `║   ${type.padEnd(12)} ${count.toString().padStart(4)} (${percentage.padStart(5)}%) ${bar.padEnd(25)} ║`;
      console.log(line);
    });
    
    console.log('╠═══════════════════════════════════════════════════════════════════════════════╣');
    console.log('║ 🧠 TOP COMPLEX FILES:                                                        ║');
    
    // Show top 5 most complex files
    const topFiles = this.overviewData.byFile.slice(0, 5);
    topFiles.forEach(([file, count]: [string, number]) => {
      const relativePath = this.relativePath(file);
      const truncatedPath = relativePath.length > 55 ? '...' + relativePath.slice(-52) : relativePath;
      console.log(`║   ${truncatedPath.padEnd(55)} ${count.toString().padStart(3)} declarations ║`);
    });
    
    console.log('╠═══════════════════════════════════════════════════════════════════════════════╣');
    console.log('║ 📁 RECENT CHANGES:                                                           ║');
    
    // Show recent activity summary
    if (this.stats.totalChanges === 0) {
      console.log('║   No changes detected yet...                                                  ║');
    } else {
      console.log(`║   Total: ${this.stats.totalChanges.toString().padEnd(3)} │ Added: ${this.stats.filesAdded.toString().padEnd(3)} │ Modified: ${this.stats.filesModified.toString().padEnd(3)} │ Deleted: ${this.stats.filesDeleted.toString().padEnd(3)} │ Reindexed: ${this.stats.reindexOperations.toString().padEnd(3)} ║`);
    }
    
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
    console.log('\n💡 Live overview updates on file changes + every 2 seconds. Press Ctrl+C to stop.\n');
  }

  private relativePath(filePath: string): string {
    return path.relative(process.cwd(), filePath);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.indexer.stopWatching();
    await this.indexer.dispose();
    
    console.log('\n🛑 Monitoring stopped');
    console.log('\n📊 Final Statistics:');
    console.log(`  Total runtime: ${this.formatDuration(Date.now() - this.stats.startTime)}`);
    console.log(`  Total changes: ${this.stats.totalChanges}`);
    console.log(`  Files added: ${this.stats.filesAdded}`);
    console.log(`  Files modified: ${this.stats.filesModified}`);
    console.log(`  Files deleted: ${this.stats.filesDeleted}`);
    console.log(`  Reindex operations: ${this.stats.reindexOperations}`);
  }

  async showCodebaseOverview(): Promise<void> {
    const semanticService = await this.indexer.getSemanticService();
    const stats = semanticService.getStats();
    
    console.log('\n🏗️  CODEBASE OVERVIEW');
    console.log('═'.repeat(60));
    
    // Get all semantic information
    const allResults = semanticService.search('', { maxResults: 1000 });
    
    // Analyze by type
    const byType = new Map<string, number>();
    const byFile = new Map<string, number>();
    const complexityMetrics = new Map<string, Set<string>>();
    
    allResults.forEach(result => {
      const type = result.info.type;
      const file = result.info.location.file;
      
      byType.set(type, (byType.get(type) || 0) + 1);
      byFile.set(file, (byFile.get(file) || 0) + 1);
      
      // Track complexity by grouping related terms
      if (!complexityMetrics.has(file)) {
        complexityMetrics.set(file, new Set());
      }
      complexityMetrics.get(file)!.add(type);
    });
    
    console.log('\n📊 Code Distribution:');
    console.log(`  Total indexed entries: ${stats.totalEntries}`);
    console.log(`  Files with code: ${stats.totalFiles}`);
    
    // Show type distribution
    console.log('\n🏷️  By Declaration Type:');
    const sortedTypes = Array.from(byType.entries()).sort((a, b) => b[1] - a[1]);
    sortedTypes.slice(0, 10).forEach(([type, count]) => {
      const percentage = ((count / stats.totalEntries) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(count / Math.max(...byType.values()) * 20));
      console.log(`  ${type.padEnd(15)} ${count.toString().padStart(4)} (${percentage}%) ${bar}`);
    });
    
    // Show most complex files
    console.log('\n🧠 Most Complex Files (by declaration count):');
    const sortedFiles = Array.from(byFile.entries()).sort((a, b) => b[1] - a[1]);
    sortedFiles.slice(0, 10).forEach(([file, count]) => {
      const typeCount = complexityMetrics.get(file)?.size || 0;
      const relativePath = this.relativePath(file);
      console.log(`  ${relativePath.padEnd(40)} ${count.toString().padStart(3)} declarations, ${typeCount} types`);
    });
    
    // Architecture insights
    console.log('\n🏛️  Architecture Insights:');
    
    // Find patterns in file structure
    const directories = new Map<string, number>();
    sortedFiles.forEach(([file]) => {
      const dir = path.dirname(file);
      const relativeDir = this.relativePath(dir);
      directories.set(relativeDir, (directories.get(relativeDir) || 0) + 1);
    });
    
    const topDirs = Array.from(directories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    topDirs.forEach(([dir, fileCount]) => {
      console.log(`  📁 ${dir || '.'}: ${fileCount} files with code`);
    });
    
    // Find potential architectural patterns
    console.log('\n🔍 Detected Patterns:');
    
    const functionCount = byType.get('function') || 0;
    const classCount = byType.get('class') || 0;
    const interfaceCount = byType.get('interface') || 0;
    const typeCount = byType.get('type') || 0;
    
    if (classCount > functionCount * 0.3) {
      console.log('  📦 Object-oriented architecture detected');
    }
    if (functionCount > classCount * 2) {
      console.log('  🎯 Functional programming patterns detected');
    }
    if (interfaceCount + typeCount > (classCount + functionCount) * 0.5) {
      console.log('  🔧 Strong TypeScript typing detected');
    }
    
    // Find hot spots (highly referenced code)
    console.log('\n🔥 Code Hotspots (most referenced):');
    const searchTerms = ['function', 'class', 'interface'];
    for (const term of searchTerms) {
      const results = semanticService.search(term, { type: [term], maxResults: 5 });
      if (results.length > 0) {
        console.log(`  ${term.charAt(0).toUpperCase() + term.slice(1)}s:`);
        results.forEach(result => {
          if (result.usageCount && result.usageCount > 0) {
            console.log(`    ${result.info.term} (${result.usageCount} refs) - ${this.relativePath(result.info.location.file)}:${result.info.location.line}`);
          }
        });
      }
    }
    
    // Dependencies analysis
    console.log('\n📦 Potential Entry Points:');
    const entryPatterns = ['main', 'index', 'app', 'server', 'cli'];
    const entryFiles = sortedFiles
      .filter(([file]) => {
        const basename = path.basename(file, path.extname(file)).toLowerCase();
        return entryPatterns.some(pattern => basename.includes(pattern));
      })
      .slice(0, 5);
    
    entryFiles.forEach(([file, count]) => {
      console.log(`  📄 ${this.relativePath(file)} (${count} declarations)`);
    });
  }

  async showDetailedStatus(): Promise<void> {
    const status = await this.indexer.getStatus();
    const hashTree = await this.indexer.getHashTree();
    const semanticService = await this.indexer.getSemanticService();
    const semanticStats = semanticService.getStats();
    const integrity = await this.indexer.checkIntegrity();

    console.log('\n📋 DETAILED STATUS REPORT');
    console.log('─'.repeat(50));
    
    console.log('\n🏗️  Index Status:');
    console.log(`  Total files tracked: ${status.totalFiles}`);
    console.log(`  Files indexed: ${status.indexedFiles}`);
    console.log(`  Semantic entries: ${semanticStats.totalEntries}`);
    console.log(`  Currently watching: ${status.isWatching ? 'Yes' : 'No'}`);
    
    console.log('\n📊 Activity Statistics:');
    console.log(`  Runtime: ${this.formatDuration(Date.now() - this.stats.startTime)}`);
    console.log(`  Total changes detected: ${this.stats.totalChanges}`);
    console.log(`  Files added: ${this.stats.filesAdded}`);
    console.log(`  Files modified: ${this.stats.filesModified}`);
    console.log(`  Files deleted: ${this.stats.filesDeleted}`);
    console.log(`  Reindex operations: ${this.stats.reindexOperations}`);
    
    console.log('\n🔍 Index Integrity:');
    console.log(`  Status: ${integrity.consistent ? '✅ Consistent' : '❌ Issues found'}`);
    if (integrity.issues.length > 0) {
      integrity.issues.forEach(issue => {
        console.log(`    ⚠️  ${issue}`);
      });
    }
    
    console.log('\n💾 Storage:');
    const hashTreePath = path.join(process.cwd(), '.curator', 'semantic', 'hashtree.json');
    const indexPath = path.join(process.cwd(), '.curator', 'semantic-index.json');
    
    try {
      const hashTreeFile = Bun.file(hashTreePath);
      const hashTreeSize = (await hashTreeFile.exists()) ? 
        `${Math.round((await hashTreeFile.size()) / 1024)}KB` : 'Not found';
      console.log(`  Hash tree: ${hashTreeSize}`);
    } catch {
      console.log(`  Hash tree: Not accessible`);
    }
    
    try {
      const indexFile = Bun.file(indexPath);
      const indexSize = (await indexFile.exists()) ? 
        `${Math.round((await indexFile.size()) / 1024)}KB` : 'Not found';
      console.log(`  Semantic index: ${indexSize}`);
    } catch {
      console.log(`  Semantic index: Not accessible`);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Filter out flags to get the actual project path
  const pathArgs = args.filter(arg => !arg.startsWith('-'));
  const projectPath = pathArgs[1] || process.cwd();

  const monitor = new IndexingMonitor(projectPath);

  switch (command) {
    case 'watch':
    case 'monitor':
      console.log(`🚀 Starting incremental indexing monitor for: ${projectPath}\n`);
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n\n⏹️  Shutting down...');
        await monitor.stop();
        process.exit(0);
      });
      
      // Check if user wants live overview mode
      const withOverview = args.includes('--overview') || args.includes('-o');
      await monitor.start(withOverview);
      
      // Keep running until interrupted
      await new Promise(() => {});
      break;
      
    case 'status':
      await monitor.showDetailedStatus();
      break;
      
    case 'overview':
      console.log(`📊 Analyzing codebase: ${projectPath}\n`);
      await monitor.indexer.initialize();
      
      // Ensure we have an index
      const status = await monitor.indexer.getStatus();
      if (status.indexedFiles === 0) {
        console.log('🔨 No index found, building...');
        await monitor.indexer.buildIndex();
      }
      
      await monitor.showCodebaseOverview();
      break;
      
    case 'rebuild':
      console.log('🔨 Force rebuilding index...');
      await monitor.indexer.initialize();
      await monitor.indexer.forceRebuild();
      console.log('✅ Index rebuilt successfully');
      await monitor.showDetailedStatus();
      break;
      
    default:
      console.log('📖 Incremental Indexing Monitor');
      console.log('');
      console.log('Usage:');
      console.log('  bun run src/semantic/monitor.ts watch [project-path]           # Basic real-time monitoring');
      console.log('  bun run src/semantic/monitor.ts watch --overview [project-path] # Live monitoring + overview');
      console.log('  bun run src/semantic/monitor.ts overview [project-path]        # Static codebase overview');
      console.log('  bun run src/semantic/monitor.ts status [project-path]          # Detailed technical status');
      console.log('  bun run src/semantic/monitor.ts rebuild [project-path]         # Force rebuild index');
      console.log('');
      console.log('Examples:');
      console.log('  bun run src/semantic/monitor.ts watch                    # Basic monitoring');
      console.log('  bun run src/semantic/monitor.ts watch --overview         # Live overview dashboard');
      console.log('  bun run src/semantic/monitor.ts watch -o /path/to/project # Live overview for specific path');
      console.log('  bun run src/semantic/monitor.ts overview                 # Static analysis snapshot');
      console.log('');
      console.log('The monitor will show real-time file changes and reindexing activity.');
      console.log('Press Ctrl+C to stop monitoring.');
      break;
  }
}

if (import.meta.main) {
  main().catch(console.error);
}