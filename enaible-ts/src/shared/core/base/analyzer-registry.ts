/**
 * Analyzer Registry - Maps analyzer names to their implementations.
 *
 * Purpose: Allow orchestration to construct analyzers by name without tight coupling.
 */

import type { AnalyzerConfig } from './types.js';
import type { BaseAnalyzer } from './analyzer-base.js';

type AnalyzerConstructor = new (config?: AnalyzerConfig) => BaseAnalyzer;

/**
 * In-memory registry of analyzer classes keyed by unique name.
 */
class AnalyzerRegistryClass {
  private registry: Map<string, AnalyzerConstructor> = new Map();

  /**
   * Register an analyzer class under a unique name.
   */
  register(name: string, analyzerClass: AnalyzerConstructor): void {
    if (!name || typeof name !== 'string') {
      throw new Error('Analyzer name must be a non-empty string');
    }

    const existing = this.registry.get(name);
    if (existing !== undefined) {
      if (existing === analyzerClass) {
        // Idempotent: same class registered again
        return;
      }
      throw new Error(`Analyzer already registered: ${name}`);
    }

    this.registry.set(name, analyzerClass);
  }

  /**
   * Get an analyzer class by name.
   */
  get(name: string): AnalyzerConstructor {
    const analyzerClass = this.registry.get(name);
    if (!analyzerClass) {
      throw new Error(`Analyzer not registered: ${name}`);
    }
    return analyzerClass;
  }

  /**
   * Create an analyzer instance by name.
   */
  create(name: string, config?: AnalyzerConfig): BaseAnalyzer {
    const AnalyzerClass = this.get(name);
    return new AnalyzerClass(config);
  }

  /**
   * List all registered analyzer names.
   */
  list(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Check if an analyzer is registered.
   */
  has(name: string): boolean {
    return this.registry.has(name);
  }

  /**
   * Clear all registrations (useful for testing).
   */
  clear(): void {
    this.registry.clear();
  }
}

/**
 * Global analyzer registry instance.
 */
export const AnalyzerRegistry = new AnalyzerRegistryClass();

/**
 * Decorator function to register an analyzer class.
 *
 * Usage:
 * ```
 * @registerAnalyzer('security:semgrep')
 * class SemgrepAnalyzer extends BaseAnalyzer { ... }
 * ```
 *
 * Or as a function call:
 * ```
 * registerAnalyzer('security:semgrep')(SemgrepAnalyzer);
 * ```
 */
export function registerAnalyzer(name: string) {
  return function<T extends AnalyzerConstructor>(target: T): T {
    AnalyzerRegistry.register(name, target);
    return target;
  };
}
