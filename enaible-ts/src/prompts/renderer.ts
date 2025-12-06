/**
 * Prompt rendering engine.
 */

import fs from 'fs';
import path from 'path';
import nunjucks from 'nunjucks';
import { WorkspaceContext } from '../runtime/context.js';
import { MANAGED_SENTINEL } from '../constants.js';
import { SYSTEM_CONTEXTS } from './adapters.js';
import { CATALOG } from './catalog.js';
import { extractVariables, argumentHintFromVariables } from './utils.js';
import {
  PromptDefinition,
  SystemPromptConfig,
  SystemRenderContext,
  RenderResult,
  VariableSpec,
} from './types.js';

const LEGACY_TITLE_RE = /^#\s+.+?\bv\d+(?:\.\d+)*\s*$/i;

/**
 * Create an object with Python-like dict methods (.items(), .get()).
 */
function makePythonLikeDict<T extends Record<string, unknown>>(obj: T): T & { items(): Array<[string, unknown]>; get(key: string, defaultVal?: unknown): unknown } {
  const enhanced = { ...obj } as T & { items(): Array<[string, unknown]>; get(key: string, defaultVal?: unknown): unknown };
  Object.defineProperty(enhanced, 'items', {
    value: function() { return Object.entries(this); },
    enumerable: false,
  });
  Object.defineProperty(enhanced, 'get', {
    value: function(key: string, defaultVal?: unknown) {
      const value = (this as Record<string, unknown>)[key];
      return value !== undefined ? value : defaultVal;
    },
    enumerable: false,
  });
  return enhanced;
}

/**
 * Create Jinja2-compatible selectattr filter for Nunjucks.
 */
function selectattrFilter(arr: unknown[], attr: string, test?: string, value?: unknown): unknown[] {
  if (!Array.isArray(arr)) return [];

  return arr.filter((item: unknown) => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    const attrValue = obj[attr];

    if (test === 'equalto' || test === 'eq') {
      return attrValue === value;
    }
    if (test === 'ne') {
      return attrValue !== value;
    }
    if (test === 'in') {
      if (Array.isArray(value)) {
        return value.includes(attrValue);
      }
      return false;
    }
    // If no test, just check truthiness
    return Boolean(attrValue);
  });
}

/**
 * Preprocess Jinja2 templates for Nunjucks compatibility.
 * Converts Jinja2-specific syntax to Nunjucks equivalents.
 */
function preprocessJinja2Template(src: string): string {
  let result = src;

  // Convert: {%- set var.prop = value -%} or {% set var.prop = value %}
  // To: {%- set _ = var | setprop('prop', value) -%}
  // This handles the namespace pattern used in Jinja2
  result = result.replace(
    /(\{%-?\s*set\s+)(\w+)\.(\w+)(\s*=\s*)(.+?)(\s*-?%\})/g,
    (_match, prefix, varName, propName, _eq, value, suffix) => {
      return `${prefix}_ = ${varName} | setprop('${propName}', ${value})${suffix}`;
    }
  );

  // Convert: {%- set _ = arr.append(item) -%}
  // To: {%- set _ = arr | append(item) -%}
  // This handles Python list.append() calls
  result = result.replace(
    /(\{%-?\s*set\s+_\s*=\s*)(\w+)\.append\((.+?)\)(\s*-?%\})/g,
    (_match, prefix, arrName, item, suffix) => {
      return `${prefix}${arrName} | append(${item})${suffix}`;
    }
  );

  // Convert: var.lstrip() or var.rstrip() method calls to filter syntax
  // This handles: {{ body_after_vars.lstrip() }} -> {{ body_after_vars | lstrip }}
  // And: var.lstrip('chars') -> var | lstrip('chars')
  result = result.replace(
    /(\w+)\.(lstrip|rstrip)\(\)/g,
    '$1 | $2'
  );
  result = result.replace(
    /(\w+)\.(lstrip|rstrip)\(([^)]+)\)/g,
    '$1 | $2($3)'
  );

  return result;
}

/**
 * Custom Nunjucks loader that preprocesses Jinja2 templates.
 */
class Jinja2CompatLoader extends nunjucks.Loader {
  private searchPath: string;

  constructor(searchPath: string) {
    super();
    this.searchPath = searchPath;
  }

