import React, { useState } from 'react';
import { DraftResponse } from '../../lib/schemas/draft';
import * as ui from '../ui';

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
    <div className="draft-view-card" style={ui.card}>
      <h3 style={ui.h3}>Application Answer Draft</h3>

      <div
        style={{
          padding: ui.space.md,
          backgroundColor: ui.color.bg,
          border: `1px solid ${ui.color.border}`,
          borderRadius: ui.radius.md,
          fontSize: ui.font.md,
          lineHeight: 1.6,
          color: ui.color.text,
          marginBottom: ui.space.lg,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {currentText}
      </div>

      <div style={{ marginBottom: ui.space.lg }}>
        <h4 style={ui.h4}>
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
                  padding: ui.space.md,
                  borderRadius: ui.radius.md,
                  border: `1px solid ${isUnsupported ? ui.color.dangerBorder : isPartly ? ui.color.warningBorder : ui.color.successBorder}`,
                  backgroundColor: isUnsupported ? ui.color.dangerTint : isPartly ? ui.color.warningTint : ui.color.successTint,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: ui.space.sm }}>
                  <span style={{ fontSize: ui.font.md, fontWeight: 500, color: ui.color.text, overflowWrap: 'anywhere' }}>
                    "{claim.claim}"
                  </span>
                  <span
                    style={{
                      fontSize: ui.font.xs,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      color: isUnsupported ? ui.color.danger : isPartly ? ui.color.warning : ui.color.success,
                    }}
                  >
                    {status.replace('_', ' ')}
                  </span>
                </div>
                {claim.reason && (
                  <div style={{ fontSize: ui.font.sm, color: ui.color.textMuted, marginTop: ui.space.xs }}>
                    <strong>Reason:</strong> {claim.reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {rewriteText && (
        <div style={{ borderTop: `1px solid ${ui.color.border}`, paddingTop: ui.space.md }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: ui.space.sm }}>
            <span style={ui.statusText}>
              {appliedRewrite ? 'Rewritten draft applied.' : 'Verified rewrite available.'}
            </span>
            <button
              type="button"
              onClick={handleRewrite}
              style={appliedRewrite ? { ...ui.primaryButton, backgroundColor: ui.color.success, borderColor: ui.color.success } : ui.primaryButton}
            >
              {appliedRewrite ? 'Rewrite Applied' : 'Apply Rewrite'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
