import React from 'react';
import { ScoredJob } from '../../lib/schemas/search';

export interface JobListProps {
  jobs: ScoredJob[];
  onSelectJob?: (job: ScoredJob) => void;
}

export const JobList: React.FC<JobListProps> = ({ jobs, onSelectJob }) => {
  return (
    <div className="job-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {jobs.length === 0 ? (
        <div style={{ color: '#6b7280', fontSize: '13px', fontStyle: 'italic', padding: '12px' }}>
          No matching jobs found yet.
        </div>
      ) : (
        jobs.map((item) => {
          const rawJob = item.job as any;
          const scamRisk = rawJob.scam_risk;
          const scamReasons: string[] = rawJob.scam_reasons || [];
          const injectionWarning: string | undefined = rawJob.injection_warning;

          return (
            <div
              key={item.job.id}
              onClick={() => onSelectJob?.(item)}
              style={{
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#fff',
                cursor: onSelectJob ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                    {item.job.title}
                  </h4>
                  <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '2px' }}>
                    <span>{item.job.company}</span>
                    {item.job.location && <span> • {item.job.location}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {scamRisk && (
                    <div
                      data-testid="scam-risk-badge"
                      style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor:
                          scamRisk === 'low' ? '#dcfce7' : scamRisk === 'medium' ? '#fef3c7' : '#fee2e2',
                        color:
                          scamRisk === 'low' ? '#15803d' : scamRisk === 'medium' ? '#b45309' : '#b91c1c',
                        fontSize: '11px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                      }}
                    >
                      {scamRisk} Risk
                    </div>
                  )}

                  {/* Fit Score Badge */}
                  {(() => {
                    const score = (item as any).score ?? item.fit_score ?? 0;
                    return (
                      <div
                        style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: score >= 80 ? '#dcfce7' : score >= 60 ? '#fef3c7' : '#fee2e2',
                          color: score >= 80 ? '#15803d' : score >= 60 ? '#b45309' : '#b91c1c',
                          fontSize: '12px',
                          fontWeight: '600',
                        }}
                      >
                        Fit {score}%
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Injection Warning Banner */}
              {injectionWarning && (
                <div
                  data-testid="injection-warning-banner"
                  style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    color: '#991b1b',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  ⚠️ {injectionWarning}
                </div>
              )}

              {/* Scam Reasons */}
              {scamReasons.length > 0 && (
                <div style={{ marginTop: '8px', padding: '6px 8px', backgroundColor: '#fffbeb', borderRadius: '4px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#92400e', marginBottom: '2px' }}>
                    Safety Signals:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: '#78350f' }}>
                    {scamReasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(() => {
                const breakdown = (item as any).breakdown || item.facts;
                const missingSkills = item.missing_skills?.length ? item.missing_skills : breakdown?.missing_required;
                return (
                  <>
                    {breakdown?.summary && (
                      <p style={{ fontSize: '12px', color: '#4b5563', marginTop: '8px', marginBottom: '6px' }}>
                        {breakdown.summary}
                      </p>
                    )}

                    {missingSkills && missingSkills.length > 0 && (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#b91c1c' }}>
                        <span style={{ fontWeight: '500' }}>Missing skills: </span>
                        <span>{missingSkills.join(', ')}</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          );
        })
      )}
    </div>
  );
};
