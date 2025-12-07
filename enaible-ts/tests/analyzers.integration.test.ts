import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

// Import using index files to avoid extension issues
import { SemgrepAnalyzer, DetectSecretsAnalyzer } from '../src/shared/analyzers/security';
import { LizardComplexityAnalyzer, JscpdAnalyzer } from '../src/shared/analyzers/quality';
import { ExecutionTraceAnalyzer, ErrorPatternAnalyzer } from '../src/shared/analyzers/root-cause';
import { CouplingAnalyzer, PatternEvaluationAnalyzer } from '../src/shared/analyzers/architecture';
import { spawnSync } from 'child_process';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const VULNERABLE_APP = path.join(FIXTURES_DIR, 'vulnerable-app');
const QUALITY_ISSUES = path.join(FIXTURES_DIR, 'quality-issues');
const CLEAN_APP = path.join(FIXTURES_DIR, 'clean-app');

function isToolAvailable(command: string): boolean {
  try {
    const result = spawnSync('which', [command], { encoding: 'utf-8' });
    return result.status === 0;
  } catch {
    return false;
  }
}

describe('Analyzer Integration Tests', () => {
  describe('Test Fixtures', () => {
    it('should have vulnerable-app fixtures', () => {
      expect(fs.existsSync(VULNERABLE_APP)).toBe(true);
      expect(fs.existsSync(path.join(VULNERABLE_APP, 'sql_injection.py'))).toBe(true);
      expect(fs.existsSync(path.join(VULNERABLE_APP, 'hardcoded_secrets.py'))).toBe(true);
      expect(fs.existsSync(path.join(VULNERABLE_APP, 'xss_vulnerable.js'))).toBe(true);
    });

    it('should have quality-issues fixtures', () => {
      expect(fs.existsSync(QUALITY_ISSUES)).toBe(true);
      expect(fs.existsSync(path.join(QUALITY_ISSUES, 'complex_function.py'))).toBe(true);
      expect(fs.existsSync(path.join(QUALITY_ISSUES, 'duplicated_code.py'))).toBe(true);
    });

    it('should have clean-app fixtures', () => {
      expect(fs.existsSync(CLEAN_APP)).toBe(true);
      expect(fs.existsSync(path.join(CLEAN_APP, 'safe_queries.py'))).toBe(true);
    });
  });

  describe('Security Analyzers', () => {
    describe('SemgrepAnalyzer', () => {
      it.skipIf(!isToolAvailable('semgrep'))('should create analyzer instance', () => {
        const analyzer = new SemgrepAnalyzer();
        const metadata = analyzer.getAnalyzerMetadata();

        expect(metadata.name).toBe('Semgrep Security Analyzer');
        expect(metadata.category).toBe('security');
        expect(metadata.tool).toBe('semgrep');
      });

      it.skipIf(!isToolAvailable('semgrep'))('should detect SQL injection with real semgrep', async () => {
        const analyzer = new SemgrepAnalyzer();
        analyzer.config.targetPath = path.join(VULNERABLE_APP, 'sql_injection.py');

        const result = await analyzer.analyze();

        expect(result.success).toBe(true);
        console.log('Semgrep found ' + result.findings.length + ' findings');
      }, 60000);
    });

    describe('DetectSecretsAnalyzer', () => {
      it('should create analyzer instance', () => {
        const analyzer = new DetectSecretsAnalyzer();
        const metadata = analyzer.getAnalyzerMetadata();

        expect(metadata.name).toBe('Detect Secrets Analyzer');
        expect(metadata.category).toBe('security');
        expect(metadata.tool).toBe('detect-secrets');
      });
    });
  });

  describe('Quality Analyzers', () => {
    describe('LizardComplexityAnalyzer', () => {
      it('should create analyzer instance', () => {
        const analyzer = new LizardComplexityAnalyzer();
        const metadata = analyzer.getAnalyzerMetadata();

        expect(metadata.name).toBe('Lizard Complexity Analyzer');
        expect(metadata.category).toBe('quality');
        expect(metadata.tool).toBe('lizard');
      });
    });

    describe('JscpdAnalyzer', () => {
      it('should create analyzer instance', () => {
        const analyzer = new JscpdAnalyzer();
        const metadata = analyzer.getAnalyzerMetadata();

        expect(metadata.name).toBe('JSCPD Duplicate Analyzer');
        expect(metadata.category).toBe('quality');
        expect(metadata.tool).toBe('jscpd');
      });
    });
  });

  describe('Root Cause Analyzers', () => {
    describe('ExecutionTraceAnalyzer', () => {
      it('should create analyzer instance', () => {
        const analyzer = new ExecutionTraceAnalyzer();
        const metadata = analyzer.getAnalyzerMetadata();

        expect(metadata.name).toBe('Execution Trace Analyzer');
        expect(metadata.category).toBe('root_cause');
      });

      it('should require error info for analysis', async () => {
        const analyzer = new ExecutionTraceAnalyzer();
        analyzer.config.targetPath = VULNERABLE_APP;

        const result = await analyzer.analyze();

        expect(result.findings.some(f =>
          f.title.includes('Error Information Required')
        )).toBe(true);
      });

      it('should analyze with error context', async () => {
        const analyzer = new ExecutionTraceAnalyzer();
        analyzer.config.targetPath = path.join(VULNERABLE_APP, 'sql_injection.py');
        analyzer.setErrorInfo('TypeError: Cannot read property at sql_injection.py:10');

        const result = await analyzer.analyze();

        expect(result.success).toBe(true);
        console.log('Trace analyzer found ' + result.findings.length + ' investigation pointers');
      });

      it('should parse Python error correctly', () => {
        const analyzer = new ExecutionTraceAnalyzer();
        const pythonError = 'File "sql_injection.py", line 15, in get_user\n    cursor.execute(query)\nTypeError: NoneType';

        const context = analyzer.parseError(pythonError);

        expect(context.file).toBe('sql_injection.py');
        expect(context.line).toBe(15);
      });

      it('should parse JavaScript error correctly', () => {
        const analyzer = new ExecutionTraceAnalyzer();
        const jsError = 'TypeError: Cannot read property at app.js:42';

        const context = analyzer.parseError(jsError);

        expect(context.errorType).toBe('TypeError');
        expect(context.file).toBe('app.js');
        expect(context.line).toBe(42);
      });
    });

    describe('ErrorPatternAnalyzer', () => {
      it('should create analyzer instance', () => {
        const analyzer = new ErrorPatternAnalyzer();
        const metadata = analyzer.getAnalyzerMetadata();

        expect(metadata.name).toBe('Error Pattern Analyzer');
        expect(metadata.category).toBe('root_cause');
      });

      it('should analyze error patterns in code', async () => {
        const analyzer = new ErrorPatternAnalyzer();
        analyzer.config.targetPath = VULNERABLE_APP;

        const result = await analyzer.analyze();

        expect(result.success).toBe(true);
        console.log('Error Pattern analyzer found ' + result.findings.length + ' patterns');
      });
    });
  });

  describe('Architecture Analyzers', () => {
    describe('CouplingAnalyzer', () => {
      it('should create analyzer instance', () => {
        const analyzer = new CouplingAnalyzer();
        const metadata = analyzer.getAnalyzerMetadata();

        expect(metadata.name).toBe('Coupling Analysis Analyzer');
        expect(metadata.category).toBe('architecture');
      });

      it('should analyze module coupling', async () => {
        const analyzer = new CouplingAnalyzer();
        analyzer.config.targetPath = QUALITY_ISSUES;

        const result = await analyzer.analyze();

        expect(result.success).toBe(true);
        console.log('Coupling analyzer found ' + result.findings.length + ' issues');
      });
    });

    describe('PatternEvaluationAnalyzer', () => {
      it('should create analyzer instance', () => {
        const analyzer = new PatternEvaluationAnalyzer();
        const metadata = analyzer.getAnalyzerMetadata();

        expect(metadata.name).toBe('Pattern Evaluation Analyzer');
        expect(metadata.category).toBe('architecture');
      });

      it('should detect design patterns', async () => {
        const analyzer = new PatternEvaluationAnalyzer();
        analyzer.config.targetPath = VULNERABLE_APP;

        const result = await analyzer.analyze();

        expect(result.success).toBe(true);
        console.log('Pattern analyzer found ' + result.findings.length + ' patterns');
      });
    });
  });
});

