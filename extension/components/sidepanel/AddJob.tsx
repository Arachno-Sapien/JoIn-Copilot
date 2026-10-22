import React, { useState } from 'react';
import { extractJob } from '../../lib/api/extract';
import { ApiClient } from '../../lib/api/client';
import { Job } from '../../lib/schemas/job';

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

      // Execute script in active tab to get page text
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => document.body.innerText || '',
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
        Browse to any job posting and click below to extract and save it to your Job Copilot.
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