  getSource(name: string): nunjucks.LoaderSource {
    const fullPath = path.resolve(this.searchPath, name);

    if (!fs.existsSync(fullPath)) {
      return null as unknown as nunjucks.LoaderSource;
    }

    const src = fs.readFileSync(fullPath, 'utf-8');
    const processedSrc = preprocessJinja2Template(src);

    return {
      src: processedSrc,
      path: fullPath,
      noCache: false,
    };
  }
}

/**
 * Python-like string wrapper with methods like lstrip, rstrip, lower, upper, replace, startswith.
 * Uses a wrapper pattern instead of extending String to avoid TypeScript override issues.
 * All string-returning methods return PythonString to enable method chaining.
 */
class PythonString {
  private readonly _value: string;

  constructor(str: string) {
    this._value = str;
  }

  // Required for Nunjucks to treat this as a string in template output
  toString(): string {
    return this._value;
  }

  valueOf(): string {
    return this._value;
  }

  // For JSON serialization
  toJSON(): string {
    return this._value;
  }

  // Python string methods
  lstrip(chars?: string): PythonString {
    let result: string;
    if (!chars) {
      result = this._value.replace(/^\s+/, '');
    } else {
      const regex = new RegExp(`^[${chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+`);
      result = this._value.replace(regex, '');
    }
    return new PythonString(result);
  }

  rstrip(chars?: string): PythonString {
    let result: string;
    if (!chars) {
      result = this._value.replace(/\s+$/, '');
    } else {
      const regex = new RegExp(`[${chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+$`);
      result = this._value.replace(regex, '');
    }
    return new PythonString(result);
  }

  lower(): PythonString {
    return new PythonString(this._value.toLowerCase());
  }

  upper(): PythonString {
    return new PythonString(this._value.toUpperCase());
  }

  startswith(prefix: string): boolean {
    return this._value.startsWith(prefix);
  }

  // Python's str.replace replaces all occurrences (unlike JS which only replaces first)
  replace(searchValue: string, replaceValue: string): PythonString {
    return new PythonString(this._value.split(searchValue).join(replaceValue));
  }

  // Split returning PythonString array for chaining
  split(separator: string, limit?: number): PythonString[] {
    const result = this._value.split(separator, limit);
    return result.map(s => new PythonString(s));
  }

  // Proxy common string methods
  trim(): PythonString {
    return new PythonString(this._value.trim());
  }

  get length(): number {
    return this._value.length;
  }

  charAt(index: number): string {
    return this._value.charAt(index);
  }
}

/**
 * Create a Python-like string.
 */
function makePythonString(str: string): PythonString {
  return new PythonString(str);
}

/**
 * Enhance variables for template rendering with Python-like string methods.
 */
function enhanceVariablesForTemplate(variables: VariableSpec[]): Record<string, unknown>[] {
  return variables.map(v => ({
    token: makePythonString(v.token),
    type_text: v.typeText,
    description: v.description,
    kind: v.kind,
    required: v.required,
    flag_name: v.flagName ? makePythonString(v.flagName) : undefined,
    positional_index: v.positionalIndex,
    repeatable: v.repeatable,
  }));
}

/**
 * Prompt renderer class.
 */
export class PromptRenderer {
  private context: WorkspaceContext;
  private env: nunjucks.Environment;

  constructor(context: WorkspaceContext) {
    this.context = context;
    this.env = new nunjucks.Environment(
      new Jinja2CompatLoader(context.repoRoot),
      {
        autoescape: false,
        trimBlocks: true,
        lstripBlocks: true,
        throwOnUndefined: false, // Allow undefined access for Jinja2 compatibility
      }
    );

    // Add Jinja2-compatible filters
    this.env.addFilter('selectattr', selectattrFilter);
    this.env.addFilter('tojson', (obj: unknown) => JSON.stringify(obj));
    this.env.addFilter('list', (obj: unknown) => Array.isArray(obj) ? obj : []);

    // Add setprop filter for Jinja2 namespace property assignment compatibility
    // Converts Jinja2's "set ns.value = x" to "set _ = ns | setprop('value', x)"
    this.env.addFilter('setprop', function(obj: Record<string, unknown>, key: string, value: unknown) {
      if (obj && typeof obj === 'object') {
        obj[key] = value;
      }
      return obj;
    });

    // Add Jinja2 namespace() function - creates a mutable object for use in loops
    this.env.addGlobal('namespace', (obj?: Record<string, unknown>) => {
      return obj ? { ...obj } : {};
    });

    // Add append filter for list.append() compatibility
    // Jinja2 uses list.append(item) but Nunjucks arrays don't have append
    this.env.addFilter('append', function(arr: unknown[], item: unknown) {
      if (Array.isArray(arr)) {
        arr.push(item);
      }
      return arr;
    });

    // Add lstrip filter - Python's str.lstrip()
    this.env.addFilter('lstrip', function(str: string, chars?: string) {
      if (typeof str !== 'string') return str;
      if (!chars) {
        return str.replace(/^\s+/, '');
      }
      const escaped = chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return str.replace(new RegExp(`^[${escaped}]+`), '');
    });

    // Add rstrip filter - Python's str.rstrip()
    this.env.addFilter('rstrip', function(str: string, chars?: string) {
      if (typeof str !== 'string') return str;
      if (!chars) {
        return str.replace(/\s+$/, '');
      }
      const escaped = chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return str.replace(new RegExp(`[${escaped}]+$`), '');
    });
  }

