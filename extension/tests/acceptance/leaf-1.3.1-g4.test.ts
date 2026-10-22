// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { greenhouseAdapter } from '../../adapters/greenhouse';
import { leverAdapter } from '../../adapters/lever';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('leaf-1.3.1:G4 Form Filling Never Auto-Submits', () => {
  let submitSpy: any;
  let requestSubmitSpy: any;
  let clickSpy: any;
  let dispatchEventSpy: any;
  let submitEventDispatched = false;

  beforeEach(() => {
    submitEventDispatched = false;
    submitSpy = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
    requestSubmitSpy = vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(() => {});
    clickSpy = vi.spyOn(HTMLElement.prototype, 'click');

    const origDispatch = EventTarget.prototype.dispatchEvent;
    dispatchEventSpy = vi.spyOn(EventTarget.prototype, 'dispatchEvent').mockImplementation(function (
      this: EventTarget,
      event: Event
    ) {
      if (event.type === 'submit') {
        submitEventDispatched = true;
      }
      return origDispatch.call(this, event);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never calls submit, requestSubmit, click on submit controls, or dispatches submit event on Greenhouse', async () => {
    const html = readFileSync(resolve(__dirname, '../unit/fill/snapshots/greenhouse/application.html'), 'utf8');
    document.body.innerHTML = html;
    const form = document.querySelector('form')!;

    const fields = greenhouseAdapter.listFields(form);
    for (const field of fields) {
      if (field.type === 'file') {
        await greenhouseAdapter.fillField(field, new File(['test'], 'resume.pdf', { type: 'application/pdf' }));
      } else {
        await greenhouseAdapter.fillField(field, 'Test Value');
      }
    }

    expect(submitSpy).not.toHaveBeenCalled();
    expect(requestSubmitSpy).not.toHaveBeenCalled();
    expect(submitEventDispatched).toBe(false);

    // Check that no click was called on any submit button
    const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"], [id*="submit" i]');
    submitButtons.forEach((btn) => {
      expect(clickSpy).not.toHaveBeenCalledWith();
    });
  });

  it('never calls submit, requestSubmit, click on submit controls, or dispatches submit event on Lever', async () => {
    const html = readFileSync(resolve(__dirname, '../unit/fill/snapshots/lever/application.html'), 'utf8');
    document.body.innerHTML = html;
    const form = document.querySelector('form')!;

    const fields = leverAdapter.listFields(form);
    for (const field of fields) {
      if (field.type === 'file') {
        await leverAdapter.fillField(field, new File(['test'], 'resume.pdf', { type: 'application/pdf' }));
      } else {
        await leverAdapter.fillField(field, 'Test Value');
      }
    }

    expect(submitSpy).not.toHaveBeenCalled();
    expect(requestSubmitSpy).not.toHaveBeenCalled();
    expect(submitEventDispatched).toBe(false);

    const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"], [id*="submit" i]');
    submitButtons.forEach((btn) => {
      expect(clickSpy).not.toHaveBeenCalledWith();
    });
  });
});
