export interface Framework {
  name: string;
  type: 'frontend' | 'backend' | 'fullstack' | 'library' | 'tool';
  confidence: number; // 0-1
  indicators: string[];
  version?: string;
}

export interface TechStack {
  frameworks: Framework[];
  languages: Map<string, number>; // language -> file count
  buildTools: string[];
  testingFrameworks: string[];
  stateManagement: string[];
  styling: string[];
  databases: string[];
  deployment: string[];
}

export interface FrameworkDetectionResult {
  techStack: TechStack;
  primaryFramework?: Framework;
  summary: {
    totalFrameworks: number;
    frontendFrameworks: number;
    backendFrameworks: number;
    confidence: number; // average confidence
  };
}