  /**
   * List all prompts in the catalog.
   */
  listPrompts(): PromptDefinition[] {
    return Object.values(CATALOG);
  }

  /**
   * Render prompts for specified systems.
   */
  render(
    promptIds: string[],
    systems: string[],
    outputOverride?: Record<string, string | null>
  ): RenderResult[] {
    const results: RenderResult[] = [];

    for (const promptId of promptIds) {
      const definition = this.getPrompt(promptId);

      for (const system of systems) {
        let config: SystemPromptConfig;
        try {
          config = this.getSystemConfig(definition, system);
        } catch {
          continue;
        }

        const systemContext = this.getSystemContext(system);
        const renderedBody = this.renderBody(definition, systemContext, config);
        const [variables, strippedBody] = extractVariables(renderedBody);
        const content = this.renderWrapper(
          definition,
          systemContext,
          config,
          strippedBody,
          variables
        );
        const outputPath = this.resolveOutputPath(config, system, outputOverride);

        results.push({
          promptId,
          system,
          content: this.ensureTrailingNewline(content),
          outputPath,
        });
      }
    }

    return results;
  }

  /**
   * Get a prompt definition by ID.
   */
  private getPrompt(promptId: string): PromptDefinition {
    const definition = CATALOG[promptId];
    if (!definition) {
      const available = Object.keys(CATALOG).sort().join(', ');
      throw new Error(`Unknown prompt '${promptId}'. Available: ${available}`);
    }
    return definition;
  }

  /**
   * Get system configuration for a prompt.
   */
  private getSystemConfig(definition: PromptDefinition, system: string): SystemPromptConfig {
    const config = definition.systems[system];
    if (!config) {
      const available = Object.keys(definition.systems).sort().join(', ');
      throw new Error(
        `Prompt '${definition.promptId}' does not support system '${system}'. Available: ${available}`
      );
    }
    return config;
  }

  /**
   * Get system render context.
   */
  private getSystemContext(system: string): SystemRenderContext {
    const context = SYSTEM_CONTEXTS[system];
    if (!context) {
      const available = Object.keys(SYSTEM_CONTEXTS).sort().join(', ');
      throw new Error(`Unknown system '${system}'. Available: ${available}`);
    }
    return context;
  }

  /**
   * Render the prompt body.
   */
  private renderBody(
    definition: PromptDefinition,
    system: SystemRenderContext,
    config: SystemPromptConfig
  ): string {
    const sourcePath = path.resolve(this.context.repoRoot, definition.sourcePath);
    const templatePath = path.relative(this.context.repoRoot, sourcePath);

    const template = this.env.getTemplate(templatePath);
    let rendered = template.render({
      prompt: definition,
      system,
      metadata: config.metadata ?? {},
    });

    // Replace @SYSTEMS.md placeholder with system-specific file
    const systemsFile = system.name === 'claude-code' ? 'CLAUDE.md' : 'AGENTS.md';
    rendered = rendered.replace(/@SYSTEMS\.md/g, systemsFile);

    return rendered;
  }

