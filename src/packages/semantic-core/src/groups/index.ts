/**
 * Concept Groups Module
 * 
 * Provides semantic grouping functionality for code search and analysis.
 * Supports both default groups and project-specific custom groups.
 */

export {
  DEFAULT_CONCEPT_GROUPS,
  getAllConceptGroups,
  getGroupTerms,
  groupExists,
  getFormattedGroupList,
  type ConceptGroupDefinition,
  type ConceptGroupsConfig,
} from './ConceptGroups'