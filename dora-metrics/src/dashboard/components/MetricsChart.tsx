/**
 * MetricsChart Component
 * Displays time-series chart for DORA metrics trends
 */

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import type { TimeSeriesDataPoint } from '../../types';
import { format, startOfWeek, eachWeekOfInterval } from 'date-fns';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MetricsChartProps {
  title: string;
  data: TimeSeriesDataPoint[];
  chartType?: 'line' | 'bar';
  color?: string;
  yAxisLabel?: string;
  showBenchmarks?: boolean;
  benchmarks?: { label: string; value: number; color: string }[];
}

export const MetricsChart: React.FC<MetricsChartProps> = ({
  title,
  data,
  chartType = 'line',
  color = '#3b82f6',
  yAxisLabel = 'Value',
  showBenchmarks = false,
  benchmarks = [],
}) => {
  // Aggregate data by week
  const aggregatedData = React.useMemo(() => {
    if (data.length === 0) return { labels: [], values: [] };

    const sorted = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());
    const firstItem = sorted[0];
    const lastItem = sorted[sorted.length - 1];
    if (!firstItem || !lastItem) return { labels: [], values: [] };

    const start = firstItem.date;
    const end = lastItem.date;

    const weeks = eachWeekOfInterval({ start, end });
    const weeklyData: Map<string, number[]> = new Map();

    weeks.forEach((week) => {
      weeklyData.set(format(week, 'MMM d'), []);
    });

    sorted.forEach((point) => {
      const weekStart = startOfWeek(point.date);
      const key = format(weekStart, 'MMM d');
      const existing = weeklyData.get(key);
      if (existing) {
        existing.push(point.value);
      }
    });

    const labels: string[] = [];
    const values: number[] = [];

    weeklyData.forEach((vals, label) => {
      labels.push(label);
      values.push(vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
    });

    return { labels, values };
  }, [data]);

  const chartData = {
    labels: aggregatedData.labels,
    datasets: [
      {
        label: title,
        data: aggregatedData.values,
        borderColor: color,
        backgroundColor: chartType === 'line' ? `${color}20` : color,
        fill: chartType === 'line',
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      ...(showBenchmarks
        ? benchmarks.map((b) => ({
            label: b.label,
            data: Array(aggregatedData.labels.length).fill(b.value),
            borderColor: b.color,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
          }))
        : []),
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: '#1f2937',
        titleFont: {
          size: 14,
        },
        bodyFont: {
          size: 13,
        },
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
          },
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: yAxisLabel,
          font: {
            size: 12,
          },
        },
        grid: {
          color: '#e5e7eb',
        },
        ticks: {
          font: {
            size: 11,
          },
        },
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  };

  const ChartComponent = chartType === 'line' ? Line : Bar;

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        height: '350px',
      }}
    >
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#374151' }}>
        {title}
      </h3>
      <div style={{ height: '280px' }}>
        <ChartComponent data={chartData} options={options} />
      </div>
    </div>
  );
};

export default MetricsChart;
