import React, { useEffect, useState } from 'react';
import { handleApplicationSubmitted } from '../../lib/tracker';
import * as ui from '../ui';

export interface TrackApplicationProps {
  onTracked?: () => void;
}

/**
 * Adds an application by hand. This is how jobs applied to on LinkedIn, Naukri or any
 * site Job Copilot does not read get into the tracker. Only the tab's title and
 * address are used to prefill the fields; the page itself is never read.
 */
export const TrackApplication: React.FC<TrackApplicationProps> = ({ onTracked }) => {
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [link, setLink] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) return;
    // Chrome shares the title and address only for tabs where the toolbar icon was clicked.
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab?.title) setRole((current) => current || tab.title!);
        if (tab?.url?.startsWith('http')) setLink((current) => current || tab.url!);
      })
      .catch(() => {});
  }, []);

  const handleTrack = async () => {
    const title = role.trim();
    const org = company.trim();
    if (!title || !org) {
      setMessage('Enter the role and the company.');
      return;
    }
    await handleApplicationSubmitted(
      { type: 'APPLICATION_SUBMITTED', jobId: `manual:${link.trim() || title}`, url: link.trim(), answers: {} },
      { job: { title, company: org, source: 'manual' } }
    );
    setRole('');
    setCompany('');
    setLink('');
    setMessage(`${title} at ${org} is now tracked.`);
    onTracked?.();
  };

  return (
    <div className="track-application-card" style={ui.card}>
      <h3 style={ui.h3}>Track application</h3>
      <p style={ui.bodyText}>
        Applied somewhere Job Copilot doesn't read, such as LinkedIn or Naukri? Add it here.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.md }}>
        <div>
          <label htmlFor="track-role" style={ui.label}>Role</label>
          <input id="track-role" value={role} onChange={(e) => setRole(e.target.value)} style={ui.input} />
        </div>
        <div>
          <label htmlFor="track-company" style={ui.label}>Company</label>
          <input id="track-company" value={company} onChange={(e) => setCompany(e.target.value)} style={ui.input} />
        </div>
        <div>
          <label htmlFor="track-link" style={ui.label}>Link (optional)</label>
          <input id="track-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} style={ui.input} />
        </div>
        <div>
          <button type="button" onClick={handleTrack} style={ui.primaryButton}>
            Track application
          </button>
        </div>
        {message && (
          <div role="status" style={ui.statusText}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};
