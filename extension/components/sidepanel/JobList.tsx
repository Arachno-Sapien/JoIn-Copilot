import React from 'react';
import { ScoredJob } from '../../lib/schemas/search';
import { ListedJob } from '../../lib/db';
import * as ui from '../ui';

export interface JobListProps {
  jobs: (ScoredJob | ListedJob)[];
  selectedJobId?: string | null;
  onSelectJob?: (job: ListedJob | ScoredJob) => void;
  onRemoveJob?: (job: ListedJob | ScoredJob) => void;
}

export const JobList: React.FC<JobListProps> = ({
  jobs,
  selectedJobId,
  onSelectJob,
  onRemoveJob,
}) => {
  return (
    <div className="job-list-container" style={{ display: 'flex', flexDirection: 'column', gap: ui.space.md }}>
      {jobs.length === 0 ? (
        <div style={ui.emptyText}>
          No matching jobs found yet.
        </div>
      ) : (
        jobs.map((item) => {
          const rawJob = item.job as any;
          const scamRisk = rawJob.scam_risk;
          const scamReasons: string[] = rawJob.scam_reasons || [];
          const injectionWarning: string | undefined = rawJob.injection_warning;
          const isSelected = selectedJobId === item.job.id;

          const rawScore = (item as any).score ?? item.fit_score;

          return (
            <div
              key={item.job.id}
              role="button"
              data-testid="job-card"
              tabIndex={0}
              aria-current={isSelected ? 'true' : undefined}
              onClick={() => onSelectJob?.(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectJob?.(item);
                }
              }}
              style={{
                ...ui.card,
                padding: ui.space.md,
                cursor: 'pointer',
                border: `1px solid ${isSelected ? ui.color.primary : ui.color.border}`,
                boxShadow: isSelected ? `0 0 0 1px ${ui.color.primary}` : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: ui.space.sm }}>
                <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <h4 style={{ ...ui.h4, margin: 0 }}>
                    {item.job.title}
                  </h4>
                  <div style={{ fontSize: ui.font.md, color: ui.color.textMuted, marginTop: '2px' }}>
                    <span>{item.job.company}</span>
                    {item.job.location && <span> • {item.job.location}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: ui.space.xs, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {scamRisk && (
                    <div
                      data-testid="scam-risk-badge"
                      style={{
                        ...ui.badge,
                        backgroundColor:
                          scamRisk === 'low' ? ui.color.badgeSuccess : scamRisk === 'medium' ? ui.color.badgeWarning : ui.color.badgeDanger,
                        color:
                          scamRisk === 'low' ? ui.color.success : scamRisk === 'medium' ? ui.color.warning : ui.color.danger,
                        textTransform: 'uppercase',
                      }}
                    >
                      {scamRisk} Risk
                    </div>
                  )}

                  {/* Fit Score Badge */}
                  {rawScore === null || rawScore === undefined ? (
                    <div
                      style={{
                        ...ui.badge,
                        backgroundColor: ui.color.badgeNeutral,
                        color: ui.color.textMuted,
                        fontSize: ui.font.sm,
                      }}
                    >
                      Not scored
                    </div>
                  ) : (
                    <div
                      style={{
                        ...ui.badge,
                        backgroundColor:
                          rawScore >= 80 ? ui.color.badgeSuccess : rawScore >= 60 ? ui.color.badgeWarning : ui.color.badgeDanger,
                        color:
                          rawScore >= 80 ? ui.color.success : rawScore >= 60 ? ui.color.warning : ui.color.danger,
                        fontSize: ui.font.sm,
                      }}
                    >
                      Fit {rawScore}%
                    </div>
                  )}

                  {onRemoveJob && (
                    <button
                      type="button"
                      aria-label={`Remove ${item.job.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveJob(item);
                      }}
                      style={{
                        ...ui.secondaryButton,
                        padding: '2px 8px',
                        fontSize: ui.font.xs,
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Injection Warning Banner */}
              {injectionWarning && (
                <div
                  data-testid="injection-warning-banner"
                  style={{ ...ui.callout('danger'), marginTop: ui.space.sm, fontSize: ui.font.sm, fontWeight: 600, overflowWrap: 'anywhere' }}
                >
                  ⚠️ {injectionWarning}
                </div>
              )}

              {/* Scam Reasons */}
              {scamReasons.length > 0 && (
                <div style={{ ...ui.callout('warning'), marginTop: ui.space.sm, padding: '6px 8px' }}>
                  <div style={{ fontSize: ui.font.xs, fontWeight: 600, marginBottom: '2px' }}>
                    Safety Signals:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: ui.space.lg, fontSize: ui.font.xs }}>
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
                      <p style={{ fontSize: ui.font.sm, color: ui.color.textMuted, margin: `${ui.space.sm} 0 6px` }}>
                        {breakdown.summary}
                      </p>
                    )}

                    {missingSkills && missingSkills.length > 0 && (
                      <div style={{ marginTop: '6px', fontSize: ui.font.sm, color: ui.color.danger }}>
                        <span style={{ fontWeight: 600 }}>Missing skills: </span>
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

