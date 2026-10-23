import React, { useState } from 'react';
import { extractJob } from '../../lib/api/extract';
import { ApiClient } from '../../lib/api/client';
import { Job } from '../../lib/schemas/job';

// Project rule 5: never read LinkedIn or Naukri pages.
const BLOCKED_SITES = /(^|\.)(linkedin\.com|naukri\.com)$/;
const BLOCKED_MESSAGE =
  "Job Copilot doesn't read LinkedIn or Naukri pages. Open this job on the company's own careers page, then try again.";
const NO_ACCESS_MESSAGE = "Job Copilot can't read this page. It works on Greenhouse and Lever job pages.";

function hostOf(url: string | undefined): string {
  try {
    return new URL(url ?? '').hostname;
  } catch {
    return '';
  }
}

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

      // Read the page text. Chrome refuses on sites outside the extension's host permissions.
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
    <div className="add-job-card" style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fff' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#111827' }}>
        Add Job From Page
      </h3>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
        Open a job posting on Greenhouse or Lever, then click below to save it to Job Copilot.
      </p>

      <button
        type="button"
        onClick={handleAddJob}
        disabled={loading}
        style={{
          padding: '8px 16px',
          backgroundColor: '#4f46e5',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: '500',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Extracting Job...' : 'Add Job from Page'}
      </button>

      {successMessage && (
        <div style={{ marginTop: '10px', fontSize: '13px', color: '#15803d', fontWeight: '500' }}>
          {successMessage}
        </div>
      )}

      {error && (
        <div style={{ marginTop: '10px', fontSize: '13px', color: '#b91c1c' }}>
          {error}
        </div>
      )}
    </div>
  );
};
