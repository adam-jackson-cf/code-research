/**
 * OverallScore Component
 * Displays the overall DORA performance level with a visual indicator
 */

import React from 'react';
import type { PerformanceLevel, DORAMetrics } from '../../types';

interface OverallScoreProps {
  metrics: DORAMetrics;
}

const levelConfig: Record<
  PerformanceLevel,
  { color: string; bgColor: string; label: string; description: string }
> = {
  elite: {
    color: '#22c55e',
    bgColor: '#dcfce7',
    label: 'Elite Performer',
    description: 'Your team is among the top performers in the industry!',
  },
  high: {
    color: '#3b82f6',
    bgColor: '#dbeafe',
    label: 'High Performer',
    description: 'Great performance! Room for improvement to reach elite status.',
  },
  medium: {
    color: '#f59e0b',
    bgColor: '#fef3c7',
    label: 'Medium Performer',
    description: 'Good foundation. Focus on identified bottlenecks to improve.',
  },
  low: {
    color: '#ef4444',
    bgColor: '#fee2e2',
    label: 'Low Performer',
    description: 'Significant improvement opportunities exist across metrics.',
  },
};

const levelOrder: PerformanceLevel[] = ['low', 'medium', 'high', 'elite'];

export const OverallScore: React.FC<OverallScoreProps> = ({ metrics }) => {
  const config = levelConfig[metrics.overallLevel];
  const levelIndex = levelOrder.indexOf(metrics.overallLevel);
  const progressPercent = ((levelIndex + 1) / levelOrder.length) * 100;

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        border: `3px solid ${config.color}`,
        textAlign: 'center',
      }}
    >
      <h2 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Overall DORA Performance
      </h2>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: config.bgColor,
          padding: '16px 32px',
          borderRadius: '12px',
          margin: '16px 0',
        }}
      >
        <span style={{ fontSize: '32px', fontWeight: 800, color: config.color }}>
          {config.label}
        </span>
      </div>

      <p style={{ margin: '16px 0', fontSize: '16px', color: '#4b5563', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
        {config.description}
      </p>

      {/* Progress Bar */}
      <div style={{ marginTop: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}
        >
          {levelOrder.map((level) => (
            <span
              key={level}
              style={{
                fontSize: '12px',
                fontWeight: metrics.overallLevel === level ? 700 : 400,
                color: metrics.overallLevel === level ? levelConfig[level].color : '#9ca3af',
                textTransform: 'capitalize',
              }}
            >
              {level}
            </span>
          ))}
        </div>
        <div
          style={{
            height: '8px',
            backgroundColor: '#e5e7eb',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: config.color,
              borderRadius: '4px',
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      </div>

      {/* Individual Metric Levels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          marginTop: '24px',
          flexWrap: 'wrap',
        }}
      >
        <MetricPill label="Deploy Freq" level={metrics.deploymentFrequency.level} />
        <MetricPill label="Lead Time" level={metrics.leadTimeForChanges.level} />
        <MetricPill label="Failure Rate" level={metrics.changeFailureRate.level} />
        <MetricPill label="Recovery Time" level={metrics.failedDeploymentRecoveryTime.level} />
      </div>
    </div>
  );
};

interface MetricPillProps {
  label: string;
  level: PerformanceLevel;
}

const MetricPill: React.FC<MetricPillProps> = ({ label, level }) => {
  const config = levelConfig[level];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
      }}
    >
      <span style={{ fontSize: '12px', color: '#6b7280' }}>{label}:</span>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: config.color,
          textTransform: 'capitalize',
        }}
      >
        {level}
      </span>
    </div>
  );
};

export default OverallScore;
