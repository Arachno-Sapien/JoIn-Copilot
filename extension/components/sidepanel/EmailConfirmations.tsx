import React from 'react';
import { PendingConfirmation } from '../../lib/schemas/email';

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
    <div className="email-confirmations" style={{ marginBottom: '16px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f59e0b', marginBottom: '8px' }}>
        Email Status Updates Pending Review ({confirmations.length})
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {confirmations.map((conf) => (
          <div
            key={conf.id}
            data-testid="email-confirmation-card"
            style={{
              padding: '12px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{conf.company}</span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: '#b45309',
                  backgroundColor: '#fef3c7',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                {conf.detectedStatus}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>
              Role: {conf.role}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>
              Subject: {conf.subject} (Confidence: {Math.round(conf.confidence * 100)}%)
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => onConfirm(conf)}
                style={{
                  padding: '4px 10px',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => onDismiss(conf.id)}
                style={{
                  padding: '4px 10px',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
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
