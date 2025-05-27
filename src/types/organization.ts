export interface DirectoryPattern {
  path: string;
  type: 'component' | 'feature' | 'utility' | 'config' | 'test' | 'asset' | 'route' | 'service' | 'model' | 'style' | 'documentation' | 'other';
  confidence: number;
  fileCount: number;
  subDirectories: string[];
  fileTypes: Map<string, number>;
}

export interface OrganizationPattern {
  name: string;
  description: string;
  confidence: number;
  indicators: string[];
}

export interface FileOrganizationResult {
  structure: {
    rootDirectories: DirectoryPattern[];
    depth: number;
    totalFiles: number;
    totalDirectories: number;
  };
  patterns: {
    architecture: 'feature-based' | 'layer-based' | 'domain-driven' | 'mixed' | 'unknown';
    componentOrganization: 'atomic' | 'by-feature' | 'by-type' | 'mixed' | 'none';
    testingStrategy: 'colocated' | 'separate-directory' | 'mixed' | 'none';
    configLocation: 'root' | 'config-directory' | 'distributed' | 'mixed';
  };
  conventions: {
    namingConventions: {
      components: 'PascalCase' | 'camelCase' | 'kebab-case' | 'mixed';
      files: 'PascalCase' | 'camelCase' | 'kebab-case' | 'snake_case' | 'mixed';
      directories: 'PascalCase' | 'camelCase' | 'kebab-case' | 'snake_case' | 'mixed';
    };
    indexFiles: boolean;
    barrelExports: boolean;
    testFileSuffix: string[];
  };
  insights: string[];
}