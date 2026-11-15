import React, { useState } from 'react';
import { db } from '../../lib/db';
import { parseResume } from '../../lib/api/profile';
import { ApiClient } from '../../lib/api/client';
import { Profile } from '../../lib/schemas/profile';
import * as ui from '../ui';

export interface ResumeUploadProps {
  onProfileLoaded?: (profile: Profile) => void;
}

export const ResumeUpload: React.FC<ResumeUploadProps> = ({ onProfileLoaded }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Call backend to parse resume
      const parsed = await parseResume(new ApiClient(), file);

      // 2. Store profile in IndexedDB
      await db.profile.put({ ...parsed, id: 'main' });

      // 3. Store resume blob in IndexedDB
      await db.resumes.put({
        id: `resume-${Date.now()}`,
        filename: file.name,
        data: file,
        uploadedAt: new Date().toISOString(),
      });

      setProfile(parsed);
      if (onProfileLoaded) {
        onProfileLoaded(parsed);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to parse resume');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="resume-upload-card" style={ui.card}>
      <h3 style={ui.h3}>Resume & Profile</h3>
      <p style={ui.bodyText}>
        Upload your resume PDF to automatically extract your structured profile.
      </p>

      <label style={{ display: 'block', marginBottom: ui.space.lg }}>
        <span style={ui.label}>Upload Resume (PDF):</span>
        <input
          type="file"
          accept=".pdf"
          aria-label="Upload Resume"
          onChange={handleFileUpload}
          disabled={loading}
          style={{ fontSize: ui.font.md, maxWidth: '100%' }}
        />
      </label>

      {loading && <div style={ui.statusText}>Parsing resume with AI...</div>}
      {error && <div style={ui.errorText}>{error}</div>}

      {profile && (
        <div style={{ marginTop: ui.space.lg, borderTop: `1px solid ${ui.color.border}`, paddingTop: ui.space.md }}>
          <h4 style={ui.h4}>Parsed Profile Preview</h4>
          <div style={{ fontSize: ui.font.md, color: ui.color.text, marginTop: '6px', overflowWrap: 'anywhere' }}>
            <div><strong>Name:</strong> <span>{profile.name}</span></div>
            <div><strong>Email:</strong> <span>{profile.email}</span></div>
            <div><strong>Location:</strong> <span>{profile.location}</span></div>
          </div>

          {profile.experience && profile.experience.length > 0 && (
            <div style={{ marginTop: ui.space.md }}>
              <div style={{ fontSize: ui.font.md, fontWeight: 600, color: ui.color.text }}>Experience:</div>
              {profile.experience.map((exp, idx) => (
                <div key={idx} style={{ fontSize: ui.font.sm, color: ui.color.textMuted, marginLeft: ui.space.sm, overflowWrap: 'anywhere' }}>
                  • {exp.role} at {exp.org} ({exp.start} - {exp.end})
                </div>
              ))}
            </div>
          )}

          {profile.skills && profile.skills.length > 0 && (
            <div style={{ marginTop: ui.space.md }}>
              <div style={{ fontSize: ui.font.md, fontWeight: 600, color: ui.color.text }}>Skills:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: ui.space.xs, marginTop: ui.space.xs }}>
                {profile.skills.map((s, idx) => (
                  <span
                    key={idx}
                    style={{ ...ui.badge, backgroundColor: ui.color.primaryTint, color: ui.color.primary }}
                  >
                    {s.name} ({s.level})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
