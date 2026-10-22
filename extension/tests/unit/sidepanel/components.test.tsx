// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { App } from '../../../entrypoints/sidepanel/App';

afterEach(() => {
  cleanup();
});

describe('Sidepanel Main App Tests', () => {
  it('renders top tabs and header correctly', () => {
    render(<App />);
    expect(screen.getByText('Job Copilot')).toBeDefined();
    expect(screen.getByText('Profile')).toBeDefined();
    expect(screen.getByText('Jobs')).toBeDefined();
    expect(screen.getByText('Draft')).toBeDefined();
    expect(screen.getByText('Fill & Review')).toBeDefined();
    expect(screen.getByText('Tracker')).toBeDefined();
  });
});
