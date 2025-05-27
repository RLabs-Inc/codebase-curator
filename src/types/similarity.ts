export interface CodeBlock {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  fingerprint: string;
  type: 'function' | 'class' | 'method' | 'component' | 'block';
  name?: string;
}

export interface SimilarityCluster {
  id: string;
  similarity: number; // 0-1
  blocks: CodeBlock[];
  pattern: string;
  refactoringPotential: 'high' | 'medium' | 'low';
  suggestedName?: string;
}

export interface CodeSimilarityResult {
  clusters: SimilarityCluster[];
  statistics: {
    totalClusters: number;
    duplicateCode: number; // lines of duplicate code
    totalAnalyzedLines: number;
    duplicationRatio: number; // percentage
    highPotentialClusters: number;
  };
  recommendations: Array<{
    type: 'refactor' | 'extract' | 'consolidate' | 'review';
    description: string;
    clusters: string[]; // cluster IDs
    estimatedImpact: 'high' | 'medium' | 'low';
  }>;
}