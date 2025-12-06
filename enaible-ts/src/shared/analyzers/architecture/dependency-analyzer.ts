/**
 * Dependency Analysis Analyzer - Project Dependency Analysis.
 *
 * Analyzes project dependencies, version conflicts, and security vulnerabilities.
 * Parses multiple dependency file formats (package.json, requirements.txt, etc.).
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

interface VulnerabilityInfo {
  versions: string[];
  severity: string;
  cve: string;
  description: string;
}

interface DependencyFileConfig {
  language: string;
  parser: (filePath: string) => Record<string, string>;
}

/**
 * Dependency analyzer for project dependencies.
 */
@registerAnalyzer('architecture:dependency')
export class DependencyAnalyzer extends BaseAnalyzer {
  private dependencies: Map<string, Record<string, string>> = new Map();

  /** Known vulnerabilities (simplified - in production use a proper CVE database) */
  private vulnerabilities: Record<string, VulnerabilityInfo> = {
    lodash: {
      versions: ['<4.17.21'],
      severity: 'high',
      cve: 'CVE-2021-23337',
      description: 'Command injection vulnerability',
    },
    axios: {
      versions: ['<0.21.1'],
      severity: 'medium',
      cve: 'CVE-2020-28168',
      description: 'Server-side request forgery vulnerability',
    },
    pillow: {
      versions: ['<8.1.1'],
      severity: 'high',
      cve: 'CVE-2021-25287',
      description: 'Buffer overflow in image processing',
    },
  };

  /** Dependency file parsers */
  private dependencyFiles: Record<string, DependencyFileConfig> = {
    'package.json': {
      language: 'javascript',
      parser: this.parsePackageJson.bind(this),
    },
    'requirements.txt': {
      language: 'python',
      parser: this.parseRequirementsTxt.bind(this),
    },
    'pyproject.toml': {
      language: 'python',
      parser: this.parsePyprojectToml.bind(this),
    },
    'go.mod': {
      language: 'go',
      parser: this.parseGoMod.bind(this),
    },
    'Cargo.toml': {
      language: 'rust',
      parser: this.parseCargoToml.bind(this),
    },
    'Gemfile': {
      language: 'ruby',
      parser: this.parseGemfile.bind(this),
    },
    'composer.json': {
      language: 'php',
      parser: this.parseComposerJson.bind(this),
    },
    'pom.xml': {
      language: 'java',
      parser: this.parsePomXml.bind(this),
    },
  };

  constructor(config?: Partial<AnalyzerConfig>) {
    const depConfig = createDefaultConfig({
      codeExtensions: new Set([
        '.json', '.txt', '.toml', '.xml', '.gradle', '.yaml', '.yml',
        '.lock', '.cfg', '.ini', '.mod',
      ]),
      skipPatterns: new Set([
        'node_modules', '.git', '__pycache__', 'dist', 'build',
        'venv', 'env', '.venv', 'site-packages', 'vendor',
      ]),
      ...config,
    });

    super('architecture', depConfig);
  }

