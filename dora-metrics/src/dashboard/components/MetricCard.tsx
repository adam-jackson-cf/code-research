/**
 * MetricCard Component
 * Displays a single DORA metric with value, level, and trend
 */

import React from 'react';
import type { PerformanceLevel } from '../../types';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  level: PerformanceLevel;
  trend: 'improving' | 'stable' | 'declining';
  description?: string;
  subtitle?: string;
}

const levelColors: Record<PerformanceLevel, { bg: string; text: string; border: string }> = {
  elite: { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
  high: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
  medium: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  low: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
};

const trendIcons: Record<string, string> = {
  improving: '\u2191', // Up arrow
  stable: '\u2192', // Right arrow
  declining: '\u2193', // Down arrow
};

const trendColors: Record<string, string> = {
  improving: '#22c55e',
  stable: '#6b7280',
  declining: '#ef4444',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  level,
  trend,
  description,
  subtitle,
}) => {
  const colors = levelColors[level];

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: `2px solid ${colors.border}`,
        minWidth: '250px',
        flex: '1',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </h3>
        <span
          style={{
            backgroundColor: colors.bg,
            color: colors.text,
            padding: '4px 12px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'capitalize',
          }}
        >
          {level}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '36px', fontWeight: 700, color: '#111827' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && (
          <span style={{ fontSize: '16px', color: '#6b7280' }}>
            {unit}
          </span>
        )}
        <span
          style={{
            fontSize: '20px',
            color: trendColors[trend],
            marginLeft: '8px',
          }}
          title={`Trend: ${trend}`}
        >
          {trendIcons[trend]}
        </span>
      </div>

      {subtitle && (
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6b7280' }}>
          {subtitle}
        </p>
      )}

      {description && (
        <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
          {description}
        </p>
      )}
    </div>
  );
};

export default MetricCard;
