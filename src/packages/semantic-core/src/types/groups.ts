/**
 * Concept Group Types
 * Types for semantic groupings of code terms
 */

export interface ConceptGroupDefinition {
  name: string
  description: string
  emoji: string
  terms: string[]
}

export interface ConceptGroupsConfig {
  defaultGroups: Record<string, ConceptGroupDefinition>
  customGroups: Record<string, ConceptGroupDefinition>
}