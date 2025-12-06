/**
 * Core types for the prompt system.
 */

/**
 * Configuration for a system-specific prompt.
 */
export interface SystemPromptConfig {
  template: string;
  outputPath: string;
  frontmatter?: Record<string, string>;
  metadata?: Record<string, string>;
}

/**
 * Definition of a prompt in the catalog.
 */
export interface PromptDefinition {
  promptId: string;
  sourcePath: string;
  title: string;
  systems: Record<string, SystemPromptConfig>;
}

/**
 * System render context for adapter metadata.
 */
export interface SystemRenderContext {
  name: string;
  projectScopeDir: string;
  userScopeDir: string;
  description: string;
}

/**
 * Variable specification extracted from prompt body.
 */
export interface VariableSpec {
  token: string;
  typeText: string;
  description: string;
  kind: 'positional' | 'flag' | 'named' | 'derived' | 'config';
  required: boolean;
  flagName?: string;
  positionalIndex?: number;
  repeatable: boolean;
}

/**
 * Result of rendering a prompt.
 */
export interface RenderResult {
  promptId: string;
  system: string;
  content: string;
  outputPath: string;
}

/**
 * Lint issue found during validation.
 */
export interface LintIssue {
  path: string;
  line: number;
  message: string;
}
