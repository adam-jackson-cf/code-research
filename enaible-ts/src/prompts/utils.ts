/**
 * Utilities for parsing shared prompt metadata.
 *
 * Supports the unified bullet-style Variables section using @TOKENS.
 *
 * Format:
 *
 * ## Variables
 *
 * ### Required
 * - @TARGET_PATH = $1 — description
 *
 * ### Optional (derived from $ARGUMENTS)
 * - @MIN_SEVERITY = --min-severity
 * - @EXCLUDE = --exclude [repeatable]
 *
 * ### Derived (internal)
 * - @MAX_CHARS = 150000
 */

import { VariableSpec } from './types.js';

// Regex patterns
const H2_HEADING = /^##\s+variables\s*$/i;
const H3_REQUIRED = /^###\s+required\s*$/i;
const H3_OPTIONAL = /^###\s+optional(\s*\(.*\))?\s*$/i;
const H3_DERIVED = /^###\s+derived(\s*\(.*\))?\s*$/i;
const BULLET = /^[-*]\s+(.+?)\s*$/;
const TOKEN_RE = /@([A-Z][A-Z0-9_]*)$/;
const MAPPING_SPLIT = /\s*=\s*/;
const POS_VALUE = /^\$(\d+)\s*(?:\[.*?\])?$/;
const FLAG_VALUE = /^(--[a-z0-9][a-z0-9-]*)\s*(?:\[.*?\])?$/i;
const VARIABLE_HEADER_PATTERN = /^\|\s*Token(?:\/Flag)?\s*\|\s*Type\s*\|\s*Description\s*\|$/i;
const POS_INDEX_RE = /#(\d+)/;
const FLAG_RE = /--[a-z0-9][a-z0-9-]*/i;

/**
 * Extract variable definitions from a markdown prompt body.
 * Returns a tuple of [variables, body_without_variables_section].
 */
export function extractVariables(markdown: string): [VariableSpec[], string] {
  const lines = markdown.split('\n');
  const variables: VariableSpec[] = [];
  const newLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    if (H2_HEADING.test(lines[i])) {
      const block: string[] = [];
      while (i < lines.length) {
        block.push(lines[i]);
        i++;
        if (i < lines.length && lines[i].startsWith('## ')) {
          break;
        }
      }

      let formattedBlock: string[] | null = null;
      const parsed = parseVariablesBullets(block.slice(1));
      if (parsed.length > 0) {
        variables.push(...parsed);
        formattedBlock = formatVariablesBlock(parsed);
      } else {
        const tableLines = block.filter((ln) => ln.trim().startsWith('|'));
        if (tableLines.length > 0) {
          const tableVars = parseVariablesTable(tableLines);
          variables.push(...tableVars);
          formattedBlock = formatVariablesBlock(tableVars);
        }
      }

      if (formattedBlock) {
        newLines.push(...formattedBlock);
      } else {
        newLines.push(...block);
      }
      continue;
    }

    newLines.push(lines[i]);
    i++;
  }

  let body = newLines.join('\n').replace(/^\n+|\n+$/g, '');
  return [variables, body ? body + '\n' : ''];
}

/**
 * Format variables block for output.
 */
function formatVariablesBlock(variables: VariableSpec[]): string[] {
  const required = variables.filter((v) => v.kind === 'positional');
  const optional = variables.filter((v) => v.kind === 'flag' || v.kind === 'named');
  const derived = variables.filter((v) => v.kind === 'derived');

  const lines: string[] = ['## Variables', ''];

  if (required.length > 0) {
    lines.push('### Required');
    lines.push('');
    for (const v of required) {
      const desc = v.description ? ` — ${v.description}` : '';
      lines.push(`- ${v.token} = $${v.positionalIndex}${desc}`);
    }
    lines.push('');
  }

  if (optional.length > 0) {
    lines.push('### Optional (derived from $ARGUMENTS)');
    lines.push('');
    for (const v of optional) {
      const repeatable = v.repeatable ? ' [repeatable]' : '';
      const desc = v.description ? ` — ${v.description}` : '';
      lines.push(`- ${v.token} = ${v.flagName}${repeatable}${desc}`);
    }
    lines.push('');
  }

  if (derived.length > 0) {
    lines.push('### Derived (internal)');
    lines.push('');
    for (const v of derived) {
      const detail = v.description || v.typeText.trim();
      const suffix = detail ? ` — ${detail}` : '';
      lines.push(`- ${v.token}${suffix}`);
    }
    lines.push('');
  }

  return lines;
}

/**
 * Parse Variables section from bullet-style markdown lines.
 */
