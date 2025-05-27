import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import path from 'path';
import { existsSync } from 'fs';

import { ImportMapper } from '../algorithms/importMapper';
import { FrameworkDetector } from '../algorithms/frameworkDetector';
import { FileOrganizationAnalyzer } from '../algorithms/fileOrganizationAnalyzer';
import { PatternAggregator } from '../algorithms/patternAggregator';
import { CodeSimilarityAnalyzer } from '../algorithms/codeSimilarityAnalyzer';

// Environment variable for default project path
const DEFAULT_PROJECT_PATH = process.env.CODEBASE_CURATOR_PATH || process.cwd();

const server = new McpServer({
  name: 'codebase-curator',
  version: '1.0.0',
  description:
    'AI-first code analysis tool for giving AI assistants architectural context',
});

// Helper to resolve project path
function resolveProjectPath(inputPath?: string): string {
  if (!inputPath) {
    // No path provided - use the default (current context)
    return DEFAULT_PROJECT_PATH
  }

  // If it's a relative path, resolve it relative to the default path
  if (!path.isAbsolute(inputPath)) {
    return path.resolve(DEFAULT_PROJECT_PATH, inputPath)
  }

  return inputPath
}

server.tool(
  'get_codebase_overview',
  'Get a comprehensive overview of the current TypeScript/JavaScript codebase',
  {
    path: z
      .string()
      .optional()
      .describe('The path to analyze (defaults to current project)'),
    includeImports: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include import/dependency analysis'),
    includeFrameworks: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include framework detection'),
    includeOrganization: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include file organization analysis'),
    includePatterns: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include pattern aggregation'),
    includeSimilarity: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include code similarity analysis (can be slow)'),
  },
  async ({
    path: projectPath,
    includeImports,
    includeFrameworks,
    includeOrganization,
    includePatterns,
    includeSimilarity,
  }) => {
    const absolutePath = resolveProjectPath(projectPath)

    // Quick validation
    if (!existsSync(absolutePath)) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: Path does not exist: ${absolutePath}`,
          },
        ],
        isError: true,
      }
    }

    const overview: any = {
      path: absolutePath,
      analyzedAt: new Date().toISOString(),
    }

    try {
      if (includeImports) {
        const importMapper = new ImportMapper(absolutePath);
        overview.imports = await importMapper.analyze();
      }

      if (includeFrameworks) {
        const frameworkDetector = new FrameworkDetector(absolutePath);
        overview.frameworks = await frameworkDetector.detect();
      }

      if (includeOrganization) {
        const fileOrganizationAnalyzer = new FileOrganizationAnalyzer(absolutePath);
        overview.organization = await fileOrganizationAnalyzer.analyze();
      }

      if (includePatterns) {
        const patternAggregator = new PatternAggregator(absolutePath);
        overview.patterns = await patternAggregator.analyze();
      }

      if (includeSimilarity) {
        const codeSimilarityAnalyzer = new CodeSimilarityAnalyzer(absolutePath);
        overview.similarity = await codeSimilarityAnalyzer.analyze();
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(overview, null, 2),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error analyzing codebase: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      }
    }
  }
)

server.tool(
  'find_similar_patterns',
  'Find code patterns similar to a given example in the current codebase',
  {
    pattern: z
      .string()
      .describe(
        "The code pattern to search for (e.g., 'useState', 'async function', 'class.*extends')"
      ),
    path: z
      .string()
      .optional()
      .describe('The path to search (defaults to current project)'),
    includeContext: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include surrounding code context'),
    maxResults: z
      .number()
      .optional()
      .default(10)
      .describe('Maximum number of results to return'),
  },
  async ({ pattern, path: projectPath, includeContext, maxResults }) => {
    try {
      const absolutePath = resolveProjectPath(projectPath)

      if (!existsSync(absolutePath)) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Path does not exist: ${absolutePath}`,
            },
          ],
          isError: true,
        }
      }

      const patternAggregator = new PatternAggregator(absolutePath);
      const analysis = await patternAggregator.analyze();

      const matchingPatterns = []

      for (const [patternKey, details] of Object.entries(analysis.patterns)) {
        if (
          patternKey.toLowerCase().includes(pattern.toLowerCase()) ||
          details.description?.toLowerCase().includes(pattern.toLowerCase())
        ) {
          matchingPatterns.push({
            pattern: patternKey,
            count: details.count,
            files: details.files.slice(0, maxResults),
            description: details.description,
          })
        }
      }

      if (includeContext && matchingPatterns.length > 0) {
        const similarityAnalyzer = new CodeSimilarityAnalyzer(absolutePath);
        const similarity = await similarityAnalyzer.analyze();

        for (const match of matchingPatterns) {
          match.similarBlocks = similarity.duplicates
            .filter((d) => d.files.some((f) => match.files.includes(f.path)))
            .slice(0, 3)
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                searchPath: absolutePath,
                query: pattern,
                totalMatches: matchingPatterns.reduce(
                  (sum, p) => sum + p.count,
                  0
                ),
                patterns: matchingPatterns,
              },
              null,
              2
            ),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error finding patterns: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      }
    }
  }
)

