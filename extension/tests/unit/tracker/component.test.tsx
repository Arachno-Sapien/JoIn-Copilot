// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrackerTable } from '../../../components/tracker/TrackerTable';

describe('Tracker Component Unit Tests', () => {
  it('renders empty message when no applications', () => {
    render(<TrackerTable applications={[]} />);
    expect(screen.getByText(/no applications found/i)).toBeDefined();
  });
});