function parseVariablesBullets(blockLines: string[]): VariableSpec[] {
  let section: string | null = null;
  const variables: VariableSpec[] = [];
  const positionalSeen = new Set<number>();

  for (const raw of blockLines) {
    const line = raw.trim();
    if (!line) continue;

    // Detect section headers
    const detected = detectSection(line);
    if (detected !== null && detected !== section) {
      section = detected;
      continue;
    }

    // Parse bullet lines
    const match = BULLET.exec(line);
    if (!match || section === null) continue;

    const content = match[1];

    // Skip placeholder indicating no variables in this section
    if (content.trim() === '(none)') continue;

    // Parse line components
    const { mappingPart, description } = parseVariableLine(content);
    const { tokenPart, valuePart } = extractTokenAndValue(mappingPart, section);

    // For required variables without mapping, raise error before skipping
    if (tokenPart === null) {
      if (section === 'required') {
        const tokMatch = TOKEN_RE.exec(mappingPart.trim());
        if (tokMatch) {
          const token = `@${tokMatch[1]}`;
          throw new Error(`Required variable '${token}' must have a mapping (e.g., $1).`);
        }
      }
      continue;
    }

    // Validate and normalize token
    const token = validateToken(tokenPart);

    // For required variables, valuePart must be present
    if (section === 'required' && valuePart === null) {
      throw new Error(`Required variable '${token}' must have a mapping (e.g., $1).`);
    }

    // Create variable spec
    const spec = createVariableSpec(token, section, description, valuePart, positionalSeen);
    variables.push(spec);
  }

  return variables;
}

/**
 * Parse legacy markdown table lines into VariableSpec entries.
 */
function parseVariablesTable(tableLines: string[]): VariableSpec[] {
  const rows = tableLines.map((r) => r.trim()).filter((r) => r);
  if (rows.length === 0) return [];

  const header = rows[0];
  if (!VARIABLE_HEADER_PATTERN.test(header)) {
    throw new Error('Variables table must have columns: Token | Type | Description');
  }

  // Skip header and alignment row if present
  let startIdx = 1;
  if (startIdx < rows.length && /^[|:\-\s]+$/.test(rows[startIdx].replace(/ /g, ''))) {
    startIdx++;
  }

  const variables: VariableSpec[] = [];
  let positionalCounter = 0;

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    const cells = row
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length !== 3) continue;

    let [tokenCell, typeText, description] = cells;
    let tokenText = tokenCell.trim();
    if (tokenText.startsWith('`') && tokenText.endsWith('`')) {
      tokenText = tokenText.slice(1, -1).trim();
    }
    if (!tokenText.startsWith('@')) {
      throw new Error(`Variable token must start with '@' in tables: ${tokenText}`);
    }

    const { kind, required, positionalIndex, flagName } = interpretTypeCell(
      typeText,
      positionalCounter
    );
    let finalPositionalIndex = positionalIndex;

    if (kind === 'positional' && positionalIndex === null) {
      positionalCounter++;
      finalPositionalIndex = positionalCounter;
    } else if (kind === 'positional' && positionalIndex !== null) {
      positionalCounter = positionalIndex;
    }

    variables.push({
      token: tokenText,
      typeText,
      description,
      kind,
      required,
      flagName: flagName ?? undefined,
      positionalIndex: finalPositionalIndex ?? undefined,
      repeatable: typeText.toLowerCase().includes('repeatable'),
    });
  }

  return variables;
}

/**
 * Detect which Variables section a line represents.
 */
function detectSection(line: string): string | null {
  if (H3_REQUIRED.test(line)) return 'required';
  if (H3_OPTIONAL.test(line)) return 'optional';
  if (H3_DERIVED.test(line)) return 'derived';
  return null;
}

/**
 * Parse a bullet line into components.
 */
function parseVariableLine(content: string): { mappingPart: string; description: string } {
  const parts = content.split(/\s+—\s+|\s+-\s+/);
  return {
    mappingPart: parts[0].trim(),
    description: parts.length > 1 ? parts[1].trim() : '',
  };
}

/**
 * Extract token and value parts from mapping string.
 */
function extractTokenAndValue(
  mappingPart: string,
  section: string
): { tokenPart: string | null; valuePart: string | null } {
  const parts = mappingPart.split(MAPPING_SPLIT);
  if (parts.length === 1 && section === 'derived') {
    return { tokenPart: parts[0].trim(), valuePart: null };
  }
  if (parts.length === 2) {
    return { tokenPart: parts[0].trim(), valuePart: parts[1].trim() };
  }
  return { tokenPart: null, valuePart: null };
}

/**
 * Validate and normalize token format.
 */
function validateToken(tokenPart: string): string {
  const tokMatch = TOKEN_RE.exec(tokenPart);
  if (!tokMatch) {
    throw new Error(`Invalid token '${tokenPart}'. Tokens must be @UPPER_SNAKE_CASE.`);
  }
  return `@${tokMatch[1]}`;
}

/**
 * Create a VariableSpec from parsed components.
 */
