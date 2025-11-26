/**
 * LeadTimeBreakdown Component
 * Shows breakdown of lead time into coding, review, and deploy phases
 */

import React from 'react';
import type { LeadTimeForChanges } from '../../types';

interface LeadTimeBreakdownProps {
  leadTime: LeadTimeForChanges;
}

interface PhaseData {
  name: string;
  hours: number;
  color: string;
  description: string;
}

export const LeadTimeBreakdown: React.FC<LeadTimeBreakdownProps> = ({ leadTime }) => {
  const { breakdown } = leadTime;

  const phases: PhaseData[] = [
    {
      name: 'Coding Time',
      hours: breakdown.codingTime,
      color: '#8b5cf6',
      description: 'Time from first commit to PR creation',
    },
    {
      name: 'Pickup Time',
      hours: breakdown.pickupTime,
      color: '#f59e0b',
      description: 'Time waiting for review to start',
    },
    {
      name: 'Review Time',
      hours: breakdown.reviewTime,
      color: '#3b82f6',
      description: 'Time from PR creation to merge',
    },
    {
      name: 'Deploy Time',
      hours: breakdown.deployTime,
      color: '#22c55e',
      description: 'Time from merge to production deployment',
    },
  ];

  const totalHours = phases.reduce((sum, p) => sum + p.hours, 0);

  const formatDuration = (hours: number): string => {
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    if (hours < 24) return `${hours.toFixed(1)} hrs`;
    return `${(hours / 24).toFixed(1)} days`;
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}
    >
      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: '#374151' }}>
        Lead Time Breakdown
      </h3>
      <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#6b7280' }}>
        Median total: <strong>{formatDuration(leadTime.median)}</strong>
      </p>

      {/* Stacked Bar Visualization */}
      <div
        style={{
          display: 'flex',
          height: '40px',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '24px',
        }}
      >
        {phases.map((phase) => {
          const widthPercent = totalHours > 0 ? (phase.hours / totalHours) * 100 : 25;
          return (
            <div
              key={phase.name}
              style={{
                width: `${widthPercent}%`,
                backgroundColor: phase.color,
                minWidth: widthPercent > 0 ? '20px' : '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 600,
                transition: 'width 0.3s ease',
              }}
              title={`${phase.name}: ${formatDuration(phase.hours)}`}
            >
              {widthPercent > 15 ? formatDuration(phase.hours) : ''}
            </div>
          );
        })}
      </div>

      {/* Phase Details */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {phases.map((phase) => (
          <div
            key={phase.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '3px',
                backgroundColor: phase.color,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                  {phase.name}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: phase.color }}>
                  {formatDuration(phase.hours)}
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                {phase.description}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Percentile Stats */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid #e5e7eb',
        }}
      >
        <StatBox label="Median" value={formatDuration(leadTime.median)} />
        <StatBox label="Mean" value={formatDuration(leadTime.mean)} />
        <StatBox label="P90" value={formatDuration(leadTime.p90)} highlight />
      </div>
    </div>
  );
};

interface StatBoxProps {
  label: string;
  value: string;
  highlight?: boolean;
}

const StatBox: React.FC<StatBoxProps> = ({ label, value, highlight }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{label}</div>
    <div
      style={{
        fontSize: '18px',
        fontWeight: 600,
        color: highlight ? '#f59e0b' : '#374151',
      }}
    >
      {value}
    </div>
  </div>
);

export default LeadTimeBreakdown;
