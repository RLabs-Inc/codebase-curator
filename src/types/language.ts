/**
 * Language System Types
 * Defines the interfaces for the modular language expansion framework
 */

import type { ImportStatement } from "./index";
import type { Framework } from "./framework";
import type { CodePattern } from "./patterns";

/**
 * Represents a programming language and its characteristics
 */
export interface Language {
  /** Unique identifier for the language */
  name: string;

  /** Display name for UI/logs */
  displayName: string;

  /** File extensions associated with this language */
  extensions: string[];

  /** Common import statement patterns */
  importPatterns: RegExp[];

  /** Export statement patterns */
  exportPatterns: RegExp[];

  /** Function definition patterns */
  functionPatterns: RegExp[];

  /** Class definition patterns */
  classPatterns: RegExp[];

  /** Single-line comment pattern */
  singleLineComment?: string;

  /** Multi-line comment patterns */
  multiLineComment?: {
    start: string;
    end: string;
  };
}

/**
 * Language plugin interface that all language implementations must follow
 */
export interface LanguagePlugin {
  /** Language definition */
  language: Language;

  /** Parse import statements from source code */
  parseImports(content: string, filePath: string): ImportStatement[];

  /** Detect frameworks from dependencies and code patterns */
  detectFrameworks(
    dependencies: string[],
    fileContents?: Map<string, string>,
  ): Framework[];

  /** Extract code patterns from source */
  extractPatterns(content: string, filePath: string): CodePattern[];

  /** Get glob pattern for finding source files */
  getFilePattern(): string;

  /** Parse function definitions */
  parseFunctions?(content: string): FunctionDefinition[];

  /** Parse class definitions */
  parseClasses?(content: string): ClassDefinition[];

  /** Language-specific AST parsing (optional) */
  parseAST?(content: string): any;
}

/**
 * Registry for managing language plugins
 */
export interface LanguageRegistry {
  /** Register a new language plugin */
  register(plugin: LanguagePlugin): void;

  /** Get plugin by language name */
  getPlugin(language: string): LanguagePlugin | null;

  /** Get plugin by file extension */
  getPluginByExtension(ext: string): LanguagePlugin | null;

  /** Get all registered languages */
  getAllLanguages(): Language[];

  /** Get combined file pattern for all languages */
  getCombinedFilePattern(): string;

  /** Check if a file is supported */
  isFileSupported(filePath: string): boolean;
}

/**
 * Function definition structure
 */
export interface FunctionDefinition {
  name: string;
  params: string[];
  returnType?: string;
  isAsync?: boolean;
  isExported?: boolean;
  line: number;
}

/**
 * Class definition structure
 */
export interface ClassDefinition {
  name: string;
  extends?: string;
  implements?: string[];
  isExported?: boolean;
  isAbstract?: boolean;
  line: number;
  methods?: FunctionDefinition[];
}

/**
 * Language detection result
 */
export interface LanguageDetection {
  language: string;
  confidence: number;
  indicators: string[];
}

/**
 * Options for language plugin initialization
 */
export interface LanguagePluginOptions {
  /** Root path of the project */
  rootPath: string;

  /** Custom file exclusions */
  exclusions?: string[];

  /** Language-specific configuration */
  config?: Record<string, any>;
}
