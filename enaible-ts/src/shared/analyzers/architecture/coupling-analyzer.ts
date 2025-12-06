/**
 * Coupling Analysis Analyzer - Architecture Coupling and Dependency Analysis.
 *
 * Analyzes code coupling patterns, dependency relationships, and architectural issues.
 * Detects circular dependencies, high fan-in/fan-out, and coupling hotspots.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  BaseAnalyzer,
  createStandardFinding,
} from '../../core/base/analyzer-base.js';
import {
  AnalyzerConfig,
  AnalyzerMetadata,
  RawFinding,
  createDefaultConfig,
} from '../../core/base/types.js';
import { registerAnalyzer } from '../../core/base/analyzer-registry.js';

interface ImportPattern {
  pattern: RegExp;
  groups: number[];
}

interface ModuleInfo {
  filePath: string;
  dependencies: string[];
  language: string;
}

/**
 * Coupling analyzer with dependency graph analysis.
 */
@registerAnalyzer('architecture:coupling')
export class CouplingAnalyzer extends BaseAnalyzer {
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private reverseGraph: Map<string, Set<string>> = new Map();
  private moduleInfo: Map<string, ModuleInfo> = new Map();

  /** Import patterns for different languages */
  private importPatterns: Record<string, ImportPattern> = {
    python: {
      pattern: /(?:from\s+(\S+)\s+import|import\s+(\S+))/g,
      groups: [1, 2],
    },
    javascript: {
      pattern: /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g,
      groups: [1, 2],
    },
    typescript: {
      pattern: /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g,
      groups: [1, 2],
    },
    java: {
      pattern: /import\s+([^;]+);/g,
      groups: [1],
    },
    go: {
      pattern: /import\s+(?:"([^"]+)"|`([^`]+)`)/g,
      groups: [1, 2],
    },
    rust: {
      pattern: /use\s+([^;]+);/g,
      groups: [1],
    },
  };

  /** File extension to language mapping */
  private extensionLanguageMap: Record<string, string> = {
    '.py': 'python',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.php': 'php',
    '.rb': 'ruby',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'cpp',
  };

  /** External dependencies to skip */
  private externalPatterns = [
    'react', 'vue', 'angular', 'lodash', 'axios', 'express', 'next',
    'numpy', 'pandas', 'django', 'flask', 'requests',
    'os', 'sys', 'path', 'fs', 'http', 'https', 'util', 'crypto',
    'buffer', 'child_process', 'events', 'stream',
  ];

  constructor(config?: Partial<AnalyzerConfig>) {
    const archConfig = createDefaultConfig({
      codeExtensions: new Set([
        '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.go', '.rs',
        '.php', '.rb', '.cs', '.cpp', '.c', '.h',
      ]),
      skipPatterns: new Set([
        'node_modules', '.git', '__pycache__', 'dist', 'build',
        '.next', 'coverage', 'venv', 'env', 'target', 'vendor',
        '*.min.js', '*.bundle.js', '*.d.ts',
      ]),
      ...config,
    });

    super('architecture', archConfig);
  }

  /**
   * Find project root by looking for common indicators.
   */
  private findProjectRoot(filePath: string): string {
    const indicators = [
      'package.json', 'requirements.txt', 'go.mod', 'Cargo.toml',
      'pom.xml', 'build.gradle', '.git', 'pyproject.toml',
    ];

    let current = path.dirname(filePath);
    while (current !== path.dirname(current)) {
      for (const indicator of indicators) {
        if (fs.existsSync(path.join(current, indicator))) {
          return current;
        }
      }
      current = path.dirname(current);
    }

    return path.dirname(filePath);
  }

  /**
   * Extract dependencies from a file.
   */
  private extractDependencies(filePath: string): string[] {
    const ext = path.extname(filePath).toLowerCase();
    const language = this.extensionLanguageMap[ext];

    if (!language || !this.importPatterns[language]) {
      return [];
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const pattern = this.importPatterns[language];
      const dependencies: Set<string> = new Set();

      let match;
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        for (const groupIdx of pattern.groups) {
          if (match[groupIdx]) {
            let dep = match[groupIdx].trim();

            // Skip relative and external dependencies
            if (dep.startsWith('.') || this.isExternalDependency(dep)) {
              continue;
            }

            // Clean up path-based imports
            if (dep.includes('/')) {
              dep = dep.replace(/^\.\//, '').replace(/^\.\.\//, '');
            }

            dependencies.add(dep);
          }
        }
      }

      return Array.from(dependencies);
    } catch {
      return [];
    }
  }

  /**
   * Check if dependency is external.
   */
  private isExternalDependency(dep: string): boolean {
    const depLower = dep.toLowerCase();
    return this.externalPatterns.some(pattern => depLower.includes(pattern));
  }

  /**
   * Get module name from file path.
   */
  private getModuleName(filePath: string, projectRoot: string): string {
    try {
      const relative = path.relative(projectRoot, filePath);
      const parsed = path.parse(relative);
      return path.join(parsed.dir, parsed.name);
    } catch {
      return path.basename(filePath, path.extname(filePath));
    }
  }

  /**
   * Build dependency graph for the project.
   */
  private buildDependencyGraph(projectRoot: string): void {
    this.dependencyGraph.clear();
    this.reverseGraph.clear();
    this.moduleInfo.clear();

    const walkDir = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip patterns
          if (this.config.skipPatterns.has(entry.name)) {
            continue;
          }

          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (this.config.codeExtensions.has(ext)) {
              const moduleName = this.getModuleName(fullPath, projectRoot);
              const dependencies = this.extractDependencies(fullPath);
              const language = this.extensionLanguageMap[ext] || 'unknown';

              this.dependencyGraph.set(moduleName, new Set(dependencies));
              this.moduleInfo.set(moduleName, {
                filePath: fullPath,
                dependencies,
                language,
              });

              // Build reverse graph
              for (const dep of dependencies) {
                if (!this.reverseGraph.has(dep)) {
                  this.reverseGraph.set(dep, new Set());
                }
                this.reverseGraph.get(dep)!.add(moduleName);
              }
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    walkDir(projectRoot);
  }

  /**
   * Find circular dependencies using DFS.
   */
  private findCircularDependencies(): string[][] {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]) => {
      if (recStack.has(node)) {
        const cycleStart = path.indexOf(node);
        const cycle = [...path.slice(cycleStart), node];
        cycles.push(cycle);
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recStack.add(node);

      const neighbors = this.dependencyGraph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (this.dependencyGraph.has(neighbor)) {
          dfs(neighbor, [...path, node]);
        }
      }

      recStack.delete(node);
    };

    for (const module of this.dependencyGraph.keys()) {
      if (!visited.has(module)) {
        dfs(module, []);
      }
    }

    // Deduplicate cycles
    return this.deduplicateCycles(cycles);
  }

  /**
   * Deduplicate cycles by normalizing representation.
   */
  private deduplicateCycles(cycles: string[][]): string[][] {
    const seen = new Set<string>();
    const unique: string[][] = [];

    for (const cycle of cycles) {
      if (cycle.length < 2) continue;

      // Normalize by starting from lexicographically smallest
      const minIdx = cycle.indexOf(cycle.reduce((a, b) => a < b ? a : b));
      const normalized = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
      const key = normalized.join(' -> ');
      const reverseKey = [...normalized].reverse().join(' -> ');
      const canonical = key < reverseKey ? key : reverseKey;

      if (!seen.has(canonical)) {
        seen.add(canonical);
        unique.push(normalized);
      }
    }

    return unique;
  }

  /**
   * Analyze coupling patterns.
   */
  private analyzeCouplingPatterns(): RawFinding[] {
    const findings: RawFinding[] = [];

    for (const [module, dependencies] of this.dependencyGraph) {
      const info = this.moduleInfo.get(module);
      const filePath = info?.filePath || '';

      // High fan-out (many outgoing dependencies)
      const fanOut = dependencies.size;
      if (fanOut > 10) {
        findings.push(createStandardFinding(
          `High Fan-Out: ${module}`,
          `Module has ${fanOut} outgoing dependencies (recommended: <10). This indicates the module may have too many responsibilities.`,
          fanOut > 20 ? 'high' : 'medium',
          filePath,
          1,
          'Reduce dependencies by using dependency injection or facade patterns. Consider breaking into smaller modules.',
          {
            tool: 'coupling-analyzer',
            patternType: 'high_fan_out',
            module,
            fanOut,
            dependencies: Array.from(dependencies),
          }
        ));
      }

      // High fan-in (many modules depending on this one)
      const fanIn = this.reverseGraph.get(module)?.size || 0;
      if (fanIn > 15) {
        findings.push(createStandardFinding(
          `High Fan-In: ${module}`,
          `Module is used by ${fanIn} other modules. Changes to this module could have wide-reaching effects.`,
          'medium',
          filePath,
          1,
          'Consider breaking large modules into smaller, focused components. Ensure this module has a stable API.',
          {
            tool: 'coupling-analyzer',
            patternType: 'high_fan_in',
            module,
            fanIn,
            dependents: Array.from(this.reverseGraph.get(module) || []),
          }
        ));
      }
    }

    // Circular dependencies
    const circularDeps = this.findCircularDependencies();
    for (const cycle of circularDeps) {
      const firstModule = cycle[0] || '';
      const info = this.moduleInfo.get(firstModule);
      const filePath = info?.filePath || '';

      findings.push(createStandardFinding(
        `Circular Dependency Detected`,
        `Circular dependency: ${cycle.join(' -> ')}. This can cause initialization issues and makes the code harder to understand.`,
        'high',
        filePath,
        1,
        'Break circular dependencies using dependency inversion, event systems, or intermediary modules.',
        {
          tool: 'coupling-analyzer',
          patternType: 'circular_dependency',
          cycle,
        }
      ));
    }

    return findings;
  }

  async analyzeTarget(targetPath: string): Promise<RawFinding[]> {
    const stat = fs.statSync(targetPath);
    const projectRoot = stat.isFile()
      ? this.findProjectRoot(targetPath)
      : targetPath;

    // Build dependency graph for the entire project
    this.buildDependencyGraph(projectRoot);

    // Analyze coupling patterns
    return this.analyzeCouplingPatterns();
  }

  getAnalyzerMetadata(): AnalyzerMetadata {
    return {
      name: 'Coupling Analysis Analyzer',
      version: '1.0.0',
      description: 'Analyzes code coupling patterns and dependency relationships',
      category: 'architecture',
      priority: 'high',
      capabilities: [
        'Multi-language import detection',
        'Dependency graph construction',
        'Circular dependency detection',
        'Fan-in/fan-out coupling metrics',
        'Coupling hotspot detection',
      ],
      supportedLanguages: Object.values(this.extensionLanguageMap),
      tool: 'coupling-analyzer',
    };
  }
}
