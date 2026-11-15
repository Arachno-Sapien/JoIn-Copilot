import React, { useState } from 'react';
import { extractJob } from '../../lib/api/extract';
import { ApiClient } from '../../lib/api/client';
import { Job } from '../../lib/schemas/job';
import { BLOCKED_SITES, NO_ACCESS_MESSAGE, hostOf } from '../../lib/sites';
import * as ui from '../ui';

const BLOCKED_MESSAGE =
  "Job Copilot doesn't read LinkedIn or Naukri pages. Open this job on the company's own careers page, then try again.";

export interface AddJobProps {
  onJobAdded?: (job: Job) => void;
}

export const AddJob: React.FC<AddJobProps> = ({ onJobAdded }) => {
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddJob = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
        throw new Error('Chrome scripting API is not available');
      }

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id) {
        throw new Error('No active browser tab found');
      }

      if (BLOCKED_SITES.test(hostOf(activeTab.url))) {
        throw new Error(BLOCKED_MESSAGE);
      }

      // Read the page text. Chrome allows it on the manifest's sites and on a tab where the
      // user clicked the toolbar icon.
      const injectionResults = await chrome.scripting
        .executeScript({
          target: { tabId: activeTab.id },
          func: () => document.body.innerText || '',
        })
        .catch(() => {
          throw new Error(NO_ACCESS_MESSAGE);
        });

      const pageText = injectionResults[0]?.result || '';
      if (!pageText.trim()) {
        throw new Error('No readable text found on active tab');
      }

      // Extract job via backend API
      const extracted = await extractJob(new ApiClient(), {
        text: pageText,
        url: activeTab.url || '',
      });

      setSuccessMessage(`${extracted.title} added successfully!`);
      onJobAdded?.(extracted as Job);
    } catch (err: any) {
      setError(err?.message || 'Failed to extract job from page');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-job-card" style={ui.card}>
      <h3 style={ui.h3}>
        Add job from page
      </h3>
      <p style={ui.bodyText}>
        Open a job posting, click the Job Copilot icon in Chrome's toolbar, then click below to save it.
      </p>

      <button
        type="button"
        onClick={handleAddJob}
        disabled={loading}
        style={ui.primaryButton}
      >
        {loading ? 'Extracting Job...' : 'Add Job from Page'}
      </button>

      {successMessage && (
        <div style={{ ...ui.successText, marginTop: ui.space.md }}>
          {successMessage}
        </div>
      )}

      {error && (
        <div role="alert" style={{ ...ui.errorText, marginTop: ui.space.md }}>
          {error}
        </div>
      )}
    </div>
  );
};