  /**
   * Parse package.json file.
   */
  private parsePackageJson(filePath: string): Record<string, string> {
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return {
        ...(content.dependencies || {}),
        ...(content.devDependencies || {}),
      };
    } catch {
      return {};
    }
  }

  /**
   * Parse requirements.txt file.
   */
  private parseRequirementsTxt(filePath: string): Record<string, string> {
    const deps: Record<string, string> = {};
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([a-zA-Z0-9\-_.]+)([><=!~]+[0-9.*]+.*)?/);
          if (match) {
            deps[match[1]] = match[2] || '';
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
    return deps;
  }

  /**
   * Parse pyproject.toml file.
   */
  private parsePyprojectToml(filePath: string): Record<string, string> {
    const deps: Record<string, string> = {};
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const depMatch = content.match(/dependencies\s*=\s*\[(.*?)\]/s);
      if (depMatch) {
        const depsText = depMatch[1];
        for (const match of depsText.matchAll(/["']([^"']+)["']/g)) {
          const depLine = match[1];
          const pkgMatch = depLine.match(/^([a-zA-Z0-9\-_.]+)([><=!~]+[0-9.*]+.*)?/);
          if (pkgMatch) {
            deps[pkgMatch[1]] = pkgMatch[2] || '';
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
    return deps;
  }

  /**
   * Parse go.mod file.
   */
  private parseGoMod(filePath: string): Record<string, string> {
    const deps: Record<string, string> = {};
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        const reqMatch = trimmed.match(/^require\s+([^\s]+)\s+(.+)/);
        if (reqMatch) {
          deps[reqMatch[1]] = reqMatch[2];
        } else if (trimmed.match(/^\s+([^\s]+)\s+(.+)/)) {
          const match = trimmed.match(/^\s+([^\s]+)\s+(.+)/);
          if (match) {
            deps[match[1]] = match[2];
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
    return deps;
  }

  /**
   * Parse Cargo.toml file.
   */
  private parseCargoToml(filePath: string): Record<string, string> {
    const deps: Record<string, string> = {};
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const depMatch = content.match(/\[dependencies\](.*?)(?=\[|$)/s);
      if (depMatch) {
        const depsContent = depMatch[1];
        for (const match of depsContent.matchAll(/(\w+)\s*=\s*["']([^"']*?)["']/g)) {
          deps[match[1]] = match[2];
        }
      }
    } catch {
      // Ignore parse errors
    }
    return deps;
  }

  /**
   * Parse Gemfile.
   */
  private parseGemfile(filePath: string): Record<string, string> {
    const deps: Record<string, string> = {};
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const line of content.split('\n')) {
        const match = line.match(/gem ['"]([^'"]+)['"],?\s*['"]?([^'"]*)?['"]?/);
        if (match) {
          deps[match[1]] = match[2] || '';
        }
      }
    } catch {
      // Ignore parse errors
    }
    return deps;
  }

  /**
   * Parse composer.json file.
   */
  private parseComposerJson(filePath: string): Record<string, string> {
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return {
        ...(content.require || {}),
        ...(content['require-dev'] || {}),
      };
    } catch {
      return {};
    }
  }

  /**
   * Parse pom.xml file.
   */
  private parsePomXml(filePath: string): Record<string, string> {
    const deps: Record<string, string> = {};
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const depPattern = /<dependency>.*?<groupId>(.*?)<\/groupId>.*?<artifactId>(.*?)<\/artifactId>.*?<version>(.*?)<\/version>.*?<\/dependency>/gs;
      for (const match of content.matchAll(depPattern)) {
        const packageName = `${match[1]}:${match[2]}`;
        deps[packageName] = match[3];
      }
    } catch {
      // Ignore parse errors
    }
    return deps;
  }

  /**
   * Check for known vulnerabilities.
   */
  private checkVulnerability(
    packageName: string,
    version: string,
    filePath: string
  ): RawFinding | null {
    const vulnInfo = this.vulnerabilities[packageName.toLowerCase()];
    if (vulnInfo && version) {
      // Simplified version check - in production use semver
      const hasVuln = vulnInfo.versions.some(() =>
        version.includes('<') || version.includes('==')
      );

      if (hasVuln) {
        return createStandardFinding(
          `Security Vulnerability: ${packageName} (${vulnInfo.cve})`,
          `Package ${packageName} version ${version} has a known security vulnerability: ${vulnInfo.description}`,
          vulnInfo.severity,
          filePath,
          1,
          `Update ${packageName} to a version that fixes ${vulnInfo.cve}. Check security advisories for the latest safe version.`,
          {
            tool: 'dependency-analyzer',
            vulnerabilityType: 'known_cve',
            package: packageName,
            version,
            cve: vulnInfo.cve,
          }
        );
      }
    }
    return null;
  }

  /**
   * Check for outdated version patterns.
   */
  private checkOutdatedVersion(
    packageName: string,
    version: string,
    filePath: string
  ): RawFinding | null {
    const outdatedIndicators = [
      { pattern: '==1.', description: 'major version 1.x may be outdated' },
      { pattern: '==0.', description: 'version 0.x may be in beta/development' },
      { pattern: '<2.', description: 'version constraint may be too restrictive' },
    ];

    for (const { pattern, description } of outdatedIndicators) {
      if (version.includes(pattern)) {
        return createStandardFinding(
          `Potentially Outdated: ${packageName}`,
          `Package ${packageName} version ${version} - ${description}`,
          'low',
          filePath,
          1,
          `Check if ${packageName} has newer stable versions available. Update version constraints if appropriate.`,
          {
            tool: 'dependency-analyzer',
            dependencyIssue: 'outdated_version',
            package: packageName,
            version,
          }
        );
      }
    }
    return null;
  }

  /**
   * Analyze a dependency file.
   */
  private analyzeDependencyFile(filePath: string): RawFinding[] {
    const findings: RawFinding[] = [];
    const fileName = path.basename(filePath);
    const fileConfig = this.dependencyFiles[fileName];

    if (!fileConfig) {
      return findings;
    }

    try {
      const deps = fileConfig.parser(filePath);
      this.dependencies.set(filePath, deps);

      for (const [packageName, version] of Object.entries(deps)) {
        // Check vulnerabilities
        const vulnFinding = this.checkVulnerability(packageName, version, filePath);
        if (vulnFinding) {
          findings.push(vulnFinding);
        }

        // Check outdated versions
        const outdatedFinding = this.checkOutdatedVersion(packageName, version, filePath);
        if (outdatedFinding) {
          findings.push(outdatedFinding);
        }
      }
    } catch (err) {
      findings.push(createStandardFinding(
        `Dependency File Parse Error: ${fileName}`,
        `Failed to parse dependency file: ${String(err)}`,
        'medium',
        filePath,
        1,
        'Check file syntax and format. Ensure it follows standard conventions.',
        {
          tool: 'dependency-analyzer',
          errorType: 'parse_error',
          fileType: fileName,
        }
      ));
    }

    return findings;
  }

  /**
   * Analyze version conflicts across files.
   */
  private analyzeVersionConflicts(): RawFinding[] {
    const findings: RawFinding[] = [];
    const packageVersions: Map<string, Array<{ file: string; version: string }>> = new Map();

    // Collect all versions for each package
    for (const [filePath, deps] of this.dependencies) {
      for (const [pkg, version] of Object.entries(deps)) {
        if (version) {
          if (!packageVersions.has(pkg)) {
            packageVersions.set(pkg, []);
          }
          packageVersions.get(pkg)!.push({ file: filePath, version });
        }
      }
    }

    // Check for conflicts
    for (const [pkg, versions] of packageVersions) {
      if (versions.length > 1) {
        const uniqueVersions = new Set(versions.map(v => v.version));
        if (uniqueVersions.size > 1) {
          const conflictDesc = versions
            .map(v => `${path.basename(v.file)}:${v.version}`)
            .join(', ');

          findings.push(createStandardFinding(
            `Version Conflict: ${pkg}`,
            `Package ${pkg} has conflicting version requirements: ${conflictDesc}`,
            'medium',
            versions[0].file,
            1,
            `Resolve version conflict for ${pkg} by aligning version requirements across dependency files.`,
            {
              tool: 'dependency-analyzer',
              dependencyIssue: 'version_conflict',
              package: pkg,
              conflictingVersions: Array.from(uniqueVersions),
              affectedFiles: versions.map(v => v.file),
            }
          ));
        }
      }
    }

    return findings;
  }

  /**
   * Find all dependency files in a directory.
   */
  private findDependencyFiles(dirPath: string): string[] {
    const files: string[] = [];

    const walkDir = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (this.config.skipPatterns.has(entry.name)) {
            continue;
          }

          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile() && this.dependencyFiles[entry.name]) {
            files.push(fullPath);
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    walkDir(dirPath);
    return files;
  }

  async analyzeTarget(targetPath: string): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];
    this.dependencies.clear();

    try {
      const stat = fs.statSync(targetPath);

      if (stat.isFile()) {
        const fileName = path.basename(targetPath);
        if (this.dependencyFiles[fileName]) {
          findings.push(...this.analyzeDependencyFile(targetPath));
        }
      } else {
        // Analyze all dependency files in directory
        const depFiles = this.findDependencyFiles(targetPath);
        for (const depFile of depFiles) {
          findings.push(...this.analyzeDependencyFile(depFile));
        }

        // Check for version conflicts across files
        if (depFiles.length > 1) {
          findings.push(...this.analyzeVersionConflicts());
        }
      }
    } catch (err) {
      this.log('analysis_error', { path: targetPath, error: String(err) });
    }

    return findings;
  }

  getAnalyzerMetadata(): AnalyzerMetadata {
    return {
      name: 'Dependency Analysis Analyzer',
      version: '1.0.0',
      description: 'Analyzes project dependencies and identifies potential issues',
      category: 'architecture',
      priority: 'high',
      capabilities: [
        'Multi-language dependency file parsing',
        'Version conflict detection',
        'Security vulnerability identification',
        'Outdated dependency detection',
      ],
      supportedLanguages: ['JavaScript', 'Python', 'Go', 'Rust', 'Ruby', 'PHP', 'Java'],
      tool: 'dependency-analyzer',
    };
  }
}
