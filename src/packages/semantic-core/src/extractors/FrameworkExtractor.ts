/**
 * Framework-specific File Extractor
 * Handles Svelte, Vue, Astro, and MDX files with multiple sections
 */

import * as parser from '@babel/parser'
import traverse from '@babel/traverse'
import type { LanguageExtractor, SemanticInfo, CrossReference } from '../types'
import { TypeScriptExtractor } from './TypeScriptExtractor'

interface FrameworkSection {
  type: 'script' | 'template' | 'style' | 'markdown'
  content: string
  lang?: string
  startLine: number
}

export class FrameworkExtractor implements LanguageExtractor {
  private tsExtractor = new TypeScriptExtractor()

  canHandle(filePath: string): boolean {
    return /\.(svelte|vue|astro|mdx)$/.test(filePath)
  }

  extract(
    content: string,
    filePath: string
  ): { definitions: SemanticInfo[]; references: CrossReference[] } {
    const definitions: SemanticInfo[] = []
    const references: CrossReference[] = []
    const fileType = this.getFileType(filePath)
    
    // Extract sections based on file type
    const sections = this.extractSections(content, fileType)
    
    // Process each section
    for (const section of sections) {
      if (section.type === 'script') {
        // Use TypeScript extractor for script sections
        const scriptResults = this.extractScriptSection(
          section.content, 
          filePath, 
          section.startLine
        )
        definitions.push(...scriptResults.definitions)
        references.push(...scriptResults.references)
      } else if (section.type === 'template') {
        // Extract component usage, props, events from template
        const templateResults = this.extractTemplateSection(
          section.content,
          filePath,
          section.startLine,
          fileType
        )
        definitions.push(...templateResults.definitions)
        references.push(...templateResults.references)
      } else if (section.type === 'style') {
        // Extract CSS classes and variables
        const styleResults = this.extractStyleSection(
          section.content,
          filePath,
          section.startLine
        )
        definitions.push(...styleResults)
      }
    }
    
    // Add component definition itself
    const componentName = this.extractComponentName(filePath)
    if (componentName) {
      definitions.unshift({
        term: componentName,
        type: 'class', // Treat components as classes
        location: {
          file: filePath,
          line: 1,
          column: 0
        },
        context: `${fileType} component: ${componentName}`,
        surroundingLines: content.split('\n').slice(0, 5),
        relatedTerms: this.extractComponentExports(sections),
        language: fileType
      })
    }
    
    return { definitions, references }
  }
  
