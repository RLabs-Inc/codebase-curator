export interface ImportStatement {
  source: string;
  imports: string[];
  isDefault: boolean;
  isNamespace: boolean;
  isExternal: boolean;
  line: number;
}

export interface DependencyNode {
  filePath: string;
  imports: ImportStatement[];
  importedBy: string[];
  externalDependencies: string[];
  internalDependencies: string[];
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  rootFiles: string[];
  externalPackages: Set<string>;
  circularDependencies: string[][];
}

export interface ImportMapResult {
  graph: DependencyGraph;
  summary: {
    totalFiles: number;
    totalImports: number;
    externalDependencies: number;
    internalDependencies: number;
    circularDependencies: number;
  };
}

export * from './framework';
export * from './organization';
export * from './patterns';
export * from './similarity';
export * from './config';