  /**
   * Render the wrapper template.
   */
  private renderWrapper(
    definition: PromptDefinition,
    system: SystemRenderContext,
    config: SystemPromptConfig,
    body: string,
    variables: VariableSpec[]
  ): string {
    const [bodyCleaned] = this.stripLegacyTitle(body);

    const templatePath = path.resolve(this.context.repoRoot, config.template);
    const relativeTemplatePath = path.relative(this.context.repoRoot, templatePath);

    const template = this.env.getTemplate(relativeTemplatePath);
    const argumentHint = argumentHintFromVariables(variables);
    const frontmatter = { ...(config.frontmatter ?? {}) };
    if (argumentHint && !frontmatter['argument-hint']) {
      frontmatter['argument-hint'] = argumentHint;
    }

    const bodyValue = bodyCleaned.trim() ? bodyCleaned.trim() + '\n' : '';
    return template.render({
      title: makePythonString(definition.title),
      body: makePythonString(bodyValue),
      prompt: definition,
      system,
      frontmatter: makePythonLikeDict(frontmatter),
      metadata: makePythonLikeDict(config.metadata ?? {}),
      variables: enhanceVariablesForTemplate(variables),
      managed_sentinel: MANAGED_SENTINEL,
    });
  }

  /**
   * Resolve output path.
   */
  private resolveOutputPath(
    config: SystemPromptConfig,
    system: string,
    overrides?: Record<string, string | null>
  ): string {
    let base: string | null = null;
    if (overrides) {
      base = overrides[system] ?? null;
    }
    if (!base) {
      return path.join(this.context.repoRoot, config.outputPath);
    }
    const relative = this.systemRelativeOutputPath(config.outputPath, system);
    return path.join(base, relative);
  }

  /**
   * Get system-relative output path.
   */
  private systemRelativeOutputPath(outputPath: string, system: string): string {
    // Try standard systems/<system>/ structure
    const systemRoot = path.join('systems', system);
    if (outputPath.startsWith(systemRoot)) {
      return outputPath.slice(systemRoot.length + 1);
    }

    // Try .build/rendered/<system>/ structure (used by catalog)
    const renderedRoot = path.join('.build', 'rendered', system);
    if (outputPath.startsWith(renderedRoot)) {
      return outputPath.slice(renderedRoot.length + 1);
    }

    // Try generic systems/ prefix
    if (outputPath.startsWith('systems')) {
      return outputPath.slice('systems'.length + 1);
    }

    return path.basename(outputPath);
  }

  /**
   * Strip legacy title from body.
   */
  private stripLegacyTitle(body: string): [string, boolean] {
    const lines = body.split('\n');
    let idx = 0;
    while (idx < lines.length && !lines[idx].trim()) {
      idx++;
    }

    let removed = false;
    if (idx < lines.length && LEGACY_TITLE_RE.test(lines[idx].trim())) {
      lines.splice(idx, 1);
      removed = true;
      while (idx < lines.length && !lines[idx].trim()) {
        lines.splice(idx, 1);
      }
    }

    let cleaned = lines.join('\n').replace(/^\n+|\n+$/g, '');
    if (cleaned) {
      cleaned += '\n';
    }
    return [cleaned, removed];
  }

  /**
   * Ensure content ends with newline.
   */
  private ensureTrailingNewline(value: string): string {
    return value.endsWith('\n') ? value : `${value}\n`;
  }
}

/**
 * Write render result to disk.
 */
export function writeRenderResult(result: RenderResult): void {
  const dir = path.dirname(result.outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(result.outputPath, result.content, 'utf-8');
}

/**
 * Get diff between render result and current file.
 */
export function getRenderResultDiff(result: RenderResult): string {
  if (!fs.existsSync(result.outputPath)) {
    return '';
  }
  const current = fs.readFileSync(result.outputPath, 'utf-8');
  if (current === result.content) {
    return '';
  }

  // Simple unified diff
  const currentLines = current.split('\n');
  const updatedLines = result.content.split('\n');

  const diff: string[] = [
    `--- ${result.outputPath}`,
    `+++ ${result.outputPath} (generated)`,
  ];

  // Simple line-by-line diff
  const maxLen = Math.max(currentLines.length, updatedLines.length);
  for (let i = 0; i < maxLen; i++) {
    const currLine = currentLines[i];
    const updLine = updatedLines[i];
    if (currLine !== updLine) {
      if (currLine !== undefined) {
        diff.push(`-${currLine}`);
      }
      if (updLine !== undefined) {
        diff.push(`+${updLine}`);
      }
    }
  }

  return diff.join('\n');
}
