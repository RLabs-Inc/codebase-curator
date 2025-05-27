export interface CuratorConfig {
  // Patterns to exclude from analysis (in addition to defaults)
  exclude?: string[];
  
  // Patterns to explicitly include (overrides defaults but not user excludes)
  include?: string[];
  
  // Analysis-specific settings
  analysis?: {
    imports?: {
      includeDevDependencies?: boolean;
      trackDynamicImports?: boolean;
    };
    frameworks?: {
      detectTestFrameworks?: boolean;
    };
    patterns?: {
      minPatternFrequency?: number;
    };
    similarity?: {
      minSimilarityThreshold?: number;
    };
  };
  
  // Output preferences
  output?: {
    // Where to save analysis results in curator mode
    curatorDir?: string; // defaults to .curator
  };
}

// Default exclusions - only things that are definitely not source code
export const DEFAULT_EXCLUSIONS = [
  'node_modules',     // npm/yarn/pnpm dependencies
  '.git',            // version control
  'dist',            // common build output
  'build',           // common build output
  'out',             // common build output
  'coverage',        // test coverage reports
  '.next',           // Next.js build cache
  '.nuxt',           // Nuxt build cache
  '.cache',          // various tools cache
  '.turbo',          // Turborepo cache
  '.parcel-cache',   // Parcel bundler cache
  '*.log',           // log files
  '.DS_Store',       // macOS metadata
  'thumbs.db',       // Windows metadata
  '.vscode',         // VS Code settings
  '.idea'            // JetBrains IDE settings
];