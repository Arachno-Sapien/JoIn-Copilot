import React, { useState } from 'react';
import { fillActivePage, PageFillResult } from '../../lib/fill/page';
import { Profile } from '../../lib/schemas/profile';
import { Job } from '../../lib/schemas/job';
import { FillReview } from './FillReview';
import * as ui from '../ui';

export interface FillPageProps {
  profile: Profile | null;
  selectedJob?: Job | null;
}

export const FillPage: React.FC<FillPageProps> = ({ profile, selectedJob }) => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PageFillResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFill = async () => {
    if (!profile) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await fillActivePage(profile));
    } catch (err: any) {
      setError(err?.message || 'Could not fill this page');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={ui.stack}>
      <div className="fill-page-card" style={ui.card}>
        <h3 style={ui.h3}>Fill this page</h3>
        <p style={ui.bodyText}>
          Open an application form, click the Job Copilot icon in Chrome's toolbar, then fill it from your
          profile. Job Copilot never sends the form: you review it and send it yourself.
        </p>
        <button type="button" onClick={handleFill} disabled={busy || !profile} style={ui.primaryButton}>
          {busy ? 'Filling...' : 'Fill this page'}
        </button>
        {!profile && (
          <div style={{ ...ui.statusText, marginTop: ui.space.md }}>
            Add your profile on the Profile tab first.
          </div>
        )}
        {error && (
          <div role="alert" style={{ ...ui.errorText, marginTop: ui.space.md }}>
            {error}
          </div>
        )}
      </div>
      {result && (
        <FillReview
          filled={result.filled}
          skipped={result.skipped}
          openQuestions={result.openQuestions}
          aiNotice={result.aiNotice}
          selectedJob={selectedJob}
          profile={profile}
        />
      )}
    </div>
  );
};
