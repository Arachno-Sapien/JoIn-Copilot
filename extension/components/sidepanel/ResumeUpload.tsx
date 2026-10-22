import React, { useState } from 'react';
import { db } from '../../lib/db';
import { parseResume } from '../../lib/api/profile';
import { ApiClient } from '../../lib/api/client';
import { Profile } from '../../lib/schemas/profile';

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
    <div className="resume-upload-card" style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fff' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Resume & Profile</h3>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
        Upload your resume PDF to automatically extract your structured profile.
      </p>

      <label style={{ display: 'block', marginBottom: '16px' }}>
        <span style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Upload Resume (PDF):</span>
        <input
          type="file"
          accept=".pdf"
          aria-label="Upload Resume"
          onChange={handleFileUpload}
          disabled={loading}
          style={{ fontSize: '13px' }}
        />
      </label>

      {loading && <div style={{ fontSize: '13px', color: '#3b82f6' }}>Parsing resume with AI...</div>}
      {error && <div style={{ fontSize: '13px', color: '#ef4444' }}>{error}</div>}

      {profile && (
        <div style={{ marginTop: '16px', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>Parsed Profile Preview</h4>
          <div style={{ fontSize: '13px', color: '#374151', marginTop: '6px' }}>
            <div><strong>Name:</strong> <span>{profile.name}</span></div>
            <div><strong>Email:</strong> <span>{profile.email}</span></div>
            <div><strong>Location:</strong> <span>{profile.location}</span></div>
          </div>

          {profile.experience && profile.experience.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Experience:</div>
              {profile.experience.map((exp, idx) => (
                <div key={idx} style={{ fontSize: '12px', color: '#4b5563', marginLeft: '8px' }}>
                  • {exp.role} at {exp.org} ({exp.start} - {exp.end})
                </div>
              ))}
            </div>
          )}

          {profile.skills && profile.skills.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Skills:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                {profile.skills.map((s, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      borderRadius: '4px',
                    }}
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
