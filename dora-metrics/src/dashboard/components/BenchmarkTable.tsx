/**
 * BenchmarkTable Component
 * Shows DORA benchmarks comparison with current metrics
 */

import React from 'react';
import type { DORAMetrics, PerformanceLevel } from '../../types';

interface BenchmarkTableProps {
  metrics: DORAMetrics;
}

interface BenchmarkRow {
  metric: string;
  current: string;
  elite: string;
  high: string;
  medium: string;
  low: string;
  currentLevel: PerformanceLevel;
}

const levelColors: Record<PerformanceLevel, string> = {
  elite: '#22c55e',
  high: '#3b82f6',
  medium: '#f59e0b',
  low: '#ef4444',
};

export const BenchmarkTable: React.FC<BenchmarkTableProps> = ({ metrics }) => {
  const df = metrics.deploymentFrequency;
  const lt = metrics.leadTimeForChanges;
  const cfr = metrics.changeFailureRate;
  const rt = metrics.failedDeploymentRecoveryTime;

  const formatLeadTime = (hours: number): string => {
    if (hours < 24) return `${hours.toFixed(1)} hrs`;
    if (hours < 168) return `${(hours / 24).toFixed(1)} days`;
    if (hours < 720) return `${(hours / 168).toFixed(1)} weeks`;
    return `${(hours / 720).toFixed(1)} months`;
  };

  const rows: BenchmarkRow[] = [
    {
      metric: 'Deployment Frequency',
      current: `${df.value} per ${df.unit}`,
      elite: 'Multiple/day',
      high: 'Daily to weekly',
      medium: 'Weekly to monthly',
      low: '< Monthly',
      currentLevel: df.level,
    },
    {
      metric: 'Lead Time for Changes',
      current: formatLeadTime(lt.median),
      elite: '< 1 day',
      high: '1 day - 1 week',
      medium: '1 week - 1 month',
      low: '> 1 month',
      currentLevel: lt.level,
    },
    {
      metric: 'Change Failure Rate',
      current: `${cfr.rate.toFixed(1)}%`,
      elite: '< 5%',
      high: '5-10%',
      medium: '10-15%',
      low: '> 15%',
      currentLevel: cfr.level,
    },
    {
      metric: 'Recovery Time',
      current: formatLeadTime(rt.median),
      elite: '< 1 hour',
      high: '< 1 day',
      medium: '< 1 week',
      low: '> 1 week',
      currentLevel: rt.level,
    },
  ];

  const headerStyle: React.CSSProperties = {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '2px solid #e5e7eb',
  };

  const cellStyle: React.CSSProperties = {
    padding: '16px',
    fontSize: '14px',
    borderBottom: '1px solid #f3f4f6',
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        overflowX: 'auto',
      }}
    >
      <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 600, color: '#111827' }}>
        DORA Benchmarks Comparison
      </h3>

      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f9fafb' }}>
            <th style={headerStyle}>Metric</th>
            <th style={{ ...headerStyle, backgroundColor: '#f0fdf4' }}>Your Value</th>
            <th style={{ ...headerStyle, color: levelColors.elite }}>Elite</th>
            <th style={{ ...headerStyle, color: levelColors.high }}>High</th>
            <th style={{ ...headerStyle, color: levelColors.medium }}>Medium</th>
            <th style={{ ...headerStyle, color: levelColors.low }}>Low</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
              <td style={{ ...cellStyle, fontWeight: 500, color: '#374151' }}>{row.metric}</td>
              <td
                style={{
                  ...cellStyle,
                  fontWeight: 600,
                  color: levelColors[row.currentLevel],
                  backgroundColor: `${levelColors[row.currentLevel]}10`,
                }}
              >
                {row.current}
              </td>
              <td style={{ ...cellStyle, color: row.currentLevel === 'elite' ? levelColors.elite : '#9ca3af' }}>
                {row.elite}
              </td>
              <td style={{ ...cellStyle, color: row.currentLevel === 'high' ? levelColors.high : '#9ca3af' }}>
                {row.high}
              </td>
              <td style={{ ...cellStyle, color: row.currentLevel === 'medium' ? levelColors.medium : '#9ca3af' }}>
                {row.medium}
              </td>
              <td style={{ ...cellStyle, color: row.currentLevel === 'low' ? levelColors.low : '#9ca3af' }}>
                {row.low}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
          <strong>Note:</strong> Benchmarks are based on the DORA State of DevOps Report (2023-2024).
          Your current level is highlighted in each row.
        </p>
      </div>
    </div>
  );
};

export default BenchmarkTable;
