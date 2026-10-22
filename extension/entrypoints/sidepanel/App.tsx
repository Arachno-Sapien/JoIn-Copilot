import React, { useState, useEffect } from 'react';
import { ResumeUpload } from '../../components/sidepanel/ResumeUpload';
import { ProfileEditor } from '../../components/sidepanel/ProfileEditor';
import { JobList } from '../../components/sidepanel/JobList';
import { DraftView } from '../../components/sidepanel/DraftView';
import { FillReview } from '../../components/sidepanel/FillReview';
import { AddJob } from '../../components/sidepanel/AddJob';
import { TrackerTable } from '../../components/tracker/TrackerTable';
import { EmailConfirmations } from '../../components/sidepanel/EmailConfirmations';
import { Profile } from '../../lib/schemas/profile';
import { Application } from '../../lib/schemas/application';
import { ScoredJob } from '../../lib/schemas/search';
import { PendingConfirmation } from '../../lib/schemas/email';
import { updateApplicationStatus } from '../../lib/tracker';
import { db } from '../../lib/db';

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
    db.applications.toArray().then((apps) => {
      setApplications(apps);
    });
  }, []);

  const handleConfirmEmailStatus = async (conf: PendingConfirmation) => {
    const statusMap: Record<string, any> = {
      rejection: 'rejected',
      acknowledgement: 'viewed',
      assessment: 'assessment',
      interview: 'interview',
      offer: 'offer',
    };
    await updateApplicationStatus(conf.applicationId, statusMap[conf.detectedStatus] || 'viewed', 'gmail');
    setPendingConfirmations((prev) => prev.filter((c) => c.id !== conf.id));
    const refreshed = await db.applications.toArray();
    setApplications(refreshed);
  };

  const handleDismissEmailStatus = (id: string) => {
    setPendingConfirmations((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Header */}
      <header style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>Job Copilot</h1>
          <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>Local-First Agentic Search & Application Assistant</p>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: '#ffffff', overflowX: 'auto' }}>
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
            style={{
              padding: '10px 14px',
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '12px',
              fontWeight: activeTab === tab.id ? '600' : '400',
              color: activeTab === tab.id ? '#4f46e5' : '#6b7280',
              borderBottom: activeTab === tab.id ? '2px solid #4f46e5' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ResumeUpload onProfileLoaded={(p) => setProfile(p)} />
            {profile && <ProfileEditor initialProfile={profile} onSaved={(p) => setProfile(p)} />}
          </div>
        )}

        {activeTab === 'jobs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          <FillReview filled={[]} skipped={[]} />
        )}

        {activeTab === 'tracker' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <EmailConfirmations
              confirmations={pendingConfirmations}
              onConfirm={handleConfirmEmailStatus}
              onDismiss={handleDismissEmailStatus}
            />
            <TrackerTable applications={applications} />
          </div>
        )}
      </main>
    </div>
  );
}
