import type React from 'react';

/** Shared design tokens and style objects. Focus ring and disabled-button styles live in the <style> block of each entrypoint index.html. */

export const color = {
  bg: '#f9fafb',
  surface: '#ffffff',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  text: '#111827',
  textMuted: '#4b5563',
  textSubtle: '#6b7280',
  primary: '#4338ca',
  primaryTint: '#eef2ff',
  success: '#15803d',
  successTint: '#f0fdf4',
  successBorder: '#86efac',
  warning: '#92400e',
  warningTint: '#fffbeb',
  warningBorder: '#fcd34d',
  danger: '#b91c1c',
  dangerTint: '#fef2f2',
  dangerBorder: '#fca5a5',
  badgeSuccess: '#dcfce7',
  badgeWarning: '#fef3c7',
  badgeDanger: '#fee2e2',
  badgePrimary: '#e0e7ff',
  badgeNeutral: '#f3f4f6',
  info: '#1e40af',
  infoTint: '#eff6ff',
  infoBorder: '#3b82f6',
} as const;

export const space = { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px' } as const;
export const radius = { sm: '4px', md: '6px', lg: '8px', pill: '9999px' } as const;
export const font = {
  family: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  xs: '11px',
  sm: '12px',
  md: '13px',
  lg: '14px',
  h3: '16px',
  h1: '18px',
} as const;

type S = React.CSSProperties;

export const page: S = {
  backgroundColor: color.bg,
  color: color.text,
  fontFamily: font.family,
  fontSize: font.md,
  lineHeight: 1.5,
};

export const card: S = {
  padding: space.lg,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  backgroundColor: color.surface,
  boxSizing: 'border-box',
  maxWidth: '100%',
};

export const stack: S = { display: 'flex', flexDirection: 'column', gap: space.lg };

export const h1: S = { margin: 0, fontSize: font.h1, fontWeight: 700, color: color.text, lineHeight: 1.3 };
export const h2: S = { margin: `0 0 ${space.md}`, fontSize: font.h3, fontWeight: 600, color: color.text, lineHeight: 1.3 };
export const h3: S = { margin: `0 0 ${space.sm}`, fontSize: font.h3, fontWeight: 600, color: color.text, lineHeight: 1.3 };
export const h4: S = { margin: `0 0 ${space.sm}`, fontSize: font.lg, fontWeight: 600, color: color.text, lineHeight: 1.3 };
export const subtitle: S = { margin: '2px 0 0', fontSize: font.sm, color: color.textSubtle };
export const bodyText: S = { margin: `0 0 ${space.md}`, fontSize: font.md, color: color.textMuted };

const button: S = {
  padding: '8px 14px',
  borderRadius: radius.md,
  fontSize: font.md,
  fontWeight: 500,
  lineHeight: 1.2,
  cursor: 'pointer',
  transition: 'background-color 0.15s, border-color 0.15s',
};
export const primaryButton: S = { ...button, backgroundColor: color.primary, color: '#ffffff', border: `1px solid ${color.primary}` };
export const secondaryButton: S = { ...button, backgroundColor: color.surface, color: color.text, border: `1px solid ${color.borderStrong}` };
export const dangerButton: S = { ...button, backgroundColor: color.danger, color: '#ffffff', border: `1px solid ${color.danger}` };
export const linkButton: S = {
  border: 'none',
  background: 'none',
  padding: 0,
  color: color.primary,
  textDecoration: 'underline',
  cursor: 'pointer',
  fontSize: 'inherit',
  fontFamily: 'inherit',
};

export const label: S = { display: 'block', fontSize: font.md, fontWeight: 500, color: color.text, marginBottom: space.xs };
export const input: S = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '7px 10px',
  borderRadius: radius.md,
  border: `1px solid ${color.borderStrong}`,
  backgroundColor: color.surface,
  color: color.text,
  fontSize: font.md,
  fontFamily: 'inherit',
};
export const select: S = { ...input, width: 'auto', padding: '4px 8px' };

export const errorText: S = { fontSize: font.md, color: color.danger, fontWeight: 600 };
export const successText: S = { fontSize: font.md, color: color.success, fontWeight: 500 };
export const statusText: S = { fontSize: font.md, color: color.textMuted };
export const emptyText: S = { fontSize: font.md, color: color.textSubtle, fontStyle: 'italic', padding: space.md };

export const badge: S = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: radius.pill,
  fontSize: font.xs,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

/** Soft callout boxes (background, border and text colour). */
export const callout = (tone: 'success' | 'warning' | 'danger' | 'info'): S => {
  const t = {
    success: [color.successTint, color.successBorder, color.success],
    warning: [color.warningTint, color.warningBorder, color.warning],
    danger: [color.dangerTint, color.dangerBorder, color.danger],
    info: [color.infoTint, color.infoBorder, color.info],
  }[tone];
  return { padding: `${space.sm} ${space.md}`, backgroundColor: t[0], border: `1px solid ${t[1]}`, borderRadius: radius.md, color: t[2], fontSize: font.md };
};
