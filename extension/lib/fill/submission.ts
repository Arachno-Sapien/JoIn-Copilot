import { ApplicationSubmittedMessage } from '../messaging';

export interface SubmissionContext {
  jobId?: string;
  url?: string;
  /** For unknown sites: report only pages where Job Copilot filled a field, so searches and logins are ignored. */
  onlyFilled?: boolean;
}

/**
 * Reads all current answers present in a form element at this moment.
 */
export function extractCurrentAnswers(form: Element): Record<string, any> {
  const answers: Record<string, any> = {};
  const controls = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input, textarea, select'
  );

  controls.forEach((control) => {
    const key = control.name || control.id;
    if (!key) return;

    const type = (control.getAttribute('type') || control.tagName.toLowerCase()).toLowerCase();
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset' || type === 'password') {
      return;
    }

    if (control instanceof HTMLInputElement && control.type === 'file') {
      if (control.files && control.files.length > 0) {
        answers[key] = control.files[0].name;
      }
    } else if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) {
      if (control.checked) {
        answers[key] = control.value || true;
      }
    } else {
      answers[key] = control.value;
    }
  });

  return answers;
}

const CONFIRMATION_PATTERNS = [
  /thank you for applying/i,
  /application received/i,
  /thank you for your application/i,
  /application submitted/i,
  /your application has been submitted/i,
];

/**
 * Sets up listeners for form submission events, user clicks on submit controls,
 * and confirmation page mutations.
 * Never performs or triggers any submission.
 */
export function setupSubmissionDetector(
  root: Element | Document,
  callback: (payload: ApplicationSubmittedMessage) => void,
  context: SubmissionContext = {}
): () => void {
  let hasTriggered = false;

  const trigger = (targetForm?: Element) => {
    if (hasTriggered) return;
    if (context.onlyFilled && !document.documentElement.hasAttribute('data-jc-filled-page')) return;
    hasTriggered = true;

    const formElement = targetForm || (root instanceof Element ? root : document.querySelector('form') || document.body);
    const answers = extractCurrentAnswers(formElement);

    const payload: ApplicationSubmittedMessage = {
      type: 'APPLICATION_SUBMITTED',
      jobId: context.jobId || 'unknown-job',
      url: context.url || (typeof window !== 'undefined' ? window.location.href : ''),
      answers,
    };

    callback(payload);
  };

  // 1. Listen for genuine submit events on forms
  const handleSubmit = (e: Event) => {
    const form = e.target instanceof Element ? e.target : undefined;
    trigger(form);
  };
  root.addEventListener('submit', handleSubmit, true);

  // 2. Listen for user click on buttons or inputs intended for submission
  const handleClick = (e: Event) => {
    // The button itself, also when the click landed on text or an icon inside it.
    const control = (e.target as Element | null)?.closest?.(
      'button, input[type="submit"], input[type="button"], [role="button"]'
    );
    if (!control) return;

    // Only a control inside the form counts: an "Apply" button elsewhere just opens or scrolls to it.
    // A page without a <form> element counts only when Job Copilot filled it.
    const form = control.closest('form') || (context.onlyFilled ? document.body : null);
    if (!form || (root instanceof Element && !root.contains(control) && !form.contains(root))) return;

    const text = (control.textContent || (control as HTMLInputElement).value || '').toLowerCase();
    if (control.getAttribute('type') === 'submit' || text.includes('submit') || text.includes('apply')) {
      trigger(form);
    }
  };
  root.addEventListener('click', handleClick, true);

  // 3. MutationObserver for confirmation messages
  let observer: MutationObserver | null = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const addedNode of Array.from(mutation.addedNodes)) {
          if (addedNode.nodeType === Node.ELEMENT_NODE) {
            const text = (addedNode as Element).textContent || '';
            if (CONFIRMATION_PATTERNS.some((pattern) => pattern.test(text))) {
              trigger();
              return;
            }
          }
        }
      }
    });

    const targetNode = root instanceof Element ? root.ownerDocument?.body || root : root;
    observer.observe(targetNode, { childList: true, subtree: true });
  }

  // Cleanup function
  return () => {
    root.removeEventListener('submit', handleSubmit, true);
    root.removeEventListener('click', handleClick, true);
    if (observer) {
      observer.disconnect();
    }
  };
}
