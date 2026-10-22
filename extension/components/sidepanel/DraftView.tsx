import React, { useState } from 'react';
import { DraftResponse } from '../../lib/schemas/draft';

export interface DraftViewProps {
  initialDraft: DraftResponse;
  onApplyRewrite?: (rewritten: string) => void;
}

export const DraftView: React.FC<DraftViewProps> = ({ initialDraft, onApplyRewrite }) => {
  const [currentText, setCurrentText] = useState(initialDraft.draft);
  const [appliedRewrite, setAppliedRewrite] = useState(false);

  const rewriteText = initialDraft.rewritten_draft || initialDraft.rewrite;

  const handleRewrite = () => {
    if (rewriteText) {
      setCurrentText(rewriteText);
      setAppliedRewrite(true);
      onApplyRewrite?.(rewriteText);
    }
  };

  return (
    <div className="draft-view-card" style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fff' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Application Answer Draft</h3>

      <div
        style={{
          padding: '12px',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          fontSize: '13px',
          lineHeight: '1.5',
          color: '#1f2937',
          marginBottom: '16px',
        }}
      >
        {currentText}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
          Fabrication & Verification Checks
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {initialDraft.claims.map((claim, index) => {
            const status = claim.judgment || claim.verdict || 'supported';
            const isUnsupported = status === 'unsupported';
            const isPartly = status === 'partly_supported';
            const color = isUnsupported ? 'red' : isPartly ? 'amber' : 'green';

            return (
              <div
                key={index}
                data-testid={`claim-${status}`}
                data-status-color={color}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: `1px solid ${isUnsupported ? '#fca5a5' : isPartly ? '#fcd34d' : '#86efac'}`,
                  backgroundColor: isUnsupported ? '#fef2f2' : isPartly ? '#fffbeb' : '#f0fdf4',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#111827' }}>
                    "{claim.claim}"
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      color: isUnsupported ? '#b91c1c' : isPartly ? '#b45309' : '#15803d',
                    }}
                  >
                    {status.replace('_', ' ')}
                  </span>
                </div>
                {claim.reason && (
                  <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '4px' }}>
                    <strong>Reason:</strong> {claim.reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {rewriteText && (
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#4b5563' }}>
              {appliedRewrite ? 'Rewritten draft applied.' : 'Verified rewrite available.'}
            </span>
            <button
              type="button"
              onClick={handleRewrite}
              style={{
                padding: '6px 14px',
                backgroundColor: appliedRewrite ? '#10b981' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              {appliedRewrite ? 'Rewrite Applied' : 'Apply Rewrite'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
