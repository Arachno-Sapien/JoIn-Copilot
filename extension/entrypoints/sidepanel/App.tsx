import React, { useState, useEffect, useMemo } from 'react';
import { ResumeUpload } from '../../components/sidepanel/ResumeUpload';
import { ProfileEditor } from '../../components/sidepanel/ProfileEditor';
import { JobList } from '../../components/sidepanel/JobList';
import { DraftPage } from '../../components/sidepanel/DraftPage';
import { FillPage } from '../../components/sidepanel/FillPage';
import { AddJob } from '../../components/sidepanel/AddJob';
import { TrackerTable } from '../../components/tracker/TrackerTable';
import { TrackApplication } from '../../components/tracker/TrackApplication';
import { GmailSyncCard } from '../../components/tracker/GmailSyncCard';
import { EmailConfirmations } from '../../components/sidepanel/EmailConfirmations';
import { KeyNotice } from '../../components/sidepanel/KeyNotice';
import { Profile } from '../../lib/schemas/profile';
import { Application } from '../../lib/schemas/application';
import { Job } from '../../lib/schemas/job';
import { ScoredJob } from '../../lib/schemas/search';
import { PendingConfirmation } from '../../lib/schemas/email';
import { updateApplicationStatus } from '../../lib/tracker';
import { db, SavedJob, ListedJob } from '../../lib/db';
import { searchJobs } from '../../lib/api/search';
import { checkJobScam } from '../../lib/api/scam';
import { apiClient, ApiError } from '../../lib/api/client';
import { page, h1, subtitle, color, font, space, stack, primaryButton, statusText } from '../../components/ui';

