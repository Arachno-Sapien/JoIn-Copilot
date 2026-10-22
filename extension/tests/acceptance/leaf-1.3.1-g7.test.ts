// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { discoverFields, fillFieldWithEngine } from '../../lib/fill/engine';
import { contentScriptDefinition } from '../../entrypoints/content/config';

describe('leaf-1.3.1:G7 Shadow DOM Handling and All-Frames Content Script', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="test-form">
        <input name="regular_field" type="text" />
        <div id="open-shadow-host"></div>
        <div id="closed-shadow-host" data-has-closed-shadow="true" data-field-name="secure_code" data-field-label="Security Code"></div>
      </form>
    `;

    // Attach open shadow root
    const openHost = document.getElementById('open-shadow-host')!;
    const openShadow = openHost.attachShadow({ mode: 'open' });
    openShadow.innerHTML = `
      <label for="shadow-input">Shadow Field</label>
      <input id="shadow-input" name="open_shadow_field" type="text" />
    `;
  });

  it('lists and fills fields inside open shadow roots', async () => {
    const form = document.getElementById('test-form')!;
    const fields = discoverFields(form);

    const shadowField = fields.find((f) => f.name === 'open_shadow_field');
    expect(shadowField).toBeDefined();
    expect(shadowField?.manual).toBeFalsy();

    // Fill field
    const filled = await fillFieldWithEngine(shadowField!, 'Shadow Value');
    expect(filled).toBe(true);

    const openHost = document.getElementById('open-shadow-host')!;
    const inputInShadow = openHost.shadowRoot?.querySelector<HTMLInputElement>('#shadow-input');
    expect(inputInShadow?.value).toBe('Shadow Value');
  });

  it('reports fields behind closed shadow roots for manual entry', () => {
    const form = document.getElementById('test-form')!;
    const fields = discoverFields(form);

    const closedField = fields.find((f) => f.name === 'secure_code');
    expect(closedField).toBeDefined();
    expect(closedField?.manual).toBe(true);
  });

  it('content script runs in all frames and matches allowlisted ATS URLs', () => {
    expect(contentScriptDefinition.allFrames).toBe(true);
    expect(contentScriptDefinition.matches).toContain('https://boards.greenhouse.io/*');
    expect(contentScriptDefinition.matches).toContain('https://job-boards.greenhouse.io/*');
    expect(contentScriptDefinition.matches).toContain('https://jobs.lever.co/*');
    // Ensure no broad patterns
    expect(contentScriptDefinition.matches).not.toContain('<all_urls>');
    expect(contentScriptDefinition.matches).not.toContain('*://*/*');
  });
});
