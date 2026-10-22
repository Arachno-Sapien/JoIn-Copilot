import { ApplicationSubmittedMessage } from '../messaging';

export interface SubmissionContext {
  jobId?: string;
  url?: string;
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
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset') {
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
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const isSubmitType = target.getAttribute('type') === 'submit';
    const text = (target.textContent || (target as HTMLInputElement).value || '').toLowerCase();
    const isSubmitButton = target.tagName === 'BUTTON' || target.tagName === 'INPUT';
    const hasSubmitText = text.includes('submit') || text.includes('apply');

    if (isSubmitType || (isSubmitButton && hasSubmitText)) {
      const form = target.closest('form') || (root instanceof Element ? root : undefined);
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
