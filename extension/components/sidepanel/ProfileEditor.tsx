import React, { useState } from 'react';
import { db } from '../../lib/db';
import { Profile, SkillLevel } from '../../lib/schemas/profile';
import * as ui from '../ui';

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
    <form onSubmit={handleSave} style={ui.card}>
      <h3 style={ui.h3}>Edit Profile</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.md }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: ui.font.md }}>
          <span style={ui.label}>Name:</span>
          <input
            type="text"
            aria-label="Name"
            value={profile.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            style={ui.input}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: ui.font.md }}>
          <span style={ui.label}>Email:</span>
          <input
            type="email"
            aria-label="Email"
            value={profile.email}
            onChange={(e) => handleFieldChange('email', e.target.value)}
            style={ui.input}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: ui.font.md }}>
          <span style={ui.label}>Phone:</span>
          <input
            type="tel"
            aria-label="Phone"
            value={profile.phone}
            onChange={(e) => handleFieldChange('phone', e.target.value)}
            style={ui.input}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: ui.font.md }}>
          <span style={ui.label}>Location:</span>
          <input
            type="text"
            aria-label="Location"
            value={profile.location}
            onChange={(e) => handleFieldChange('location', e.target.value)}
            style={ui.input}
          />
        </label>

        <div style={{ marginTop: '8px' }}>
          <span style={{ ...ui.label, marginBottom: ui.space.sm }}>Skills & Levels:</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {profile.skills.map((skill, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: ui.space.sm }}>
                <span style={{ fontSize: ui.font.md, color: ui.color.text, overflowWrap: 'anywhere' }}>{skill.name}</span>
                <select
                  aria-label={`${skill.name} level`}
                  value={skill.level}
                  onChange={(e) => handleSkillLevelChange(index, e.target.value as SkillLevel)}
                  style={ui.select}
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
            style={ui.primaryButton}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
          {savedSuccess && <span style={ui.successText}>Saved!</span>}
        </div>
      </div>
    </form>
  );
};
