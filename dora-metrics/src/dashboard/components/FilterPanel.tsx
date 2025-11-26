/**
 * FilterPanel Component
 * Allows filtering DORA metrics by project, feature, and time period
 */

import React from 'react';
import type { GitHubRepository, Feature, TimePeriod } from '../../types';

interface FilterPanelProps {
  repositories: GitHubRepository[];
  features: Feature[];
  selectedRepository?: GitHubRepository;
  selectedFeature?: Feature;
  period: TimePeriod;
  onRepositoryChange: (repo: GitHubRepository | undefined) => void;
  onFeatureChange: (feature: Feature | undefined) => void;
  onPeriodChange: (period: TimePeriod) => void;
}

const periodPresets = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 6 months', days: 180 },
  { label: 'Last year', days: 365 },
];

const selectStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  backgroundColor: '#ffffff',
  fontSize: '14px',
  color: '#374151',
  minWidth: '200px',
  cursor: 'pointer',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#6b7280',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export const FilterPanel: React.FC<FilterPanelProps> = ({
  repositories,
  features,
  selectedRepository,
  selectedFeature,
  period,
  onRepositoryChange,
  onFeatureChange,
  onPeriodChange,
}) => {
  const handlePeriodPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onPeriodChange({ start, end });
  };

  const currentPreset = periodPresets.find((p) => {
    const daysDiff = Math.round((period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.abs(daysDiff - p.days) <= 1;
  });

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '20px 24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '24px',
        alignItems: 'flex-end',
      }}
    >
      {/* Repository Filter */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={labelStyle}>Repository</label>
        <select
          style={selectStyle}
          value={selectedRepository?.fullName || ''}
          onChange={(e) => {
            const repo = repositories.find((r) => r.fullName === e.target.value);
            onRepositoryChange(repo);
          }}
        >
          <option value="">All Repositories</option>
          {repositories.map((repo) => (
            <option key={repo.fullName} value={repo.fullName}>
              {repo.fullName}
            </option>
          ))}
        </select>
      </div>

      {/* Feature Filter */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={labelStyle}>Feature / Epic</label>
        <select
          style={selectStyle}
          value={selectedFeature?.id || ''}
          onChange={(e) => {
            const feature = features.find((f) => f.id === e.target.value);
            onFeatureChange(feature);
          }}
        >
          <option value="">All Features</option>
          {features.map((feature) => (
            <option key={feature.id} value={feature.id}>
              {feature.name}
            </option>
          ))}
        </select>
      </div>

      {/* Time Period Filter */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={labelStyle}>Time Period</label>
        <select
          style={selectStyle}
          value={currentPreset?.days || ''}
          onChange={(e) => {
            const days = parseInt(e.target.value, 10);
            if (!isNaN(days)) {
              handlePeriodPreset(days);
            }
          }}
        >
          {periodPresets.map((preset) => (
            <option key={preset.days} value={preset.days}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {/* Period Display */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '8px 16px',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
        }}
      >
        <span style={{ fontSize: '12px', color: '#6b7280' }}>Selected Period</span>
        <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
          {period.start.toLocaleDateString()} - {period.end.toLocaleDateString()}
        </span>
      </div>

      {/* Clear Filters Button */}
      {(selectedRepository || selectedFeature) && (
        <button
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#ef4444',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onClick={() => {
            onRepositoryChange(undefined);
            onFeatureChange(undefined);
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ef4444')}
        >
          Clear Filters
        </button>
      )}
    </div>
  );
};

export default FilterPanel;
