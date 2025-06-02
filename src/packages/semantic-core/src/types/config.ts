export interface CuratorConfig {
  // Patterns to exclude from analysis (in addition to defaults)
  exclude?: string[]

  // Patterns to explicitly include (overrides defaults but not user excludes)
  include?: string[]

  // Output preferences
  output?: {
    // Where to save analysis results in curator mode
    curatorDir?: string // defaults to .curator
  }
}

// TODO Include more specific types for analysis settings as we add more languages
// Default exclusions - only things that are definitely not source code
export const DEFAULT_EXCLUSIONS = [
  'node_modules', // npm/yarn/pnpm dependencies
  '.git', // version control
  'dist', // common build output
  'build', // common build output
  'out', // common build output
  'coverage', // test coverage reports
  '.next', // Next.js build cache
  '.nuxt', // Nuxt build cache
  '.cache', // various tools cache
  '.turbo', // Turborepo cache
  '.parcel-cache', // Parcel bundler cache
  '*.log', // log files
  '.DS_Store', // macOS metadata
  'thumbs.db', // Windows metadata
  '.vscode', // VS Code settings
  '.idea', // JetBrains IDE settings

  // Python exclusions
  '__pycache__', // Python bytecode cache
  '*.pyc', // Python compiled files
  '*.pyo', // Python optimized compiled files
  '.pytest_cache', // pytest cache
  '.mypy_cache', // mypy type checker cache
  'venv/', // virtual environment directory
  'env/', // virtual environment directory
  '.env/', // virtual environment directory  
  'virtualenv/', // virtual environment directory
  '.Python', // Python build artifacts
  'pip-log.txt', // pip logs
  'pip-delete-this-directory.txt', // pip temp
  '.tox', // tox testing
  '.coverage', // coverage.py
  '.hypothesis', // hypothesis testing
  'htmlcov', // coverage html reports
  '.pytype', // pytype static analyzer
  'poetry.lock', // poetry lock file (debatable, but usually not analyzed)
  '*.egg-info', // Python package info
  '*.egg', // Python eggs

  // Go exclusions
  'vendor', // Go vendored dependencies
  '*.exe', // Go compiled binaries (Windows)
  '*.dll', // Go compiled libraries (Windows)
  '*.so', // Go compiled libraries (Linux)
  '*.dylib', // Go compiled libraries (macOS)
  '*.test', // Go test binaries
  '*.out', // Go default output
  'go.sum', // Go checksum file (not source code)
  '.go-version', // Go version file
]