  private getFileType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase()
    return ext || 'unknown'
  }
  
  private extractSections(content: string, fileType: string): FrameworkSection[] {
    const sections: FrameworkSection[] = []
    const lines = content.split('\n')
    
    switch (fileType) {
      case 'svelte':
        return this.extractSvelteSections(content, lines)
      case 'vue':
        return this.extractVueSections(content, lines)
      case 'astro':
        return this.extractAstroSections(content, lines)
      case 'mdx':
        return this.extractMdxSections(content, lines)
      default:
        return sections
    }
  }
  
  private extractSvelteSections(content: string, lines: string[]): FrameworkSection[] {
    const sections: FrameworkSection[] = []
    
    // Extract <script> sections
    const scriptRegex = /<script(?:\s+lang="([^"]+)")?(?:\s+context="module")?>([\s\S]*?)<\/script>/g
    let match
    while ((match = scriptRegex.exec(content))) {
      const startLine = content.substring(0, match.index).split('\n').length
      sections.push({
        type: 'script',
        content: match[2],
        lang: match[1] || 'js',
        startLine
      })
    }
    
    // Extract template (everything not in script/style tags)
    const templateContent = content
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .trim()
    
    if (templateContent) {
      sections.push({
        type: 'template',
        content: templateContent,
        startLine: 1
      })
    }
    
    // Extract <style> sections
    const styleRegex = /<style(?:\s+lang="([^"]+)")?>([\s\S]*?)<\/style>/g
    while ((match = styleRegex.exec(content))) {
      const startLine = content.substring(0, match.index).split('\n').length
      sections.push({
        type: 'style',
        content: match[2],
        lang: match[1] || 'css',
        startLine
      })
    }
    
    return sections
  }
  
  private extractVueSections(content: string, lines: string[]): FrameworkSection[] {
    const sections: FrameworkSection[] = []
    
    // Extract <script> sections (including setup)
    const scriptRegex = /<script(?:\s+setup)?(?:\s+lang="([^"]+)")?>([\s\S]*?)<\/script>/g
    let match
    while ((match = scriptRegex.exec(content))) {
      const startLine = content.substring(0, match.index).split('\n').length
      sections.push({
        type: 'script',
        content: match[2],
        lang: match[1] || 'js',
        startLine
      })
    }
    
    // Extract <template> section
    const templateRegex = /<template>([\s\S]*?)<\/template>/g
    while ((match = templateRegex.exec(content))) {
      const startLine = content.substring(0, match.index).split('\n').length
      sections.push({
        type: 'template',
        content: match[1],
        startLine
      })
    }
    
    // Extract <style> sections
    const styleRegex = /<style(?:\s+scoped)?(?:\s+lang="([^"]+)")?>([\s\S]*?)<\/style>/g
    while ((match = styleRegex.exec(content))) {
      const startLine = content.substring(0, match.index).split('\n').length
      sections.push({
        type: 'style',
        content: match[2],
        lang: match[1] || 'css',
        startLine
      })
    }
    
    return sections
  }
  
  private extractAstroSections(content: string, lines: string[]): FrameworkSection[] {
    const sections: FrameworkSection[] = []
    
    // Extract frontmatter (TypeScript code between ---)
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/m)
    if (frontmatterMatch) {
      sections.push({
        type: 'script',
        content: frontmatterMatch[1],
        lang: 'ts',
        startLine: 2 // After first ---
      })
    }
    
    // Extract template (everything after frontmatter)
    const templateStart = frontmatterMatch ? frontmatterMatch[0].length : 0
    const templateContent = content.substring(templateStart).trim()
    if (templateContent) {
      const startLine = frontmatterMatch 
        ? content.substring(0, templateStart).split('\n').length + 1
        : 1
      sections.push({
        type: 'template',
        content: templateContent,
        startLine
      })
    }
    
    return sections
  }
  
  private extractMdxSections(content: string, lines: string[]): FrameworkSection[] {
    const sections: FrameworkSection[] = []
    
    // Extract import statements at the top
    const importRegex = /^import\s+.+$/gm
    const imports: string[] = []
    let match
    while ((match = importRegex.exec(content))) {
      imports.push(match[0])
    }
    
    if (imports.length > 0) {
      sections.push({
        type: 'script',
        content: imports.join('\n'),
        lang: 'jsx',
        startLine: 1
      })
    }
    
    // The rest is markdown with embedded JSX
    sections.push({
      type: 'markdown',
      content: content,
      startLine: imports.length + 1
    })
    
    return sections
  }
  
  private extractScriptSection(
    content: string,
    filePath: string,
    lineOffset: number
  ): { definitions: SemanticInfo[]; references: CrossReference[] } {
    // Use TypeScript extractor but adjust line numbers
    const results = this.tsExtractor.extract(content, filePath)
    
    // Adjust line numbers for offset
    results.definitions.forEach(def => {
      def.location.line += lineOffset - 1
    })
    results.references.forEach(ref => {
      ref.fromLocation.line += lineOffset - 1
    })
    
    // Extract framework-specific features
    const fileType = this.getFileType(filePath)
    const frameworkResults = this.extractFrameworkFeatures(content, filePath, lineOffset, fileType)
    
    // Merge results
    results.definitions.push(...frameworkResults.definitions)
    results.references.push(...frameworkResults.references)
    
    return results
  }
  
  private extractFrameworkFeatures(
    content: string,
    filePath: string,
    lineOffset: number,
    fileType: string
  ): { definitions: SemanticInfo[]; references: CrossReference[] } {
    const definitions: SemanticInfo[] = []
    const references: CrossReference[] = []
    const lines = content.split('\n')
    
    switch (fileType) {
      case 'svelte':
        // Svelte 5 Runes
        const runeRegex = /\$(?:state|derived|effect|props|bindable|inspect|host)\b/g
        let match
        while ((match = runeRegex.exec(content))) {
          const lineNum = content.substring(0, match.index).split('\n').length
          const runeName = match[0]
          definitions.push({
            term: runeName,
            type: 'function',
            location: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: match.index - content.lastIndexOf('\n', match.index) - 1
            },
            context: lines[lineNum - 1]?.trim() || '',
            surroundingLines: lines.slice(Math.max(0, lineNum - 2), lineNum + 2),
            relatedTerms: ['rune', 'svelte5', 'reactive'],
            language: 'svelte',
            metadata: {
              frameworkFeature: 'svelte-rune',
              runeType: runeName.substring(1)
            }
          })
        }
        
        // Svelte lifecycle functions
        const lifecycleRegex = /\b(onMount|onDestroy|beforeUpdate|afterUpdate|tick)\s*\(/g
        while ((match = lifecycleRegex.exec(content))) {
          const lineNum = content.substring(0, match.index).split('\n').length
          const lifecycleName = match[1]
          references.push({
            targetTerm: lifecycleName,
            referenceType: 'svelte-lifecycle',
            fromLocation: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: match.index - content.lastIndexOf('\n', match.index) - 1
            },
            context: lines[lineNum - 1]?.trim() || '',
            metadata: {
              frameworkFeature: 'svelte-lifecycle',
              lifecycleHook: lifecycleName
            }
          })
        }
        
        // Svelte context API
        const contextRegex = /\b(setContext|getContext|hasContext|getAllContexts)\s*\(/g
        while ((match = contextRegex.exec(content))) {
          const lineNum = content.substring(0, match.index).split('\n').length
          const contextFn = match[1]
          references.push({
            targetTerm: contextFn,
            referenceType: 'svelte-context',
            fromLocation: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: match.index - content.lastIndexOf('\n', match.index) - 1
            },
            context: lines[lineNum - 1]?.trim() || '',
            metadata: {
              frameworkFeature: 'svelte-context-api',
              contextFunction: contextFn
            }
          })
        }
        
        // Svelte special imports
        const svelteImportRegex = /from\s+['"]svelte(?:\/(\w+))?['"]/g
        while ((match = svelteImportRegex.exec(content))) {
          const lineNum = content.substring(0, match.index).split('\n').length
          const submodule = match[1] || 'core'
          definitions.push({
            term: `svelte/${submodule}`,
            type: 'import',
            location: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: match.index - content.lastIndexOf('\n', match.index) - 1
            },
            context: lines[lineNum - 1]?.trim() || '',
            surroundingLines: lines.slice(Math.max(0, lineNum - 2), lineNum + 2),
            relatedTerms: ['svelte', 'import', submodule],
            language: 'svelte',
            metadata: {
              frameworkFeature: 'svelte-import',
              submodule: submodule
            }
          })
        }
        
        // Svelte stores ($ prefix)
        const storeRegex = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g
        while ((match = storeRegex.exec(content))) {
          const lineNum = content.substring(0, match.index).split('\n').length
          const storeName = match[1]
          // Check if it's not a rune
          if (!match[0].match(/\$(?:state|derived|effect|props|bindable|inspect|host)\b/)) {
            references.push({
              targetTerm: storeName,
              referenceType: 'store-subscription',
              fromLocation: {
                file: filePath,
                line: lineOffset + lineNum - 1,
                column: match.index - content.lastIndexOf('\n', match.index) - 1
              },
              context: lines[lineNum - 1]?.trim() || '',
              metadata: {
                frameworkFeature: 'svelte-store'
              }
            })
          }
        }
        
        // Reactive statements ($:)
        const reactiveRegex = /^\s*\$:\s*/gm
        while ((match = reactiveRegex.exec(content))) {
          const lineNum = content.substring(0, match.index).split('\n').length
          definitions.push({
            term: '$: reactive',
            type: 'variable',
            location: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: 0
            },
            context: lines[lineNum - 1]?.trim() || '',
            surroundingLines: lines.slice(Math.max(0, lineNum - 2), lineNum + 2),
            relatedTerms: ['reactive', 'svelte'],
            language: 'svelte',
            metadata: {
              frameworkFeature: 'svelte-reactive-statement'
            }
          })
        }
        break
        
      case 'vue':
        // Vue Composition API
        const vueCompositionRegex = /\b(ref|reactive|computed|watch|watchEffect|onMounted|onUnmounted|provide|inject)\s*\(/g
        while ((match = vueCompositionRegex.exec(content))) {
          const lineNum = content.substring(0, match.index).split('\n').length
          const apiName = match[1]
          references.push({
            targetTerm: apiName,
            referenceType: 'vue-composition-api',
            fromLocation: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: match.index - content.lastIndexOf('\n', match.index) - 1
            },
            context: lines[lineNum - 1]?.trim() || '',
            metadata: {
              frameworkFeature: 'vue-composition-api',
              apiFunction: apiName
            }
          })
        }
        
        // Vue defineProps, defineEmits, defineExpose
        const vueDefineRegex = /\b(defineProps|defineEmits|defineExpose|defineSlots)\s*(?:<[^>]*>)?\s*\(/g
        while ((match = vueDefineRegex.exec(content))) {
          const lineNum = content.substring(0, match.index).split('\n').length
          const defineName = match[1]
          definitions.push({
            term: defineName,
            type: 'function',
            location: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: match.index - content.lastIndexOf('\n', match.index) - 1
            },
            context: lines[lineNum - 1]?.trim() || '',
            surroundingLines: lines.slice(Math.max(0, lineNum - 2), lineNum + 2),
            relatedTerms: ['vue3', 'setup', 'composition'],
            language: 'vue',
            metadata: {
              frameworkFeature: 'vue-compiler-macro',
              macroType: defineName
            }
          })
        }
        break
        
      case 'astro':
        // Astro.props, Astro.slots, Astro.request
        const astroGlobalRegex = /Astro\.(props|slots|request|params|cookies|redirect|response|glob)/g
        while ((match = astroGlobalRegex.exec(content))) {
          const lineNum = content.substring(0, match.index).split('\n').length
          const astroProperty = match[1]
          references.push({
            targetTerm: `Astro.${astroProperty}`,
            referenceType: 'astro-global',
            fromLocation: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: match.index - content.lastIndexOf('\n', match.index) - 1
            },
            context: lines[lineNum - 1]?.trim() || '',
            metadata: {
              frameworkFeature: 'astro-global',
              propertyName: astroProperty
            }
          })
        }
        
        // Props interface
        const propsInterfaceRegex = /interface\s+Props\s*{([^}]*)}/g
        while ((match = propsInterfaceRegex.exec(content))) {
          const lineNum = content.substring(0, match.index).split('\n').length
          definitions.push({
            term: 'Props',
            type: 'interface',
            location: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: match.index - content.lastIndexOf('\n', match.index) - 1
            },
            context: 'interface Props',
            surroundingLines: match[0].split('\n'),
            relatedTerms: ['astro', 'component', 'props'],
            language: 'astro',
            metadata: {
              frameworkFeature: 'astro-props-interface'
            }
          })
        }
        break
    }
    
    return { definitions, references }
  }
  
  private extractTemplateSection(
    content: string,
    filePath: string,
    lineOffset: number,
    fileType: string
  ): { definitions: SemanticInfo[]; references: CrossReference[] } {
    const definitions: SemanticInfo[] = []
    const references: CrossReference[] = []
    const lines = content.split('\n')
    
    // Extract component usage
    const componentRegex = /<([A-Z][A-Za-z0-9]*)/g
    let match
    while ((match = componentRegex.exec(content))) {
      const lineNum = content.substring(0, match.index).split('\n').length
      references.push({
        targetTerm: match[1],
        referenceType: 'instantiation',
        fromLocation: {
          file: filePath,
          line: lineOffset + lineNum - 1,
          column: match.index - content.lastIndexOf('\n', match.index) - 1
        },
        context: lines[lineNum - 1]?.trim() || ''
      })
    }
    
    // Extract props/bindings based on framework
    if (fileType === 'svelte') {
      // Svelte: {expression}, bind:value, on:event, use:action
      const bindingRegex = /\{([^}]+)\}|bind:(\w+)|on:(\w+)|use:(\w+)/g
      while ((match = bindingRegex.exec(content))) {
        const term = match[1] || match[2] || match[3] || match[4]
        const lineNum = content.substring(0, match.index).split('\n').length
        const bindingType = match[1] ? 'interpolation' : 
                          match[2] ? 'bind' : 
                          match[3] ? 'event' : 'action'
        definitions.push({
          term,
          type: 'variable',
          location: {
            file: filePath,
            line: lineOffset + lineNum - 1,
            column: match.index - content.lastIndexOf('\n', match.index) - 1
          },
          context: lines[lineNum - 1]?.trim() || '',
          surroundingLines: lines.slice(Math.max(0, lineNum - 2), lineNum + 2),
          relatedTerms: ['svelte', bindingType],
          language: fileType,
          metadata: {
            frameworkFeature: `svelte-${bindingType}`
          }
        })
      }
      
      // Svelte special directives: {#if}, {#each}, {#await}, {@html}, {@debug}
      const directiveRegex = /\{[#@/:](\w+)(?:\s+([^}]+))?\}/g
      while ((match = directiveRegex.exec(content))) {
        const directive = match[1]
        const expression = match[2]
        const lineNum = content.substring(0, match.index).split('\n').length
        definitions.push({
          term: `{#${directive}}`,
          type: 'function',
          location: {
            file: filePath,
            line: lineOffset + lineNum - 1,
            column: match.index - content.lastIndexOf('\n', match.index) - 1
          },
          context: lines[lineNum - 1]?.trim() || '',
          surroundingLines: lines.slice(Math.max(0, lineNum - 2), lineNum + 2),
          relatedTerms: ['svelte', 'template', 'directive'],
          language: fileType,
          metadata: {
            frameworkFeature: 'svelte-directive',
            directive: directive,
            expression: expression?.trim()
          }
        })
      }
    } else if (fileType === 'vue') {
      // Vue: {{ expression }}, v-model, @event, v-if, v-for, v-show
      const vueBindingRegex = /\{\{([^}]+)\}\}|v-model(?:\.(\w+))?="([^"]+)"|@(\w+)(?:\.(\w+))?|v-(if|for|show|else|else-if)="([^"]+)"/g
      while ((match = vueBindingRegex.exec(content))) {
        const interpolation = match[1]
        const modelModifier = match[2]
        const modelValue = match[3]
        const eventName = match[4]
        const eventModifier = match[5]
        const directive = match[6]
        const directiveValue = match[7]
        
        const lineNum = content.substring(0, match.index).split('\n').length
        
        if (interpolation) {
          definitions.push({
            term: interpolation.trim(),
            type: 'variable',
            location: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: match.index - content.lastIndexOf('\n', match.index) - 1
            },
            context: lines[lineNum - 1]?.trim() || '',
            surroundingLines: lines.slice(Math.max(0, lineNum - 2), lineNum + 2),
            relatedTerms: ['vue', 'interpolation'],
            language: fileType,
            metadata: {
              frameworkFeature: 'vue-interpolation'
            }
          })
        } else if (modelValue) {
          definitions.push({
            term: modelValue,
            type: 'variable',
            location: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: match.index - content.lastIndexOf('\n', match.index) - 1
            },
            context: lines[lineNum - 1]?.trim() || '',
            surroundingLines: lines.slice(Math.max(0, lineNum - 2), lineNum + 2),
            relatedTerms: ['vue', 'v-model', modelModifier].filter(Boolean),
            language: fileType,
            metadata: {
              frameworkFeature: 'vue-v-model',
              modifier: modelModifier
            }
          })
        } else if (eventName) {
          references.push({
            targetTerm: eventName,
            referenceType: 'event-handler',
            fromLocation: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: match.index - content.lastIndexOf('\n', match.index) - 1
            },
            context: lines[lineNum - 1]?.trim() || '',
            metadata: {
              frameworkFeature: 'vue-event',
              modifier: eventModifier
            }
          })
        } else if (directive && directiveValue) {
          definitions.push({
            term: `v-${directive}`,
            type: 'function',
            location: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: match.index - content.lastIndexOf('\n', match.index) - 1
            },
            context: lines[lineNum - 1]?.trim() || '',
            surroundingLines: lines.slice(Math.max(0, lineNum - 2), lineNum + 2),
            relatedTerms: ['vue', 'directive', directive],
            language: fileType,
            metadata: {
              frameworkFeature: 'vue-directive',
              directive: directive,
              expression: directiveValue
            }
          })
        }
      }
    } else if (fileType === 'astro') {
      // Astro: client directives, props spreading
      const astroDirectiveRegex = /client:(\w+)|{\.\.\.(\w+)}|set:(\w+)={([^}]+)}/g
      while ((match = astroDirectiveRegex.exec(content))) {
        const clientDirective = match[1]
        const spread = match[2]
        const setDirective = match[3]
        const setValue = match[4]
        
        const lineNum = content.substring(0, match.index).split('\n').length
        
        if (clientDirective) {
          definitions.push({
            term: `client:${clientDirective}`,
            type: 'function',
            location: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: match.index - content.lastIndexOf('\n', match.index) - 1
            },
            context: lines[lineNum - 1]?.trim() || '',
            surroundingLines: lines.slice(Math.max(0, lineNum - 2), lineNum + 2),
            relatedTerms: ['astro', 'hydration', 'client'],
            language: fileType,
            metadata: {
              frameworkFeature: 'astro-client-directive',
              directive: clientDirective
            }
          })
        } else if (spread) {
          references.push({
            targetTerm: spread,
            referenceType: 'props-spread',
            fromLocation: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: match.index - content.lastIndexOf('\n', match.index) - 1
            },
            context: lines[lineNum - 1]?.trim() || '',
            metadata: {
              frameworkFeature: 'astro-props-spread'
            }
          })
        } else if (setDirective) {
          definitions.push({
            term: `set:${setDirective}`,
            type: 'variable',
            location: {
              file: filePath,
              line: lineOffset + lineNum - 1,
              column: match.index - content.lastIndexOf('\n', match.index) - 1
            },
            context: lines[lineNum - 1]?.trim() || '',
            surroundingLines: lines.slice(Math.max(0, lineNum - 2), lineNum + 2),
            relatedTerms: ['astro', 'set-directive'],
            language: fileType,
            metadata: {
              frameworkFeature: 'astro-set-directive',
              directive: setDirective,
              value: setValue
            }
          })
        }
      }
    }
    
    return { definitions, references }
  }
  
  private extractStyleSection(
    content: string,
    filePath: string,
    lineOffset: number
  ): SemanticInfo[] {
    const definitions: SemanticInfo[] = []
    const lines = content.split('\n')
    
    // Extract CSS classes
    const classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g
    let match
    while ((match = classRegex.exec(content))) {
      const lineNum = content.substring(0, match.index).split('\n').length
      definitions.push({
        term: match[1],
        type: 'string', // Use string type for CSS classes
        location: {
          file: filePath,
          line: lineOffset + lineNum - 1,
          column: match.index - content.lastIndexOf('\n', match.index) - 1
        },
        context: `CSS class: .${match[1]}`,
        surroundingLines: lines.slice(Math.max(0, lineNum - 2), lineNum + 2),
        relatedTerms: [],
        language: 'css',
        metadata: {
          cssClass: true
        }
      })
    }
    
    // Extract CSS variables
    const varRegex = /--([a-zA-Z_-][a-zA-Z0-9_-]*)/g
    while ((match = varRegex.exec(content))) {
      const lineNum = content.substring(0, match.index).split('\n').length
      definitions.push({
        term: `--${match[1]}`,
        type: 'variable',
        location: {
          file: filePath,
          line: lineOffset + lineNum - 1,
          column: match.index - content.lastIndexOf('\n', match.index) - 1
        },
        context: `CSS variable: --${match[1]}`,
        surroundingLines: lines.slice(Math.max(0, lineNum - 2), lineNum + 2),
        relatedTerms: [],
        language: 'css',
        metadata: {
          cssVariable: true
        }
      })
    }
    
    return definitions
  }
  
  private extractComponentName(filePath: string): string {
    const fileName = filePath.split('/').pop() || ''
    const name = fileName.replace(/\.(svelte|vue|astro|mdx)$/, '')
    // Convert kebab-case to PascalCase
    return name
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
  }
  
  private extractComponentExports(sections: FrameworkSection[]): string[] {
    const exports: string[] = []
    
    // Look for exported props, functions, etc. in script sections
    for (const section of sections) {
      if (section.type === 'script') {
        // Simple regex to find exports
        const exportRegex = /export\s+(?:let|const|function|class)\s+(\w+)/g
        let match
        while ((match = exportRegex.exec(section.content))) {
          exports.push(match[1])
        }
      }
    }
    
    return exports
  }
}