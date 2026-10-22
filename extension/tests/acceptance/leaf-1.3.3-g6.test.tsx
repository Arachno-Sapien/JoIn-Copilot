// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AddJob } from '../../components/sidepanel/AddJob';
import * as extractApi from '../../lib/api/extract';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('leaf-1.3.3:G6 Add Job From Active Tab', () => {
  beforeEach(() => {
    // Setup chrome API mocks
    (globalThis as any).chrome = {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 101, url: 'https://example.com/jobs/lead-eng' }]),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([{ result: 'Lead Engineer opening at Acme. Requirements: Python, React.' }]),
      },
    };
  });

  it('reads active tab text via scripting, calls /jobs/extract, and saves returned job', async () => {
    const fakeExtractedJob = {
      title: 'Lead Engineer',
      company: 'Acme',
      location: 'Remote',
      description: 'Requirements: Python, React.',
      url: 'https://example.com/jobs/lead-eng',
      source: 'manual',
    };

    const extractSpy = vi.spyOn(extractApi, 'extractJob').mockResolvedValue(fakeExtractedJob as any);
    const onJobAdded = vi.fn();

    render(<AddJob onJobAdded={onJobAdded} />);

    const addBtn = screen.getByRole('button', { name: /add this job|add job from page/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect((globalThis as any).chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
      expect((globalThis as any).chrome.scripting.executeScript).toHaveBeenCalled();
      expect(extractSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          text: expect.stringContaining('Lead Engineer opening at Acme'),
          url: 'https://example.com/jobs/lead-eng',
        })
      );
      expect(onJobAdded).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Lead Engineer',
        company: 'Acme',
      }));
    });

    // Displays confirmation in UI
    expect(screen.getByText(/Lead Engineer added successfully/i)).toBeDefined();
  });
});
