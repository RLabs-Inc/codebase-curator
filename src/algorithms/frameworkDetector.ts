import { Glob } from 'bun';
import { join, extname } from 'path';
import type { Framework, TechStack, FrameworkDetectionResult } from '../types/framework';
import type { ImportMapResult } from '../types';

export class FrameworkDetector {
  private rootPath: string;
  private importMap?: ImportMapResult;
  
  constructor(rootPath: string, importMap?: ImportMapResult) {
    this.rootPath = rootPath;
    this.importMap = importMap;
  }

  async detect(): Promise<FrameworkDetectionResult> {
    const techStack: TechStack = {
      frameworks: [],
      languages: new Map(),
      buildTools: [],
      testingFrameworks: [],
      stateManagement: [],
      styling: [],
      databases: [],
      deployment: []
    };

    // Detect based on multiple sources
    await Promise.all([
      this.detectFromPackageJson(techStack),
      this.detectFromImports(techStack),
      this.detectFromFilePatterns(techStack),
      this.detectLanguages(techStack)
    ]);

    // Deduplicate and sort frameworks by confidence
    techStack.frameworks = this.deduplicateFrameworks(techStack.frameworks);
    
    return this.generateResult(techStack);
  }

  private async detectFromPackageJson(techStack: TechStack): Promise<void> {
    try {
      const packageJsonPath = join(this.rootPath, 'package.json');
      const file = Bun.file(packageJsonPath);
      
      if (await file.exists()) {
        const packageJson = await file.json();
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
          ...packageJson.peerDependencies
        };

        // Framework detection rules
        const frameworkRules: Array<{
          packages: string[];
          framework: Omit<Framework, 'confidence' | 'indicators'>;
          confidence: number;
        }> = [
          // Frontend frameworks
          {
            packages: ['react', 'react-dom'],
            framework: { name: 'React', type: 'frontend' },
            confidence: 1.0
          },
          {
            packages: ['next'],
            framework: { name: 'Next.js', type: 'fullstack' },
            confidence: 1.0
          },
          {
            packages: ['vue'],
            framework: { name: 'Vue.js', type: 'frontend' },
            confidence: 1.0
          },
          {
            packages: ['nuxt'],
            framework: { name: 'Nuxt.js', type: 'fullstack' },
            confidence: 1.0
          },
          {
            packages: ['@angular/core'],
            framework: { name: 'Angular', type: 'frontend' },
            confidence: 1.0
          },
          {
            packages: ['svelte'],
            framework: { name: 'Svelte', type: 'frontend' },
            confidence: 1.0
          },
          {
            packages: ['@sveltejs/kit'],
            framework: { name: 'SvelteKit', type: 'fullstack' },
            confidence: 1.0
          },
          
          // Backend frameworks
          {
            packages: ['express'],
            framework: { name: 'Express.js', type: 'backend' },
            confidence: 0.9
          },
          {
            packages: ['fastify'],
            framework: { name: 'Fastify', type: 'backend' },
            confidence: 0.9
          },
          {
            packages: ['koa'],
            framework: { name: 'Koa', type: 'backend' },
            confidence: 0.9
          },
          {
            packages: ['hapi'],
            framework: { name: 'Hapi', type: 'backend' },
            confidence: 0.9
          },
          {
            packages: ['@nestjs/core'],
            framework: { name: 'NestJS', type: 'backend' },
            confidence: 1.0
          },
          
          // Build tools
          {
            packages: ['webpack'],
            framework: { name: 'Webpack', type: 'tool' },
            confidence: 0.8
          },
          {
            packages: ['vite'],
            framework: { name: 'Vite', type: 'tool' },
            confidence: 0.9
          },
          {
            packages: ['parcel'],
            framework: { name: 'Parcel', type: 'tool' },
            confidence: 0.8
          },
          {
            packages: ['rollup'],
            framework: { name: 'Rollup', type: 'tool' },
            confidence: 0.8
          },
          {
            packages: ['esbuild'],
            framework: { name: 'esbuild', type: 'tool' },
            confidence: 0.8
          },
          {
            packages: ['turbo'],
            framework: { name: 'Turborepo', type: 'tool' },
            confidence: 0.9
          }
        ];

        // Check each rule
        for (const rule of frameworkRules) {
          const hasPackages = rule.packages.every(pkg => pkg in allDeps);
          if (hasPackages) {
            const indicators = rule.packages.map(pkg => `package.json: ${pkg}`);
            const version = allDeps[rule.packages[0]];
            
            techStack.frameworks.push({
              ...rule.framework,
              confidence: rule.confidence,
              indicators,
              version: version || undefined
            });

            // Add to specific categories
            if (rule.framework.type === 'tool') {
              if (rule.framework.name === 'Turborepo') {
                techStack.buildTools.push('Turborepo (Monorepo)');
              } else {
                techStack.buildTools.push(rule.framework.name);
              }
            }
          }
        }

        // Detect testing frameworks
        const testingFrameworks = [
          { packages: ['jest'], name: 'Jest' },
          { packages: ['mocha'], name: 'Mocha' },
          { packages: ['vitest'], name: 'Vitest' },
          { packages: ['@testing-library/react'], name: 'React Testing Library' },
          { packages: ['cypress'], name: 'Cypress' },
          { packages: ['playwright'], name: 'Playwright' },
          { packages: ['puppeteer'], name: 'Puppeteer' }
        ];

        for (const tf of testingFrameworks) {
          if (tf.packages.every(pkg => pkg in allDeps)) {
            techStack.testingFrameworks.push(tf.name);
          }
        }

        // Detect state management
        const stateManagement = [
          { packages: ['redux'], name: 'Redux' },
          { packages: ['mobx'], name: 'MobX' },
          { packages: ['zustand'], name: 'Zustand' },
          { packages: ['jotai'], name: 'Jotai' },
          { packages: ['recoil'], name: 'Recoil' },
          { packages: ['valtio'], name: 'Valtio' },
          { packages: ['pinia'], name: 'Pinia' },
          { packages: ['vuex'], name: 'Vuex' }
        ];

        for (const sm of stateManagement) {
          if (sm.packages.every(pkg => pkg in allDeps)) {
            techStack.stateManagement.push(sm.name);
          }
        }

        // Detect styling
        const styling = [
          { packages: ['tailwindcss'], name: 'Tailwind CSS' },
          { packages: ['styled-components'], name: 'Styled Components' },
          { packages: ['@emotion/react', '@emotion/styled'], name: 'Emotion' },
          { packages: ['sass'], name: 'Sass' },
          { packages: ['less'], name: 'Less' },
          { packages: ['stylus'], name: 'Stylus' },
          { packages: ['@mui/material'], name: 'Material-UI' },
          { packages: ['antd'], name: 'Ant Design' },
          { packages: ['bootstrap'], name: 'Bootstrap' },
          { packages: ['bulma'], name: 'Bulma' }
        ];

        for (const style of styling) {
          if (style.packages.some(pkg => pkg in allDeps)) {
            techStack.styling.push(style.name);
          }
        }

        // Detect databases
        const databases = [
          { packages: ['mongoose'], name: 'MongoDB (Mongoose)' },
          { packages: ['mongodb'], name: 'MongoDB' },
          { packages: ['pg'], name: 'PostgreSQL' },
          { packages: ['mysql', 'mysql2'], name: 'MySQL' },
          { packages: ['sqlite3'], name: 'SQLite' },
          { packages: ['redis'], name: 'Redis' },
          { packages: ['prisma'], name: 'Prisma' },
          { packages: ['typeorm'], name: 'TypeORM' },
          { packages: ['sequelize'], name: 'Sequelize' },
          { packages: ['knex'], name: 'Knex.js' }
        ];

        for (const db of databases) {
          if (db.packages.some(pkg => pkg in allDeps)) {
            techStack.databases.push(db.name);
          }
        }
      }
    } catch (error) {
      // No package.json or error reading it
    }
  }

  private async detectFromImports(techStack: TechStack): Promise<void> {
    if (!this.importMap) return;

    const importCounts = new Map<string, number>();
    
    // Count imports
    for (const pkg of this.importMap.graph.externalPackages) {
      let count = 0;
      for (const node of this.importMap.graph.nodes.values()) {
        count += node.externalDependencies.filter(dep => dep === pkg).length;
      }
      importCounts.set(pkg, count);
    }

    // Framework detection from imports
    const importRules: Array<{
      packages: string[];
      framework: Omit<Framework, 'confidence' | 'indicators'>;
      minImports: number;
    }> = [
      {
        packages: ['react', 'react-dom'],
        framework: { name: 'React', type: 'frontend' },
        minImports: 3
      },
      {
        packages: ['vue'],
        framework: { name: 'Vue.js', type: 'frontend' },
        minImports: 3
      },
      {
        packages: ['express'],
        framework: { name: 'Express.js', type: 'backend' },
        minImports: 1
      }
    ];

    for (const rule of importRules) {
      const totalImports = rule.packages.reduce(
        (sum, pkg) => sum + (importCounts.get(pkg) || 0), 
        0
      );
      
      if (totalImports >= rule.minImports) {
        const confidence = Math.min(0.9, 0.5 + (totalImports / 20));
        const indicators = rule.packages
          .filter(pkg => importCounts.has(pkg))
          .map(pkg => `imported ${importCounts.get(pkg)} times`);
        
        techStack.frameworks.push({
          ...rule.framework,
          confidence,
          indicators
        });
      }
    }
  }

  private async detectFromFilePatterns(techStack: TechStack): Promise<void> {
    // Check for Tailwind CSS v4 in CSS files
    await this.detectTailwindV4(techStack);
    
    const patterns: Array<{
      files: string[];
      framework: Omit<Framework, 'confidence' | 'indicators'>;
      confidence: number;
    }> = [
      // Next.js
      {
        files: ['next.config.js', 'next.config.ts', 'next.config.mjs'],
        framework: { name: 'Next.js', type: 'fullstack' },
        confidence: 0.95
      },
      // Gatsby
      {
        files: ['gatsby-config.js', 'gatsby-config.ts'],
        framework: { name: 'Gatsby', type: 'fullstack' },
        confidence: 0.95
      },
      // Vue/Nuxt
      {
        files: ['nuxt.config.js', 'nuxt.config.ts'],
        framework: { name: 'Nuxt.js', type: 'fullstack' },
        confidence: 0.95
      },
      {
        files: ['vue.config.js'],
        framework: { name: 'Vue.js', type: 'frontend' },
        confidence: 0.8
      },
      // Angular
      {
        files: ['angular.json'],
        framework: { name: 'Angular', type: 'frontend' },
        confidence: 0.95
      },
      // Svelte
      {
        files: ['svelte.config.js'],
        framework: { name: 'SvelteKit', type: 'fullstack' },
        confidence: 0.9
      },
      // React Native
      {
        files: ['metro.config.js', 'app.json'],
        framework: { name: 'React Native', type: 'frontend' },
        confidence: 0.9
      },
      // Electron
      {
        files: ['electron.js', 'main.js'],
        framework: { name: 'Electron', type: 'frontend' },
        confidence: 0.7
      },
      // Tailwind CSS v3 and below
      {
        files: ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs', 'tailwind.config.cjs'],
        framework: { name: 'Tailwind CSS', type: 'library' },
        confidence: 0.95
      }
    ];

    for (const pattern of patterns) {
      for (const fileName of pattern.files) {
        const filePath = join(this.rootPath, fileName);
        const file = Bun.file(filePath);
        
        if (await file.exists()) {
          const framework = {
            ...pattern.framework,
            confidence: pattern.confidence,
            indicators: [`config file: ${fileName}`]
          };
          
          techStack.frameworks.push(framework);
          
          // Add Tailwind to styling if detected
          if (framework.name === 'Tailwind CSS' && !techStack.styling.some(s => s.includes('Tailwind CSS'))) {
            techStack.styling.push('Tailwind CSS (config file)');
          }
          
          break;
        }
      }
    }

    // Check for deployment configs
    const deploymentPatterns = [
      { files: ['vercel.json'], name: 'Vercel' },
      { files: ['netlify.toml'], name: 'Netlify' },
      { files: ['Dockerfile'], name: 'Docker' },
      { files: ['docker-compose.yml', 'docker-compose.yaml'], name: 'Docker Compose' },
      { files: ['.github/workflows'], name: 'GitHub Actions' },
      { files: ['.gitlab-ci.yml'], name: 'GitLab CI' },
      { files: ['Procfile'], name: 'Heroku' }
    ];

    for (const dp of deploymentPatterns) {
      for (const fileName of dp.files) {
        const filePath = join(this.rootPath, fileName);
        const file = Bun.file(filePath);
        
        if (await file.exists()) {
          techStack.deployment.push(dp.name);
          break;
        }
      }
    }
  }

  private async detectTailwindV4(techStack: TechStack): Promise<void> {
    try {
      // Check common CSS file locations for Tailwind imports
      const cssPatterns = ['**/*.css', '**/*.scss', '**/*.sass'];
      
      // Tailwind v3 requires these three imports
      const tailwindV3Pattern = [
        '@tailwind base',
        '@tailwind components', 
        '@tailwind utilities'
      ];
      
      // Tailwind v4 uses a single import
      const tailwindV4Patterns = [
        '@import "tailwindcss"',
        '@import \'tailwindcss\'',
        'import "tailwindcss"',
        '@theme'
      ];

      for (const pattern of cssPatterns) {
        const glob = new Glob(pattern);
        const files = [];
        
        for await (const file of glob.scan({ 
          cwd: this.rootPath,
          onlyFiles: true,
          followSymlinks: false
        })) {
          if (!file.includes('node_modules') && !file.includes('.git')) {
            files.push(file);
          }
        }

        // Check CSS files for Tailwind patterns
        for (const filePath of files.slice(0, 10)) {
          try {
            const fullPath = join(this.rootPath, filePath);
            const content = await Bun.file(fullPath).text();
            
            // Check for v3 pattern (all three directives)
            const hasAllV3Directives = tailwindV3Pattern.every(directive => 
              content.includes(directive)
            );
            
            if (hasAllV3Directives) {
              if (!techStack.styling.includes('Tailwind CSS')) {
                techStack.styling.push('Tailwind CSS (v3)');
              }
              return;
            }
            
            // Check for v4 pattern (single import)
            const hasV4Import = tailwindV4Patterns.some(pattern => 
              content.includes(pattern)
            );
            
            if (hasV4Import) {
              if (!techStack.styling.includes('Tailwind CSS')) {
                techStack.styling.push('Tailwind CSS (v4)');
              }
              return;
            }
          } catch (error) {
            // Skip files that can't be read
          }
        }
      }
    } catch (error) {
      // Ignore errors in Tailwind detection
    }
  }

  private async detectLanguages(techStack: TechStack): Promise<void> {
    const glob = new Glob('**/*');
    
    for await (const file of glob.scan({ 
      cwd: this.rootPath,
      onlyFiles: true,
      followSymlinks: false
    })) {
      if (file.includes('node_modules') || file.includes('.git')) continue;
      
      const ext = extname(file).toLowerCase();
      const language = this.getLanguageFromExtension(ext);
      
      if (language) {
        techStack.languages.set(
          language, 
          (techStack.languages.get(language) || 0) + 1
        );
      }
    }
  }

  private getLanguageFromExtension(ext: string): string | null {
    const languageMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.mjs': 'JavaScript',
      '.cjs': 'JavaScript',
      '.vue': 'Vue',
      '.svelte': 'Svelte',
      '.py': 'Python',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.rs': 'Rust',
      '.java': 'Java',
      '.kt': 'Kotlin',
      '.swift': 'Swift',
      '.dart': 'Dart',
      '.php': 'PHP',
      '.cs': 'C#',
      '.cpp': 'C++',
      '.c': 'C',
      '.h': 'C/C++',
      '.hpp': 'C++',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.sass': 'Sass',
      '.less': 'Less',
      '.styl': 'Stylus'
    };

    return languageMap[ext] || null;
  }

  private deduplicateFrameworks(frameworks: Framework[]): Framework[] {
    const seen = new Map<string, Framework>();
    
    for (const framework of frameworks) {
      const existing = seen.get(framework.name);
      if (!existing || framework.confidence > existing.confidence) {
        seen.set(framework.name, framework);
      } else if (existing && framework.confidence === existing.confidence) {
        // Merge indicators
        existing.indicators = [...new Set([...existing.indicators, ...framework.indicators])];
      }
    }

    return Array.from(seen.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  private generateResult(techStack: TechStack): FrameworkDetectionResult {
    const frontendFrameworks = techStack.frameworks.filter(f => 
      f.type === 'frontend' || f.type === 'fullstack'
    );
    const backendFrameworks = techStack.frameworks.filter(f => 
      f.type === 'backend' || f.type === 'fullstack'
    );
    
    const avgConfidence = techStack.frameworks.length > 0
      ? techStack.frameworks.reduce((sum, f) => sum + f.confidence, 0) / techStack.frameworks.length
      : 0;

    return {
      techStack,
      primaryFramework: techStack.frameworks[0],
      summary: {
        totalFrameworks: techStack.frameworks.length,
        frontendFrameworks: frontendFrameworks.length,
        backendFrameworks: backendFrameworks.length,
        confidence: avgConfidence
      }
    };
  }
}