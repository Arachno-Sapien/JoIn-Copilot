import React from 'react';
import { FilledField, FormField } from '../../lib/messaging';
import * as ui from '../ui';

export interface FillReviewProps {
  filled: FilledField[];
  skipped: FormField[];
}

export const FillReview: React.FC<FillReviewProps> = ({ filled, skipped }) => {
  return (
    <div className="fill-review-card" style={ui.card}>
      <h3 style={ui.h3}>
        Form Filling Review
      </h3>

      <div
        style={{ ...ui.callout('info'), borderLeft: `4px solid ${ui.color.infoBorder}`, marginBottom: ui.space.lg }}
      >
        Automated filling complete. Please review the form on the page and submit the form on the page yourself.
      </div>

      <div style={{ marginBottom: ui.space.lg }}>
        <h4 style={{ ...ui.h4, fontSize: ui.font.md, color: ui.color.success }}>
          Filled Fields ({filled.length})
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.xs }}>
          {filled.map((item, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: ui.space.sm,
                padding: '6px 8px',
                backgroundColor: ui.color.successTint,
                borderRadius: ui.radius.sm,
                fontSize: ui.font.sm,
                overflowWrap: 'anywhere',
              }}
            >
              <span style={{ fontWeight: 500, color: ui.color.text }}>{item.name}</span>
              <span style={{ color: ui.color.textMuted }}>{String(item.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {skipped.length > 0 && (
        <div>
          <h4 style={{ ...ui.h4, fontSize: ui.font.md, color: ui.color.warning }}>
            Skipped / Manual Attention Needed ({skipped.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.xs }}>
            {skipped.map((field, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: ui.space.sm,
                  padding: '6px 8px',
                  backgroundColor: ui.color.warningTint,
                  borderRadius: ui.radius.sm,
                  fontSize: ui.font.sm,
                  overflowWrap: 'anywhere',
                }}
              >
                <span style={{ fontWeight: 500, color: ui.color.text }}>{field.label || field.name}</span>
                <span style={{ color: ui.color.warning, fontStyle: 'italic' }}>
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
