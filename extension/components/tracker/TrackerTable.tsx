import React, { useState, useMemo } from 'react';
import { Application, ApplicationStatus } from '../../lib/schemas/application';

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
    <div className="tracker-table-container" style={{ padding: '16px', fontFamily: 'sans-serif' }}>
      <div
        className="tracker-controls"
        style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <span>Filter by status:</span>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
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

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <span>Sort by:</span>
          <select
            aria-label="Sort by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="applied_desc">Newest First</option>
            <option value="applied_asc">Oldest First</option>
            <option value="company">Company Name</option>
          </select>
        </label>
      </div>

      <div className="tracker-rows" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredAndSorted.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic', padding: '12px 0' }}>No applications found.</div>
        ) : (
          filteredAndSorted.map((app) => (
            <div
              key={app.id}
              data-testid="tracker-row"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
              }}
            >
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>
                  {app.job_snapshot.company}
                </div>
                <div style={{ fontSize: '13px', color: '#4b5563' }}>{app.job_snapshot.title}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                  Applied: {new Date(app.applied_at).toLocaleDateString()}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 8px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: '500',
                    backgroundColor:
                      app.status === 'offer'
                        ? '#dcfce7'
                        : app.status === 'rejected'
                        ? '#fee2e2'
                        : app.status === 'interview'
                        ? '#e0e7ff'
                        : '#f3f4f6',
                    color:
                      app.status === 'offer'
                        ? '#166534'
                        : app.status === 'rejected'
                        ? '#991b1b'
                        : app.status === 'interview'
                        ? '#3730a3'
                        : '#374151',
                    textTransform: 'capitalize',
                  }}
                >
                  {app.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