function createVariableSpec(
  token: string,
  section: string,
  description: string,
  valuePart: string | null,
  positionalSeen: Set<number>
): VariableSpec {
  const repeatable = valuePart ? valuePart.toLowerCase().includes('[repeatable]') : false;

  if (section === 'required') {
    const { positionalIndex, typeText } = validateRequiredVariable(token, valuePart, positionalSeen);
    return {
      token,
      typeText,
      description,
      kind: 'positional',
      required: true,
      flagName: undefined,
      positionalIndex,
      repeatable,
    };
  }

  if (section === 'optional') {
    const { flagName, typeText } = validateOptionalVariable(token, valuePart, repeatable);
    return {
      token,
      typeText,
      description,
      kind: 'flag',
      required: false,
      flagName,
      positionalIndex: undefined,
      repeatable,
    };
  }

  // derived internal
  return {
    token,
    typeText: 'derived (internal)',
    description,
    kind: 'derived',
    required: false,
    flagName: undefined,
    positionalIndex: undefined,
    repeatable,
  };
}

/**
 * Validate and extract positional index for required variables.
 */
function validateRequiredVariable(
  token: string,
  valuePart: string | null,
  positionalSeen: Set<number>
): { positionalIndex: number; typeText: string } {
  if (!valuePart) {
    throw new Error(`Required variable '${token}' must have a mapping (e.g., $1).`);
  }
  const posMatch = POS_VALUE.exec(valuePart);
  if (!posMatch) {
    throw new Error(`Required variable '${token}' must map to $N (e.g., $1).`);
  }
  const positionalIndex = parseInt(posMatch[1], 10);
  if (positionalSeen.has(positionalIndex)) {
    throw new Error(`Duplicate positional index $${positionalIndex} for ${token}.`);
  }
  positionalSeen.add(positionalIndex);
  return {
    positionalIndex,
    typeText: `positional $${positionalIndex} (REQUIRED)`,
  };
}

/**
 * Validate and extract flag name for optional variables.
 */
function validateOptionalVariable(
  token: string,
  valuePart: string | null,
  repeatable: boolean
): { flagName: string; typeText: string } {
  if (!valuePart) {
    throw new Error(`Optional variable '${token}' must have a mapping (e.g., --flag).`);
  }
  const flagMatch = FLAG_VALUE.exec(valuePart);
  if (!flagMatch) {
    throw new Error(`Optional variable '${token}' must map to a --flag.`);
  }
  const flagName = flagMatch[1];
  const repeatableText = repeatable ? ', repeatable' : '';
  return {
    flagName,
    typeText: `derived from @ARGUMENTS (${flagName}) (optional${repeatableText})`,
  };
}

/**
 * Interpret the Type cell from a table row.
 */
function interpretTypeCell(
  typeCell: string,
  _currentPositionalCount: number
): { kind: VariableSpec['kind']; required: boolean; positionalIndex: number | null; flagName: string | null } {
  const text = typeCell.trim();
  const lower = text.toLowerCase();

  let required = lower.includes('required');
  const optional = lower.includes('optional');
  if (required && optional) {
    required = !optional;
  } else if (!required && !optional) {
    required = false;
  }

  let flagName: string | null = null;
  let positionalIndex: number | null = null;
  let kind: VariableSpec['kind'];

  if (lower.startsWith('positional')) {
    kind = 'positional';
    const match = POS_INDEX_RE.exec(lower);
    if (match) {
      positionalIndex = parseInt(match[1], 10);
    }
  } else if (lower.startsWith('flag')) {
    kind = 'flag';
    const flagMatch = FLAG_RE.exec(text);
    if (flagMatch) {
      flagName = flagMatch[0];
    }
  } else if (lower.startsWith('named')) {
    kind = 'named';
    const flagMatch = FLAG_RE.exec(text);
    if (flagMatch) {
      flagName = flagMatch[0];
    }
  } else {
    kind = 'config';
  }

  return { kind, required, positionalIndex, flagName };
}

/**
 * Generate argument hint from variables.
 */
export function argumentHintFromVariables(variables: VariableSpec[]): string {
  const tokens: string[] = [];

  const positional = variables
    .filter((v) => v.kind === 'positional')
    .sort((a, b) => (a.positionalIndex ?? 0) - (b.positionalIndex ?? 0));

  const flags = variables
    .filter((v) => v.kind === 'flag' || v.kind === 'named')
    .sort((a, b) => (a.flagName ?? a.token).toLowerCase().localeCompare((b.flagName ?? b.token).toLowerCase()));

  const formatLabel = (v: VariableSpec, base: string): string => {
    let label = base;
    if (!v.required) {
      label = `${label}?`;
    }
    return `[${label}]`;
  };

  for (const v of positional) {
    const label = v.token.replace(/^[$@]/, '').toLowerCase().replace(/_/g, '-');
    tokens.push(formatLabel(v, label));
  }

  for (const v of flags) {
    let base = v.flagName ?? v.token.replace(/^[$@]/, '');
    base = base.toLowerCase();
    tokens.push(formatLabel(v, base));
  }

  return tokens.join(' ');
}
