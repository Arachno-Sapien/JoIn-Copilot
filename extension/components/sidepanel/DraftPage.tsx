import React, { useState } from 'react';
import { Job } from '../../lib/schemas/job';
import { Profile } from '../../lib/schemas/profile';
import { DraftResponse } from '../../lib/schemas/draft';
import { draftAnswer } from '../../lib/api/draft';
import { apiClient, ApiError } from '../../lib/api/client';
import { DraftView } from './DraftView';
import * as ui from '../ui';

export interface DraftPageProps {
  profile: Profile | null;
  job: Job | null;
}

export const DraftPage: React.FC<DraftPageProps> = ({ profile, job }) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [draftKey, setDraftKey] = useState(0);

  // In-memory drafts per job (keyed by job.id). Personal data: kept in component state only!
  const [draftsByJob, setDraftsByJob] = useState<Record<string, { response: DraftResponse; text: string }>>({});

  if (!profile) {
    return (
      <div style={ui.card}>
        <h3 style={ui.h3}>Application Answer Draft</h3>
        <p style={ui.bodyText}>Add your profile on the Profile tab first.</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div style={ui.card}>
        <h3 style={ui.h3}>Application Answer Draft</h3>
        <p style={ui.bodyText}>Select a job on the Jobs tab first.</p>
      </div>
    );
  }

  const currentJobDraft = draftsByJob[job.id];

  const handleDraft = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await draftAnswer(apiClient, {
        job,
        question: trimmed,
        profile,
      });

      // Copy must give what DraftView shows: the draft, until the user applies the rewrite.
      const initialText = res.draft;
      setDraftsByJob((prev) => ({
        ...prev,
        [job.id]: { response: res, text: initialText },
      }));
      setDraftKey((k) => k + 1);
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === undefined) {
          setError('Could not reach the Job Copilot backend. Check that it is running and its URL below.');
        } else {
          const detail = err.detail ? ` ${err.detail}` : '';
          setError(`${err.message}${detail}`);
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to draft answer');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRewrite = (rewritten: string) => {
    if (job) {
      setDraftsByJob((prev) => {
        const cur = prev[job.id];
        if (!cur) return prev;
        return {
          ...prev,
          [job.id]: { ...cur, text: rewritten },
        };
      });
    }
  };

  const handleCopy = async () => {
    const textToCopy = currentJobDraft?.text;
    if (textToCopy && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={ui.stack}>
      <div style={ui.card}>
        <h3 style={ui.h3}>Draft Answer</h3>
        <div style={{ fontSize: ui.font.md, color: ui.color.textMuted, marginBottom: ui.space.md }}>
          <span>{job.title}</span> • <span>{job.company}</span>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: ui.space.xs, marginBottom: ui.space.md }}>
          <span style={ui.label}>Question</span>
          <textarea
            aria-label="Question"
            placeholder="Why do you want to work here?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            style={{
              ...ui.input,
              minHeight: '70px',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: ui.space.sm, alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleDraft}
            disabled={loading || !question.trim()}
            style={ui.primaryButton}
          >
            {loading ? 'Drafting...' : 'Draft answer'}
          </button>

          {currentJobDraft && (
            <button
              type="button"
              onClick={handleCopy}
              style={ui.secondaryButton}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>

        {error && (
          <div role="alert" style={{ ...ui.errorText, marginTop: ui.space.md }}>
            {error}
          </div>
        )}
      </div>

      {currentJobDraft && (
        <DraftView
          key={`${job.id}-${draftKey}`}
          initialDraft={currentJobDraft.response}
          onApplyRewrite={handleApplyRewrite}
        />
      )}
    </div>
  );
};
