import React from 'react';
import { FilledField, FormField } from '../../lib/messaging';

export interface FillReviewProps {
  filled: FilledField[];
  skipped: FormField[];
}

export const FillReview: React.FC<FillReviewProps> = ({ filled, skipped }) => {
  return (
    <div className="fill-review-card" style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fff' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#111827' }}>
        Form Filling Review
      </h3>

      <div
        style={{
          padding: '10px 12px',
          backgroundColor: '#eff6ff',
          borderLeft: '4px solid #3b82f6',
          borderRadius: '4px',
          fontSize: '13px',
          color: '#1e40af',
          marginBottom: '16px',
        }}
      >
        Automated filling complete. Please review the form on the page and submit the form on the page yourself.
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#166534', marginBottom: '6px' }}>
          Filled Fields ({filled.length})
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {filled.map((item, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 8px',
                backgroundColor: '#f0fdf4',
                borderRadius: '4px',
                fontSize: '12px',
              }}
            >
              <span style={{ fontWeight: '500', color: '#374151' }}>{item.name}</span>
              <span style={{ color: '#4b5563' }}>{String(item.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {skipped.length > 0 && (
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#9a3412', marginBottom: '6px' }}>
            Skipped / Manual Attention Needed ({skipped.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {skipped.map((field, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  backgroundColor: '#fff7ed',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              >
                <span style={{ fontWeight: '500', color: '#374151' }}>{field.label || field.name}</span>
                <span style={{ color: '#ea580c', fontStyle: 'italic' }}>
                  {field.manual ? 'Manual Entry Required' : 'Review on page'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
