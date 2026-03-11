# Design Implementation Reviewer Agent

> Source: [EveryInc/claude_commands](https://github.com/EveryInc/claude_commands/blob/main/agents/design-implementation-reviewer.md)

This agent specializes in verifying that UI implementations match Figma design specifications. It's invoked after code development to compare live implementations against design files.

## Key Capabilities

The agent performs systematic visual comparisons using a structured workflow:

1. **Implementation Capture** - Screenshots at various viewport sizes and interactive states
2. **Design Retrieval** - Accesses Figma files to extract design tokens and specifications
3. **Comparative Analysis** - Evaluates visual fidelity, typography, colors, spacing, responsiveness, and accessibility
4. **Structured Reporting** - Provides organized feedback on correct elements, minor discrepancies, and major issues

## Review Structure

The agent generates reports categorizing findings as:

| Symbol | Category | Description |
|--------|----------|-------------|
| ✅ | Correct | Correctly implemented elements |
| ⚠️ | Minor | Minor discrepancies with specified fixes |
| ❌ | Major | Major deviations requiring correction |
| 📐 | Measurements | Precise measurements comparison |
| 💡 | Recommendations | Improvement recommendations |

## Core Principles

The reviewer emphasizes:
- **Precision**: Exact pixel values and hex codes
- **Technical Awareness**: Considers browser constraints and rendering variations
- **User Impact**: Prioritizes issues affecting user experience
- **Comprehensive Testing**: Tests across multiple interactive states
- **Consistency**: Maintains design system alignment

## Edge Cases Handled

The agent recognizes and accounts for:
- Font availability and fallbacks
- Dynamic content effects on layout
- Animation and transition differences
- Accessibility considerations that may require design deviations
- Browser-specific rendering variations

## Usage Example

```markdown
Review the implementation of the ProductCard component against the Figma design.

Figma: https://figma.com/file/abc/Design?node-id=product-card
Implementation: src/components/ProductCard.tsx
Live URL: http://localhost:3000/products

Check:
- All viewport sizes (mobile, tablet, desktop)
- Hover and focus states
- Loading and error states
- Dark mode variant
```

## Report Format Example

```markdown
# Design Implementation Review: ProductCard

## Summary
Overall implementation fidelity: 87%

## Findings

### ✅ Correctly Implemented
- Card border radius (8px) matches design
- Shadow values correct (0 2px 8px rgba(0,0,0,0.1))
- Image aspect ratio (16:9) preserved
- Typography hierarchy maintained

### ⚠️ Minor Discrepancies
1. **Padding inconsistency**
   - Design: 16px all sides
   - Implementation: 16px horizontal, 12px vertical
   - Fix: Update padding to `padding: 16px`

2. **Color variation**
   - Design: #333333 for title
   - Implementation: #2d2d2d
   - Fix: Use design token `--color-text-primary`

### ❌ Major Deviations
1. **Missing hover state**
   - Design shows elevation increase on hover
   - Implementation: No hover effect
   - Fix: Add `transform: translateY(-2px)` and shadow increase

### 📐 Measurements
| Property | Design | Implementation | Status |
|----------|--------|----------------|--------|
| Width | 320px | 320px | ✅ |
| Height | auto | auto | ✅ |
| Padding | 16px | 12-16px | ⚠️ |
| Gap | 12px | 12px | ✅ |

### 💡 Recommendations
- Consider adding focus-visible styles for accessibility
- Image loading skeleton could match design placeholder
```

## Integration with Workflow

This agent is designed to be used in a handoff workflow:

```yaml
# In your implementation agent
handoffs:
  - label: Review Implementation
    agent: design-reviewer
    prompt: Review the implementation I just created against the Figma design.
    send: false
```

## Required Tools

For full functionality, this agent needs:
- Browser automation (screenshots)
- Figma MCP access (design retrieval)
- File system access (code review)

## Best Practices for Using This Agent

1. **Provide Both Sources**: Always include both the Figma link and implementation location
2. **Specify Viewports**: List the viewport sizes that need review
3. **Include States**: Mention all interactive states to check
4. **Set Context**: Provide any known constraints or intentional deviations
5. **Iterate**: Use findings to fix issues, then re-review
