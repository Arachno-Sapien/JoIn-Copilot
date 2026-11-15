// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupSubmissionDetector } from '../../../lib/fill/submission';
import { discoverFields, fillFieldWithEngine } from '../../../lib/fill/engine';
import { fillActivePage } from '../../../lib/fill/page';
import * as fillApi from '../../../lib/api/fill';

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-jc-filled-page');
});

function click(el: Element) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('submission detector', () => {
  it('ignores a click on a text field whose value mentions applying', () => {
    document.body.innerHTML = '<form><input id="why" value="I want to apply because"></form>';
    const seen = vi.fn();
    setupSubmissionDetector(document, seen);
    click(document.getElementById('why')!);
    expect(seen).not.toHaveBeenCalled();
  });

  it('ignores an Apply button that sits outside the form', () => {
    document.body.innerHTML = '<button id="jump">Apply for this job</button><form><input name="email"></form>';
    const seen = vi.fn();
    setupSubmissionDetector(document, seen);
    click(document.getElementById('jump')!);
    expect(seen).not.toHaveBeenCalled();
  });

  it('sees a click on the text inside the form submit button', () => {
    document.body.innerHTML =
      '<form><input name="email" value="a@example.test"><button type="button"><span id="t">Submit application</span></button></form>';
    const seen = vi.fn();
    setupSubmissionDetector(document, seen);
    click(document.getElementById('t')!);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0][0].answers).toEqual({ email: 'a@example.test' });
  });

  it('never records passwords', () => {
    document.body.innerHTML = '<form><input name="pw" type="password" value="hunter2"><button>Submit</button></form>';
    const seen = vi.fn();
    setupSubmissionDetector(document, seen);
    click(document.querySelector('button')!);
    expect(seen.mock.calls[0][0].answers).toEqual({});
  });

  it('on unknown sites records only forms that Job Copilot filled', async () => {
    document.body.innerHTML = '<form><input name="q"><button>Submit</button></form>';
    const seen = vi.fn();
    setupSubmissionDetector(document, seen, { onlyFilled: true });
    click(document.querySelector('button')!);
    expect(seen).not.toHaveBeenCalled(); // e.g. a site search form

    const [field] = discoverFields(document);
    await fillFieldWithEngine(field, 'backend');
    click(document.querySelector('button')!);
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe('fill engine', () => {
  it('picks a dropdown option by its visible text', async () => {
    document.body.innerHTML =
      '<select name="degree"><option value="">Choose</option><option value="7">Bachelor of Technology</option></select>';
    const [field] = discoverFields(document);
    expect(await fillFieldWithEngine(field, 'bachelor of technology')).toBe(true);
    expect((document.querySelector('select') as HTMLSelectElement).value).toBe('7');
  });

  it('skips a dropdown that has no matching option', async () => {
    document.body.innerHTML = '<select name="degree"><option value="1">PhD</option></select>';
    const [field] = discoverFields(document);
    expect(await fillFieldWithEngine(field, 'Bachelor')).toBe(false);
  });

  it('leaves checkboxes and radio buttons for the user', async () => {
    document.body.innerHTML = '<input type="checkbox" name="terms" value="yes">';
    const [field] = discoverFields(document);
    expect(await fillFieldWithEngine(field, 'Hyderabad')).toBe(false);
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('yes');
  });

  it('never fills a field the user cannot see', async () => {
    document.body.innerHTML = '<input name="email" style="opacity:0">';
    const input = document.querySelector('input') as HTMLInputElement;
    input.checkVisibility = () => false; // jsdom has no layout
    const [field] = discoverFields(document);
    expect(await fillFieldWithEngine(field, 'asha@example.test')).toBe(false);
    expect(input.value).toBe('');
  });

  it('lists fields whose id has characters that break a CSS selector', () => {
    document.body.innerHTML = '<label for=\'a"b\'>Name</label><input id=\'a"b\'>';
    expect(discoverFields(document)[0].label).toBe('Name');
  });
});

describe('fillActivePage with frames', () => {
  const profile: any = { name: 'Asha Rao', email: 'asha@example.test', phone: '', location: '', links: {}, experience: [], education: [] };
  const emailField = [{ name: 'email', type: 'email' }];

  // Each frame answers only when it has fields, and a fill only when it is the target.
  function openTabWithFrames(frames: Array<{ frameId: number; url: string; fields: any[]; frame: string }>) {
    const sendMessage = vi.fn(async (_tab: number, message: any, options?: { frameId?: number }) => {
      const candidates = frames.filter((f) => options?.frameId === undefined || f.frameId === options.frameId);
      const frame = candidates.find(
        (f) => f.fields.length && (message.type === 'LIST_FIELDS' || !message.frame || message.frame === f.frame)
      );
      if (!frame) return undefined;
      if (message.type === 'LIST_FIELDS') return { fields: frame.fields, url: frame.url, frame: frame.frame };
      return {
        filled: Object.entries(message.values).map(([name, value]) => ({ name, value })),
        skipped: [],
        verify: { verified: [], mismatches: [] },
      };
    });
    (globalThis as any).chrome = {
      tabs: { query: vi.fn(async () => [{ id: 7, url: frames[0].url }]), sendMessage },
      scripting: { executeScript: vi.fn(async () => {}) },
    };
    return sendMessage;
  }

  const fills = (send: ReturnType<typeof vi.fn>) => send.mock.calls.filter(([, m]) => m.type === 'FILL_REQUEST');

  it('sends the fill only to the top frame when the form is there', async () => {
    const send = openTabWithFrames([
      { frameId: 0, url: 'https://careers.example.test/apply', fields: emailField, frame: 'top' },
      { frameId: 4, url: 'https://ads.example.net/x', fields: emailField, frame: 'ad' },
    ]);
    await fillActivePage(profile);
    expect(fills(send)).toHaveLength(1);
    expect(fills(send)[0][2]).toEqual({ frameId: 0 });
  });

  it('fills a Greenhouse form embedded in a company page, and only that frame', async () => {
    const send = openTabWithFrames([
      { frameId: 0, url: 'https://careers.example.test/apply', fields: [], frame: 'top' },
      { frameId: 4, url: 'https://boards.greenhouse.io/embed/job_app?for=acme', fields: emailField, frame: 'gh' },
    ]);
    const result = await fillActivePage(profile);
    expect(result.filled).toHaveLength(1);
    expect(fills(send)[0][1].frame).toBe('gh');
  });

  it('never sends profile data to a frame from another site', async () => {
    const send = openTabWithFrames([
      { frameId: 0, url: 'https://careers.example.test/apply', fields: [], frame: 'top' },
      { frameId: 4, url: 'https://ads.example.net/newsletter', fields: emailField, frame: 'ad' },
    ]);
    await expect(fillActivePage(profile)).rejects.toThrow(/another site/);
    expect(fills(send)).toHaveLength(0);
  });
});

describe('fillActivePage', () => {
  const profile: any = {
    name: 'Asha Rao',
    email: 'asha@example.test',
    phone: '',
    location: 'Pune',
    links: {},
    experience: [],
    education: [],
  };
  const fields = [
    { name: 'email', type: 'email' },
    { name: 'essay', label: 'Why us?' },
  ];
  let sendMessage: ReturnType<typeof vi.fn>;
  let executeScript: ReturnType<typeof vi.fn>;

  function openTab(url: string | undefined, loaded: boolean) {
    let injected = loaded;
    executeScript = vi.fn(async () => {
      injected = true;
    });
    sendMessage = vi.fn(async (_tab: number, message: any) => {
      if (!injected) throw new Error('Receiving end does not exist');
      if (message.type === 'LIST_FIELDS') return { fields };
      return {
        filled: Object.entries(message.values).map(([name, value]) => ({ name, value })),
        skipped: fields.filter((f) => !(f.name in message.values)),
        verify: { verified: [], mismatches: [] },
      };
    });
    (globalThis as any).chrome = {
      tabs: { query: vi.fn(async () => [{ id: 7, url }]), sendMessage },
      scripting: { executeScript },
    };
  }

  it('fills what the profile answers and reports the rest as skipped', async () => {
    openTab('https://boards.greenhouse.io/acme/jobs/1', true);
    const result = await fillActivePage(profile);
    expect(result.filled).toEqual([{ name: 'email', value: 'asha@example.test' }]);
    expect(result.skipped.map((f) => f.name)).toEqual(['essay']);
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('injects the content script on a site where it is not loaded yet', async () => {
    openTab('https://internshala.com/application/form/1', false);
    const result = await fillActivePage(profile);
    expect(executeScript).toHaveBeenCalledTimes(1);
    expect(result.filled).toHaveLength(1);
  });

  it('moves a field the page rejected from filled to skipped', async () => {
    openTab('https://unstop.com/o/1', true);
    const fill = sendMessage.getMockImplementation()!;
    sendMessage.mockImplementation(async (tab: number, message: any) => {
      const reply = await fill(tab, message);
      if (message.type === 'FILL_REQUEST') {
        reply.verify.mismatches = [{ field: fields[0], expected: 'x', actual: '', status: 'rejected' }];
      }
      return reply;
    });
    const result = await fillActivePage(profile);
    expect(result.filled).toEqual([]);
    expect(result.skipped.map((f) => f.name)).toEqual(['essay', 'email']);
  });

  it('never fills an open question on its own, even if the model sent a value for it', async () => {
    openTab('https://boards.greenhouse.io/acme/jobs/1', true);
    vi.spyOn(fillApi, 'mapFields').mockResolvedValue({
      mappings: [
        { field_id: 'essay', action: 'fill', value: 'Written by the model', is_open_question: true, is_flagged: false },
      ],
    } as any);
    const result = await fillActivePage(profile);
    vi.restoreAllMocks();
    expect(result.filled.map((f) => f.name)).toEqual(['email']);
    expect(result.openQuestions?.map((f) => f.name)).toEqual(['essay']);
  });

  it('ignores a model answer for a field it was not asked about', async () => {
    openTab('https://boards.greenhouse.io/acme/jobs/1', true);
    vi.spyOn(fillApi, 'mapFields').mockResolvedValue({
      mappings: [{ field_id: 'email', action: 'fill', value: 'attacker@example.test', is_flagged: false }],
    } as any);
    const result = await fillActivePage(profile);
    vi.restoreAllMocks();
    expect(result.filled).toEqual([{ name: 'email', value: 'asha@example.test' }]);
  });

  it('refuses LinkedIn and Naukri without touching the page', async () => {
    openTab('https://www.linkedin.com/jobs/view/1', true);
    await expect(fillActivePage(profile)).rejects.toThrow(/LinkedIn or Naukri/);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('says to click the toolbar icon when Chrome refuses access', async () => {
    openTab(undefined, false);
    executeScript.mockRejectedValue(new Error('Cannot access contents of the page'));
    await expect(fillActivePage(profile)).rejects.toThrow(/toolbar/);
  });
});