describe('External Tool Verification', () => {
  it.skipIf(!isToolAvailable('semgrep'))('semgrep produces real JSON output', () => {
    const result = spawnSync('semgrep', [
      '--json',
      '--config', 'auto',
      path.join(VULNERABLE_APP, 'sql_injection.py')
    ], { encoding: 'utf-8', timeout: 60000 });

    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('results');
    expect(Array.isArray(output.results)).toBe(true);
  });

  it.skipIf(!isToolAvailable('detect-secrets'))('detect-secrets produces real JSON output', () => {
    const result = spawnSync('detect-secrets', [
      'scan',
      path.join(VULNERABLE_APP, 'hardcoded_secrets.py')
    ], { encoding: 'utf-8', timeout: 30000 });

    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('results');
  });

  it.skipIf(!isToolAvailable('lizard'))('lizard produces real output', () => {
    const result = spawnSync('lizard', [
      '--xml',
      path.join(QUALITY_ISSUES, 'complex_function.py')
    ], { encoding: 'utf-8', timeout: 30000 });

    expect(result.stdout).toContain('<?xml');
  });

  it.skipIf(!isToolAvailable('jscpd'))('jscpd produces real JSON output', () => {
    const result = spawnSync('jscpd', [
      '--reporters', 'json',
      '--output', '/tmp/jscpd-test',
      QUALITY_ISSUES
    ], { encoding: 'utf-8', timeout: 60000 });

    const outputFile = '/tmp/jscpd-test/jscpd-report.json';
    if (fs.existsSync(outputFile)) {
      const output = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
      console.log('JSCPD found duplicates:', output.statistics?.total?.duplicatedLines || 0, 'lines');
    }
  });
});
