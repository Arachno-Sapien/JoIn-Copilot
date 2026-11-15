import React from 'react';
import { PendingConfirmation } from '../../lib/schemas/email';
import * as ui from '../ui';

interface EmailConfirmationsProps {
  confirmations: PendingConfirmation[];
  onConfirm: (conf: PendingConfirmation) => void;
  onDismiss: (id: string) => void;
}

export const EmailConfirmations: React.FC<EmailConfirmationsProps> = ({
  confirmations,
  onConfirm,
  onDismiss,
}) => {
  if (confirmations.length === 0) {
    return null;
  }

  return (
    <div className="email-confirmations">
      <h3 style={{ ...ui.h4, color: ui.color.warning }}>
        Email Status Updates Pending Review ({confirmations.length})
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.sm }}>
        {confirmations.map((conf) => (
          <div
            key={conf.id}
            data-testid="email-confirmation-card"
            style={{ ...ui.callout('warning'), padding: ui.space.md, color: ui.color.text }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: ui.space.sm, marginBottom: ui.space.xs }}>
              <span style={{ fontWeight: 600, fontSize: ui.font.md }}>{conf.company}</span>
              <span
                style={{
                  ...ui.badge,
                  textTransform: 'uppercase',
                  color: ui.color.warning,
                  backgroundColor: ui.color.badgeWarning,
                }}
              >
                {conf.detectedStatus}
              </span>
            </div>
            <div style={{ fontSize: ui.font.sm, color: ui.color.textMuted, marginBottom: ui.space.xs }}>
              Role: {conf.role}
            </div>
            <div style={{ fontSize: ui.font.xs, color: ui.color.textSubtle, marginBottom: ui.space.sm }}>
              Subject: {conf.subject} (Confidence: {Math.round(conf.confidence * 100)}%)
            </div>
            <div style={{ display: 'flex', gap: ui.space.sm }}>
              <button
                type="button"
                onClick={() => onConfirm(conf)}
                style={{ ...ui.primaryButton, padding: '5px 12px' }}
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => onDismiss(conf.id)}
                style={{ ...ui.secondaryButton, padding: '5px 12px' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