type Tab = 'profile' | 'jobs' | 'draft' | 'fill' | 'tracker';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [findingJobs, setFindingJobs] = useState(false);
  const [findJobsNotice, setFindJobsNotice] = useState<string | null>(null);
  const [pendingConfirmations, setPendingConfirmations] = useState<PendingConfirmation[]>([]);

  useEffect(() => {
    // Load profile and jobs from IndexedDB
    db.profile.get('main').then((stored) => {
      if (stored) setProfile(stored);
    });
    db.jobs.toArray().then((rows) => {
      rows.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
      setSavedJobs(rows);
    });
    db.pendingConfirmations.toArray().then(setPendingConfirmations);
  }, []);

  const refreshApplications = () => db.applications.toArray().then(setApplications);
  const refreshPendingConfirmations = () => db.pendingConfirmations.toArray().then(setPendingConfirmations);

  useEffect(() => {
    // Also when the tracker opens: the background worker adds applications while the panel is open.
    if (activeTab === 'tracker') {
      refreshApplications();
      refreshPendingConfirmations();
    }
  }, [activeTab]);

  const handleAddJob = async (newJob: Job) => {
    let rankedItem: ListedJob;

    if (profile) {
      try {
        const searchRes = await searchJobs(apiClient, {
          profile,
          jobs: [newJob],
          limit: 1,
        });
        if (searchRes.results && searchRes.results.length > 0) {
          rankedItem = searchRes.results[0];
        } else {
          rankedItem = {
            job: newJob,
            fit_score: null,
            fit_reasons: ['Filtered out by your job preferences'],
            missing_skills: [],
          };
        }
      } catch {
        rankedItem = {
          job: newJob,
          fit_score: null,
          fit_reasons: ['Unable to score job at this time'],
          missing_skills: [],
        };
      }
    } else {
      rankedItem = {
        job: newJob,
        fit_score: null,
        fit_reasons: ['Add your profile to score this job'],
        missing_skills: [],
      };
    }

    const row: SavedJob = {
      id: newJob.id,
      ranked: rankedItem,
      savedAt: new Date().toISOString(),
    };

    await db.jobs.put(row);
    setSavedJobs((prev) => [row, ...prev.filter((j) => j.id !== row.id)]);
  };

  const handleFindJobs = async () => {
    setFindingJobs(true);
    setFindJobsNotice(null);

    const effectiveProfile: Profile = profile || {
      schema_version: 1,
      name: '',
      email: '',
      phone: '',
      location: '',
      links: {},
      education: [],
      experience: [],
      projects: [],
      skills: [],
      certifications: [],
      preferences: {
        locations: [],
        remote: 'any',
        job_types: [],
        avoid_keywords: [],
      },
    };

    try {
      const searchRes = await searchJobs(apiClient, {
        profile: effectiveProfile,
        limit: 10,
      });

      if (searchRes.total_evaluated === 0) {
        setFindJobsNotice('The backend has no jobs yet. Configure job sources in .env (JC_GREENHOUSE_BOARDS, JC_LEVER_COMPANIES, JC_ADZUNA_QUERIES).');
      } else if (!searchRes.results?.length) {
        setFindJobsNotice(`None of the ${searchRes.total_evaluated} jobs in the backend match your job preferences.`);
      }

      if (searchRes.results && searchRes.results.length > 0) {
        const now = new Date().toISOString();
        const newRows: SavedJob[] = [];
        for (const item of searchRes.results) {
          const existing = await db.jobs.get(item.job.id);
          const row: SavedJob = {
            id: item.job.id,
            ranked: item,
            scam: existing?.scam,
            savedAt: existing?.savedAt || now,
          };
          await db.jobs.put(row);
          newRows.push(row);
        }

        setSavedJobs((prev) => {
          const map = new Map(prev.map((r) => [r.id, r]));
          for (const nr of newRows) {
            map.set(nr.id, nr);
          }
          const merged = Array.from(map.values());
          merged.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
          return merged;
        });
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        setFindJobsNotice(err.detail ? `${err.message}: ${err.detail}` : err.message);
      } else {
        setFindJobsNotice(err?.message || 'Failed to find jobs');
      }
    } finally {
      setFindingJobs(false);
    }
  };

  const handleSelectJob = async (selected: ListedJob | ScoredJob) => {
    setSelectedJobId(selected.job.id);
    const existing = savedJobs.find((j) => j.id === selected.job.id);
    if (existing && !existing.scam) {
      try {
        const scamResp = await checkJobScam(selected.job);
        const updatedRow: SavedJob = { ...existing, scam: scamResp };
        // update, not put: a job removed while the check ran must stay removed.
        await db.jobs.update(existing.id, { scam: scamResp });
        setSavedJobs((prev) => prev.map((j) => (j.id === updatedRow.id ? updatedRow : j)));
      } catch {
        // A failed check must not block selection
      }
    }
  };

  const handleRemoveJob = async (jobToRemove: ListedJob | ScoredJob) => {
    const id = jobToRemove.job.id;
    await db.jobs.delete(id);
    setSavedJobs((prev) => prev.filter((j) => j.id !== id));
    if (selectedJobId === id) {
      setSelectedJobId(null);
    }
  };

  const displayJobs: ListedJob[] = useMemo(() => {
    return savedJobs.map((item) => {
      const ranked = item.ranked;
      const jobCopy = { ...ranked.job } as any;
      if (item.scam) {
        jobCopy.scam_risk = item.scam.risk_level;
        jobCopy.scam_reasons = item.scam.reasons;
        jobCopy.injection_warning = item.scam.injection_warning;
      }
      return {
        ...ranked,
        job: jobCopy,
      };
    });
  }, [savedJobs]);

  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return savedJobs.find((j) => j.id === selectedJobId)?.ranked.job || null;
  }, [savedJobs, selectedJobId]);

  const handleConfirmEmailStatus = async (conf: PendingConfirmation) => {
    const statusMap: Record<string, any> = {
      rejection: 'rejected',
      acknowledgement: 'viewed',
      assessment: 'assessment',
      interview: 'interview',
      offer: 'offer',
    };
    await updateApplicationStatus(conf.applicationId, statusMap[conf.detectedStatus] || 'viewed', 'gmail', conf.date);
    await db.pendingConfirmations.delete(conf.id);
    setPendingConfirmations((prev) => prev.filter((c) => c.id !== conf.id));
    await refreshApplications();
  };

  const handleDismissEmailStatus = async (id: string) => {
    await db.pendingConfirmations.delete(id);
    setPendingConfirmations((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div style={{ ...page, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top Header */}
      <header style={{ padding: '12px 16px', borderBottom: `1px solid ${color.border}`, backgroundColor: color.surface, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={h1}>Job Copilot</h1>
          <p style={{ ...subtitle, fontSize: font.xs }}>Job search and application assistant</p>
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
            <AddJob onJobAdded={handleAddJob} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs }}>
              <button
                type="button"
                onClick={handleFindJobs}
                disabled={findingJobs}
                style={primaryButton}
              >
                {findingJobs ? 'Finding jobs...' : 'Find jobs'}
              </button>
              {findJobsNotice && (
                <div style={{ ...statusText, fontSize: font.sm, marginTop: space.xs }}>
                  {findJobsNotice}
                </div>
              )}
            </div>
            <JobList
              jobs={displayJobs}
              selectedJobId={selectedJobId}
              onSelectJob={handleSelectJob}
              onRemoveJob={handleRemoveJob}
            />
          </div>
        )}

        {activeTab === 'draft' && (
          <DraftPage
            profile={profile}
            job={selectedJob}
          />
        )}

        {activeTab === 'fill' && (
          <FillPage profile={profile} selectedJob={selectedJob} />
        )}

        {activeTab === 'tracker' && (
          <div style={stack}>
            <GmailSyncCard
              onSyncComplete={async () => {
                await refreshApplications();
                await refreshPendingConfirmations();
              }}
            />
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

