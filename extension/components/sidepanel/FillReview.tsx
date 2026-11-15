import React, { useState } from 'react';
import { FilledField, FormField } from '../../lib/messaging';
import { Job } from '../../lib/schemas/job';
import { Profile } from '../../lib/schemas/profile';
import { draftAnswer } from '../../lib/api/draft';
import { apiClient } from '../../lib/api/client';
import * as ui from '../ui';

export interface FillReviewProps {
  filled: FilledField[];
  skipped: FormField[];
  openQuestions?: FormField[];
  aiNotice?: string;
  selectedJob?: Job | null;
  profile?: Profile | null;
}

interface OpenQuestionState {
  loading: boolean;
  draftText: string;
  drafted: boolean;
  filled: boolean;
  error?: string;
}

export const FillReview: React.FC<FillReviewProps> = ({
  filled,
  skipped,
  openQuestions = [],
  aiNotice,
  selectedJob,
  profile,
}) => {
  const [questionStates, setQuestionStates] = useState<Record<string, OpenQuestionState>>({});

  const handleDraftAnswer = async (field: FormField) => {
    if (!selectedJob) {
      setQuestionStates((prev) => ({
        ...prev,
        [field.name]: {
          loading: false,
          draftText: '',
          drafted: false,
          filled: false,
          error: 'Select a job on the Jobs tab first to draft answers.',
        },
      }));
      return;
    }

    if (!profile) {
      setQuestionStates((prev) => ({
        ...prev,
        [field.name]: {
          loading: false,
          draftText: '',
          drafted: false,
          filled: false,
          error: 'Add your profile on the Profile tab first.',
        },
      }));
      return;
    }

    setQuestionStates((prev) => ({
      ...prev,
      [field.name]: { loading: true, draftText: '', drafted: false, filled: false },
    }));

    try {
      const res = await draftAnswer(apiClient, {
        job: selectedJob,
        question: field.label || field.placeholder || field.name,
        profile,
      });

      const text = res.rewrite || res.rewritten_draft || res.draft;
      setQuestionStates((prev) => ({
        ...prev,
        [field.name]: { loading: false, draftText: text, drafted: true, filled: false },
      }));
    } catch (err: any) {
      setQuestionStates((prev) => ({
        ...prev,
        [field.name]: {
          loading: false,
          draftText: '',
          drafted: false,
          filled: false,
          error: err?.message || 'Failed to draft answer',
        },
      }));
    }
  };

  const handleUseAnswer = async (field: FormField, answer: string) => {
    // Only say "filled" when the page reports it filled this field.
    let ok = false;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const reply = tab?.id
        ? await chrome.tabs.sendMessage(tab.id, {
            type: 'FILL_REQUEST',
            jobId: 'page',
            values: { [field.name]: answer },
          })
        : undefined;
      ok = !!reply?.filled?.some((f: FilledField) => f.name === field.name);
    } catch {
      // The tab was closed or reloaded.
    }
    setQuestionStates((prev) => ({
      ...prev,
      [field.name]: {
        ...prev[field.name],
        filled: ok,
        error: ok ? undefined : 'This answer could not be filled on the page. Copy it into the form yourself.',
      },
    }));
  };

  return (
    <div className="fill-review-card" style={ui.card}>
      <h3 style={ui.h3}>Form Filling Review</h3>

      <div
        style={{ ...ui.callout('info'), borderLeft: `4px solid ${ui.color.infoBorder}`, marginBottom: ui.space.lg }}
      >
        Automated filling complete. Please review the form on the page and submit the form on the page yourself.
      </div>

      {aiNotice && (
        <div
          role="alert"
          style={{ ...ui.callout('warning'), marginBottom: ui.space.lg }}
        >
          {aiNotice}
        </div>
      )}

      <div style={{ marginBottom: ui.space.lg }}>
        <h4 style={{ ...ui.h4, fontSize: ui.font.md, color: ui.color.success }}>
          Filled Fields ({filled.length})
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.xs }}>
          {filled.map((item, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: ui.space.sm,
                padding: '6px 8px',
                backgroundColor: ui.color.successTint,
                borderRadius: ui.radius.sm,
                fontSize: ui.font.sm,
                overflowWrap: 'anywhere',
              }}
            >
              <span style={{ fontWeight: 500, color: ui.color.text }}>{item.name}</span>
              <span style={{ color: ui.color.textMuted }}>{String(item.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {openQuestions && openQuestions.length > 0 && (
        <div style={{ marginBottom: ui.space.lg }}>
          <h4 style={{ ...ui.h4, fontSize: ui.font.md, color: ui.color.primary }}>
            Open Questions ({openQuestions.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.sm }}>
            {openQuestions.map((field) => {
              const qState = questionStates[field.name] || {
                loading: false,
                draftText: '',
                drafted: false,
                filled: false,
              };

              return (
                <div
                  key={field.name}
                  style={{
                    padding: ui.space.md,
                    border: `1px solid ${ui.color.border}`,
                    borderRadius: ui.radius.md,
                    backgroundColor: ui.color.surface,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: ui.space.xs,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: ui.font.sm, color: ui.color.text }}>
                    {field.label || field.placeholder || field.name}
                  </div>

                  {qState.error && (
                    <div role="alert" style={{ ...ui.errorText, fontSize: ui.font.xs }}>
                      {qState.error}
                    </div>
                  )}

                  {!qState.drafted && !qState.filled && (
                    <div>
                      <button
                        type="button"
                        onClick={() => handleDraftAnswer(field)}
                        disabled={qState.loading}
                        style={{ ...ui.secondaryButton, padding: '4px 10px', fontSize: ui.font.xs }}
                      >
                        {qState.loading ? 'Drafting...' : 'Draft answer'}
                      </button>
                    </div>
                  )}

                  {qState.drafted && !qState.filled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.xs, marginTop: ui.space.xs }}>
                      <textarea
                        aria-label={`Answer for ${field.label || field.name}`}
                        value={qState.draftText}
                        onChange={(e) =>
                          setQuestionStates((prev) => ({
                            ...prev,
                            [field.name]: { ...prev[field.name], draftText: e.target.value },
                          }))
                        }
                        style={{
                          ...ui.input,
                          minHeight: '60px',
                          fontFamily: 'inherit',
                          fontSize: ui.font.sm,
                          resize: 'vertical',
                        }}
                      />
                      <div>
                        <button
                          type="button"
                          onClick={() => handleUseAnswer(field, qState.draftText)}
                          style={{ ...ui.primaryButton, padding: '4px 10px', fontSize: ui.font.xs }}
                        >
                          Use this answer
                        </button>
                      </div>
                    </div>
                  )}

                  {qState.filled && (
                    <div style={{ color: ui.color.success, fontSize: ui.font.xs, fontWeight: 500 }}>
                      Answer filled on page!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {skipped.length > 0 && (
        <div>
          <h4 style={{ ...ui.h4, fontSize: ui.font.md, color: ui.color.warning }}>
            Skipped / Manual Attention Needed ({skipped.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.xs }}>
            {skipped.map((field, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: ui.space.sm,
                  padding: '6px 8px',
                  backgroundColor: ui.color.warningTint,
                  borderRadius: ui.radius.sm,
                  fontSize: ui.font.sm,
                  overflowWrap: 'anywhere',
                }}
              >
                <span style={{ fontWeight: 500, color: ui.color.text }}>{field.label || field.name}</span>
                <span style={{ color: ui.color.warning, fontStyle: 'italic' }}>
                  {field.reason || (field.manual ? 'Manual Entry Required' : 'Review on page')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

