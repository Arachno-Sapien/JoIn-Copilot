import React, { useState, useEffect } from 'react';
import { ResumeUpload } from '../../components/sidepanel/ResumeUpload';
import { ProfileEditor } from '../../components/sidepanel/ProfileEditor';
import { JobList } from '../../components/sidepanel/JobList';
import { DraftView } from '../../components/sidepanel/DraftView';
import { FillPage } from '../../components/sidepanel/FillPage';
import { AddJob } from '../../components/sidepanel/AddJob';
import { TrackerTable } from '../../components/tracker/TrackerTable';
import { TrackApplication } from '../../components/tracker/TrackApplication';
import { EmailConfirmations } from '../../components/sidepanel/EmailConfirmations';
import { KeyNotice } from '../../components/sidepanel/KeyNotice';
import { Profile } from '../../lib/schemas/profile';
import { Application } from '../../lib/schemas/application';
import { ScoredJob } from '../../lib/schemas/search';
import { PendingConfirmation } from '../../lib/schemas/email';
import { updateApplicationStatus } from '../../lib/tracker';
import { db } from '../../lib/db';
import { page, h1, subtitle, color, font, space, stack } from '../../components/ui';

type Tab = 'profile' | 'jobs' | 'draft' | 'fill' | 'tracker';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<ScoredJob[]>([]);
  const [pendingConfirmations, setPendingConfirmations] = useState<PendingConfirmation[]>([]);

  useEffect(() => {
    // Load profile and applications from IndexedDB
    db.profile.get('main').then((stored) => {
      if (stored) setProfile(stored);
    });
  }, []);

  const refreshApplications = () => db.applications.toArray().then(setApplications);

  useEffect(() => {
    // Also when the tracker opens: the background worker adds applications while the panel is open.
    if (activeTab === 'tracker') refreshApplications();
  }, [activeTab]);

  const handleConfirmEmailStatus = async (conf: PendingConfirmation) => {
    const statusMap: Record<string, any> = {
      rejection: 'rejected',
      acknowledgement: 'viewed',
      assessment: 'assessment',
      interview: 'interview',
      offer: 'offer',
    };
    await updateApplicationStatus(conf.applicationId, statusMap[conf.detectedStatus] || 'viewed', 'gmail', conf.date);
    setPendingConfirmations((prev) => prev.filter((c) => c.id !== conf.id));
    await refreshApplications();
  };

  const handleDismissEmailStatus = (id: string) => {
    setPendingConfirmations((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div style={{ ...page, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top Header */}
      <header style={{ padding: '12px 16px', borderBottom: `1px solid ${color.border}`, backgroundColor: color.surface, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={h1}>Job Copilot</h1>
          <p style={{ ...subtitle, fontSize: font.xs }}>Local-First Agentic Search & Application Assistant</p>
        </div>
      </header>

      <KeyNotice />

      {/* Tabs Navigation */}
      <nav style={{ display: 'flex', borderBottom: `1px solid ${color.border}`, backgroundColor: color.surface, overflowX: 'auto' }}>
        {[
          { id: 'profile', label: 'Profile' },
          { id: 'jobs', label: 'Jobs' },
          { id: 'draft', label: 'Draft' },
          { id: 'fill', label: 'Fill & Review' },
          { id: 'tracker', label: 'Tracker' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as Tab)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            style={{
              padding: '10px 14px',
              border: 'none',
              backgroundColor: activeTab === tab.id ? color.primaryTint : 'transparent',
              fontSize: font.sm,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? color.primary : color.textMuted,
              borderBottom: activeTab === tab.id ? `3px solid ${color.primary}` : '3px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: space.lg }}>
        {activeTab === 'profile' && (
          <div style={stack}>
            <ResumeUpload onProfileLoaded={(p) => setProfile(p)} />
            {profile && <ProfileEditor initialProfile={profile} onSaved={(p) => setProfile(p)} />}
          </div>
        )}

        {activeTab === 'jobs' && (
          <div style={stack}>
            <AddJob onJobAdded={(newJob) => setJobs((prev) => [{ job: newJob, fit_score: 75, fit_reasons: [], missing_skills: [] }, ...prev])} />
            <JobList jobs={jobs} />
          </div>
        )}

        {activeTab === 'draft' && (
          <DraftView
            initialDraft={{
              draft: 'Please select a job to view or generate tailored application drafts.',
              claims: [],
              flagged_spans: [],
              rewrite: null,
            }}
          />
        )}

        {activeTab === 'fill' && (
          <FillPage profile={profile} />
        )}

        {activeTab === 'tracker' && (
          <div style={stack}>
            <EmailConfirmations
              confirmations={pendingConfirmations}
              onConfirm={handleConfirmEmailStatus}
              onDismiss={handleDismissEmailStatus}
            />
            <TrackApplication onTracked={refreshApplications} />
            <TrackerTable
              applications={applications}
              onStatusChange={(id, status) => updateApplicationStatus(id, status, 'user').then(refreshApplications)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
