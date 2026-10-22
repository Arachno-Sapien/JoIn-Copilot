// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupSubmissionDetector } from '../../lib/fill/submission';

describe('leaf-1.3.1:G8 Submission Detection', () => {
  let form: HTMLFormElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <form id="apply-form" action="/submit">
        <input name="name" value="Alex Doe" />
        <input name="email" value="alex@example.com" />
        <button id="submit-btn" type="button">Submit Application</button>
      </form>
      <div id="status-container"></div>
    `;
    form = document.querySelector('form')!;
  });

  it('fires on form submit event with current form answers', () => {
    const callback = vi.fn();
    const cleanup = setupSubmissionDetector(form, callback, { jobId: 'job-101', url: 'https://boards.greenhouse.io/test/job-101' });

    // User edits an input before submission
    const nameInput = form.querySelector<HTMLInputElement>('input[name="name"]')!;
    nameInput.value = 'Alex Edited';

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(callback).toHaveBeenCalledTimes(1);
    const payload = callback.mock.calls[0][0];
    expect(payload.type).toBe('APPLICATION_SUBMITTED');
    expect(payload.jobId).toBe('job-101');
    expect(payload.answers.name).toBe('Alex Edited');
    expect(payload.answers.email).toBe('alex@example.com');

    cleanup();
  });

  it('fires on user click on submit control with current answers', () => {
    const callback = vi.fn();
    const cleanup = setupSubmissionDetector(form, callback, { jobId: 'job-101', url: 'https://boards.greenhouse.io/test/job-101' });

    const btn = document.getElementById('submit-btn')!;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(callback).toHaveBeenCalledTimes(1);
    const payload = callback.mock.calls[0][0];
    expect(payload.type).toBe('APPLICATION_SUBMITTED');
    expect(payload.answers.name).toBe('Alex Doe');

    cleanup();
  });

  it('fires on confirmation message in DOM with current answers', async () => {
    const callback = vi.fn();
    const cleanup = setupSubmissionDetector(form, callback, { jobId: 'job-101', url: 'https://boards.greenhouse.io/test/job-101' });

    // Mutate DOM to add confirmation message
    const statusContainer = document.getElementById('status-container')!;
    const thanksHeading = document.createElement('h2');
    thanksHeading.textContent = 'Thank you for applying! Application received.';
    statusContainer.appendChild(thanksHeading);

    // Allow mutation observer to fire
    await new Promise((r) => setTimeout(r, 50));

    expect(callback).toHaveBeenCalledTimes(1);
    const payload = callback.mock.calls[0][0];
    expect(payload.type).toBe('APPLICATION_SUBMITTED');
    expect(payload.answers.name).toBe('Alex Doe');

    cleanup();
  });
});
