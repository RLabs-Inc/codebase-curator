export interface CodePattern {
  type: 'function' | 'class' | 'component' | 'hook' | 'handler' | 'utility' | 'error-handling' | 'api-call' | 'state-management' | 'validation';
  signature: string;
  frequency: number;
  files: string[];
  variations: number;
  complexity: 'low' | 'medium' | 'high';
}

export interface FunctionPattern {
  name?: string;
  params: string[];
  isAsync: boolean;
  isExported: boolean;
  returnType?: string;
  bodyPattern: string;
}

export interface ComponentPattern {
  type: 'functional' | 'class';
  props: string[];
  hooks: string[];
  hasState: boolean;
  hasEffects: boolean;
}

export interface ErrorHandlingPattern {
  type: 'try-catch' | 'promise-catch' | 'error-boundary' | 'validation';
  errorTypes: string[];
  handlingStrategy: string;
}

export interface PatternAggregationResult {
  patterns: {
    functions: Map<string, CodePattern>;
    components: Map<string, CodePattern>;
    errorHandling: Map<string, CodePattern>;
    hooks: Map<string, CodePattern>;
    utilities: Map<string, CodePattern>;
  };
  statistics: {
    totalPatterns: number;
    mostFrequentPatterns: CodePattern[];
    codeReuse: number; // percentage
    inconsistentPatterns: Array<{
      pattern: string;
      variations: string[];
      suggestion: string;
    }>;
  };
  recommendations: string[];
}