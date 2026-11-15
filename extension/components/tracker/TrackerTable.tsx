import React, { useState, useMemo } from 'react';
import { Application, ApplicationStatus } from '../../lib/schemas/application';
import * as ui from '../ui';

export interface TrackerTableProps {
  applications: Application[];
  onStatusChange?: (id: string, newStatus: ApplicationStatus) => void;
}

export const TrackerTable: React.FC<TrackerTableProps> = ({ applications, onStatusChange }) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('applied_desc');

  const filteredAndSorted = useMemo(() => {
    let result = [...applications];

    if (statusFilter !== 'all') {
      result = result.filter((app) => app.status === statusFilter);
    }

    result.sort((a, b) => {
      const timeA = new Date(a.applied_at).getTime();
      const timeB = new Date(b.applied_at).getTime();
      if (sortBy === 'applied_asc') {
        return timeA - timeB;
      }
      if (sortBy === 'applied_desc') {
        return timeB - timeA;
      }
      if (sortBy === 'company') {
        return a.job_snapshot.company.localeCompare(b.job_snapshot.company);
      }
      return 0;
    });

    return result;
  }, [applications, statusFilter, sortBy]);

  return (
    <div className="tracker-table-container" style={{ fontFamily: 'inherit', minWidth: 0 }}>
      <div
        className="tracker-controls"
        style={{ display: 'flex', gap: ui.space.md, marginBottom: ui.space.lg, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: ui.font.md, color: ui.color.text }}>
          <span>Filter by status:</span>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={ui.select}
          >
            <option value="all">All</option>
            <option value="applied">Applied</option>
            <option value="viewed">Viewed</option>
            <option value="assessment">Assessment</option>
            <option value="interview">Interview</option>
            <option value="offer">Offer</option>
            <option value="rejected">Rejected</option>
            <option value="no_response">No Response</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: ui.font.md, color: ui.color.text }}>
          <span>Sort by:</span>
          <select
            aria-label="Sort by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={ui.select}
          >
            <option value="applied_desc">Newest First</option>
            <option value="applied_asc">Oldest First</option>
            <option value="company">Company Name</option>
          </select>
        </label>
      </div>

      <div className="tracker-rows" style={{ display: 'flex', flexDirection: 'column', gap: ui.space.sm, overflowX: 'auto', maxWidth: '100%' }}>
        {filteredAndSorted.length === 0 ? (
          <div style={{ ...ui.emptyText, padding: `${ui.space.md} 0` }}>No applications found.</div>
        ) : (
          filteredAndSorted.map((app) => (
            <div
              key={app.id}
              data-testid="tracker-row"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: ui.space.sm,
                padding: ui.space.md,
                border: `1px solid ${ui.color.border}`,
                borderRadius: ui.radius.md,
                backgroundColor: ui.color.surface,
              }}
            >
              <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                <div style={{ fontWeight: 600, fontSize: ui.font.lg, color: ui.color.text }}>
                  {app.job_snapshot.company}
                </div>
                <div style={{ fontSize: ui.font.md, color: ui.color.textMuted }}>{app.job_snapshot.title}</div>
                <div style={{ fontSize: ui.font.xs, color: ui.color.textSubtle, marginTop: '2px' }}>
                  Applied: {new Date(app.applied_at).toLocaleDateString()}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: ui.space.sm, flexShrink: 0 }}>
                <span
                  style={{
                    ...ui.badge,
                    backgroundColor:
                      app.status === 'offer'
                        ? ui.color.badgeSuccess
                        : app.status === 'rejected'
                        ? ui.color.badgeDanger
                        : app.status === 'interview'
                        ? ui.color.badgePrimary
                        : ui.color.badgeNeutral,
                    color:
                      app.status === 'offer'
                        ? ui.color.success
                        : app.status === 'rejected'
                        ? ui.color.danger
                        : app.status === 'interview'
                        ? ui.color.primary
                        : ui.color.textMuted,
                    textTransform: 'capitalize',
                  }}
                >
                  {app.status.replaceAll('_', ' ')}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