server.tool(
  'suggest_integration_approach',
  'Suggest how to integrate new code or features based on existing architectural patterns',
  {
    featureDescription: z
      .string()
      .describe('Description of the feature or code to integrate'),
    featureType: z
      .enum(['component', 'service', 'utility', 'feature', 'api'])
      .optional()
      .describe('Type of feature to integrate'),
    path: z
      .string()
      .optional()
      .describe('The codebase path (defaults to current project)'),
  },
  async ({ featureDescription, featureType, path: projectPath }) => {
    try {
      const absolutePath = resolveProjectPath(projectPath)

      if (!existsSync(absolutePath)) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Path does not exist: ${absolutePath}`,
            },
          ],
          isError: true,
        }
      }

      const [frameworks, organization, patterns] = await Promise.all([
        new FrameworkDetector(absolutePath).detect(),
        new FileOrganizationAnalyzer(absolutePath).analyze(),
        new PatternAggregator(absolutePath).analyze(),
      ]);

      const suggestions = {
        codebase: absolutePath,
        feature: featureDescription,
        type: featureType,
        recommendations: [],
      }

      // Component suggestions
      if (featureType === 'component' || !featureType) {
        const isReact = frameworks.frameworks.some((f) => f.name === 'React')
        const isVue = frameworks.frameworks.some((f) => f.name === 'Vue')
        const isSvelte = frameworks.frameworks.some((f) => f.name === 'Svelte')

        if (isReact) {
          const hasHooks = patterns.patterns['React Hooks']?.count > 0
          suggestions.recommendations.push({
            type: 'component',
            approach: hasHooks
              ? 'Functional component with hooks'
              : 'Class component',
            location:
              organization.structure.componentPaths?.[0] || 'src/components',
            pattern: hasHooks
              ? 'Use useState, useEffect patterns'
              : 'Extend React.Component',
          })
        }

        if (isVue) {
          suggestions.recommendations.push({
            type: 'component',
            approach: 'Single File Component (.vue)',
            location:
              organization.structure.componentPaths?.[0] || 'src/components',
            pattern: 'Use <template>, <script>, <style> blocks',
          })
        }

        if (isSvelte) {
          suggestions.recommendations.push({
            type: 'component',
            approach: 'Svelte component (.svelte)',
            location:
              organization.structure.componentPaths?.[0] || 'src/components',
            pattern: 'Use reactive declarations with $:',
          })
        }
      }

      // Service/API suggestions
      if (featureType === 'service' || featureType === 'api' || !featureType) {
        const hasAsyncPatterns = patterns.patterns['Async/Await']?.count > 0
        const hasPromises = patterns.patterns['Promises']?.count > 0

        suggestions.recommendations.push({
          type: 'service',
          approach: hasAsyncPatterns
            ? 'Async/await pattern'
            : hasPromises
            ? 'Promise-based'
            : 'Callback-based',
          location: organization.structure.patterns.includes('domain-driven')
            ? 'src/domain/[feature]/services'
            : 'src/services',
          pattern: 'Export class or functions with clear interfaces',
        })
      }

      // Feature-based organization suggestion
      if (organization.structure.patterns.includes('feature-based')) {
        suggestions.recommendations.push({
          type: 'organization',
          approach: 'Create new feature module',
          location: `src/features/${featureDescription
            .toLowerCase()
            .replace(/\s+/g, '-')}`,
          pattern: 'Include components, services, and tests in feature folder',
        })
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(suggestions, null, 2),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error suggesting integration: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      }
    }
  }
)

server.tool(
  'check_architectural_conventions',
  "Check if a code snippet follows the codebase's architectural conventions",
  {
    codeSnippet: z.string().describe('The code snippet to check'),
    filePath: z
      .string()
      .optional()
      .describe('The intended file path for the code'),
    projectPath: z
      .string()
      .optional()
      .describe('The codebase path (defaults to current project)'),
  },
  async ({ codeSnippet, filePath, projectPath }) => {
    try {
      const absolutePath = resolveProjectPath(projectPath)

      if (!existsSync(absolutePath)) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Path does not exist: ${absolutePath}`,
            },
          ],
          isError: true,
        }
      }

      const [imports, frameworks, organization, patterns] = await Promise.all([
        new ImportMapper(absolutePath).analyze(),
        new FrameworkDetector(absolutePath).detect(),
        new FileOrganizationAnalyzer(absolutePath).analyze(),
        new PatternAggregator(absolutePath).analyze(),
      ]);

      const violations = []
      const suggestions = []

      // File location and extension checks
      if (filePath) {
        const fileExt = path.extname(filePath)
        const expectedExts = organization.analysis.fileTypes.map(
          (ft) => `.${ft.extension}`
        )

        if (!expectedExts.includes(fileExt)) {
          violations.push({
            type: 'file-extension',
            message: `File extension ${fileExt} not commonly used in this codebase`,
            suggestion: `Use one of: ${expectedExts.join(', ')}`,
          })
        }

        const fileDir = path.dirname(filePath)
        const isInCorrectLocation =
          organization.structure.componentPaths?.some((p) =>
            fileDir.includes(p)
          ) ||
          organization.structure.patterns.some((p) =>
            fileDir.toLowerCase().includes(p)
          )

        if (!isInCorrectLocation && filePath.includes('component')) {
          violations.push({
            type: 'file-location',
            message: 'Component file not in standard component directory',
            suggestion: `Place in: ${
              organization.structure.componentPaths?.[0] || 'src/components'
            }`,
          })
        }
      }

      // Import checks
      const importPattern = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g
      const codeImports = [...codeSnippet.matchAll(importPattern)].map(
        (m) => m[1]
      )

      for (const imp of codeImports) {
        if (imp.startsWith('.') || imp.startsWith('@/')) continue

        const isUsedInCodebase =
          imports.analysis.externalDependencies.includes(imp) ||
          imports.analysis.externalDependencies.some((dep) =>
            imp.startsWith(dep + '/')
          )

        if (!isUsedInCodebase) {
          suggestions.push({
            type: 'new-dependency',
            message: `Import "${imp}" not found in current dependencies`,
            suggestion: 'Ensure this dependency is added to package.json',
          })
        }
      }

      // Pattern checks
      const usesClasses = /class\s+\w+/.test(codeSnippet)
      const usesFunctional =
        /const\s+\w+\s*=\s*\(/.test(codeSnippet) ||
        /function\s+\w+/.test(codeSnippet)
      const usesHooks = /use[A-Z]\w*\(/.test(codeSnippet)

      if (frameworks.frameworks.some((f) => f.name === 'React')) {
        const hasClassComponents =
          patterns.patterns['Class Components']?.count > 0
        const hasFunctionalComponents =
          patterns.patterns['React Hooks']?.count > 0

        if (usesClasses && !hasClassComponents && hasFunctionalComponents) {
          suggestions.push({
            type: 'pattern',
            message: 'Class components not commonly used in this codebase',
            suggestion: 'Consider using functional components with hooks',
          })
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                analyzedAgainst: absolutePath,
                codeSnippet: codeSnippet.substring(0, 100) + '...',
                filePath,
                violations,
                suggestions,
                summary:
                  violations.length === 0
                    ? 'Code follows architectural conventions'
                    : `Found ${violations.length} violations and ${suggestions.length} suggestions`,
              },
              null,
              2
            ),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error checking conventions: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      }
    }
  }
)

// Add a special tool to set/get the current project context
server.tool(
  'set_project_context',
  'Set the default project path for analysis (useful when working on a specific project)',
  {
    path: z.string().describe('The project path to set as default'),
  },
  async ({ path: projectPath }) => {
    const absolutePath = path.isAbsolute(projectPath)
      ? projectPath
      : path.resolve(process.cwd(), projectPath)

    if (!existsSync(absolutePath)) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: Path does not exist: ${absolutePath}`,
          },
        ],
        isError: true,
      }
    }

    // Store in process env for this session
    process.env.CODEBASE_CURATOR_PATH = absolutePath

    return {
      content: [
        {
          type: 'text',
          text: `Project context set to: ${absolutePath}\n\nAll subsequent tool calls will use this as the default path unless overridden.`,
        },
      ],
    }
  }
)

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`Codebase Curator MCP Server running on stdio`);
  console.error(`Default project path: ${DEFAULT_PROJECT_PATH}`);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
