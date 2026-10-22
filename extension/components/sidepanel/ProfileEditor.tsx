import React, { useState } from 'react';
import { db } from '../../lib/db';
import { Profile, SkillLevel } from '../../lib/schemas/profile';

export interface ProfileEditorProps {
  initialProfile: Profile;
  onSaved?: (updated: Profile) => void;
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({ initialProfile, onSaved }) => {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleFieldChange = (field: keyof Profile, value: any) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSavedSuccess(false);
  };

  const handleSkillLevelChange = (skillIndex: number, newLevel: SkillLevel) => {
    setProfile((prev) => {
      const updatedSkills = [...prev.skills];
      updatedSkills[skillIndex] = {
        ...updatedSkills[skillIndex],
        level: newLevel,
      };
      return {
        ...prev,
        skills: updatedSkills,
      };
    });
    setSavedSuccess(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await db.profile.put({ ...profile, id: 'main' });
      setSavedSuccess(true);
      if (onSaved) {
        onSaved(profile);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fff' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Edit Profile</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
          <span style={{ fontWeight: '500', marginBottom: '2px' }}>Name:</span>
          <input
            type="text"
            aria-label="Name"
            value={profile.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
          <span style={{ fontWeight: '500', marginBottom: '2px' }}>Email:</span>
          <input
            type="email"
            aria-label="Email"
            value={profile.email}
            onChange={(e) => handleFieldChange('email', e.target.value)}
            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
          <span style={{ fontWeight: '500', marginBottom: '2px' }}>Phone:</span>
          <input
            type="tel"
            aria-label="Phone"
            value={profile.phone}
            onChange={(e) => handleFieldChange('phone', e.target.value)}
            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
          <span style={{ fontWeight: '500', marginBottom: '2px' }}>Location:</span>
          <input
            type="text"
            aria-label="Location"
            value={profile.location}
            onChange={(e) => handleFieldChange('location', e.target.value)}
            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }}
          />
        </label>

        <div style={{ marginTop: '8px' }}>
          <span style={{ fontWeight: '500', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Skills & Levels:</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {profile.skills.map((skill, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#374151' }}>{skill.name}</span>
                <select
                  aria-label={`${skill.name} level`}
                  value={skill.level}
                  onChange={(e) => handleSkillLevelChange(index, e.target.value as SkillLevel)}
                  style={{ padding: '4px 6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="strong">Strong</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '6px 16px',
              backgroundColor: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
          {savedSuccess && <span style={{ fontSize: '12px', color: '#16a34a' }}>Saved!</span>}
        </div>
      </div>
    </form>
  );
};
