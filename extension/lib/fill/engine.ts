import { FormField } from '../messaging';

/**
 * Sets native value on React or framework controlled inputs and dispatches bubbling events.
 */
export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const protoDescriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (protoDescriptor?.set) {
    protoDescriptor.set.call(el, value);
  }
  const ownDescriptor = Object.getOwnPropertyDescriptor(el, 'value');
  if (ownDescriptor?.set) {
    ownDescriptor.set.call(el, value);
  } else if (!protoDescriptor?.set) {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Traverse an element and its open shadow roots recursively to discover form fields.
 */
export function discoverFields(root: Element | Document): FormField[] {
  const fields: FormField[] = [];
  const visited = new Set<Element>();

  function walk(current: Element | DocumentFragment | Document) {
    // Check if element itself has closed shadow indicator
    if ('querySelectorAll' in current) {
      const closedHosts = current.querySelectorAll('[data-has-closed-shadow="true"]');
      closedHosts.forEach((host) => {
        const name = host.getAttribute('data-field-name') || host.id || 'closed_field';
        const label = host.getAttribute('data-field-label') || undefined;
        fields.push({
          name,
          id: host.id || undefined,
          label,
          type: 'text',
          required: false,
          manual: true,
        });
      });

      // Find form control elements
      const elements = current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input, textarea, select'
      );

      elements.forEach((el) => {
        if (visited.has(el)) return;
        visited.add(el);

        const type = (el.getAttribute('type') || el.tagName.toLowerCase()).toLowerCase();
        if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset') {
          return;
        }

        // Determine label
        let labelText = '';
        if (el.id) {
          const doc = el.ownerDocument || document;
          const labelEl = doc.querySelector(`label[for="${el.id}"]`);
          if (labelEl) labelText = labelEl.textContent?.trim() || '';
        }
        if (!labelText) {
          const parentLabel = el.closest('label');
          if (parentLabel) labelText = parentLabel.textContent?.trim() || '';
        }
        if (!labelText && el.getAttribute('aria-label')) {
          labelText = el.getAttribute('aria-label') || '';
        }
        if (!labelText && el.getAttribute('placeholder')) {
          labelText = el.getAttribute('placeholder') || '';
        }
        if (!labelText) {
          const prev = el.previousElementSibling;
          if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'P')) {
            labelText = prev.textContent?.trim() || '';
          }
        }

        const options: string[] = [];
        if (el instanceof HTMLSelectElement) {
          Array.from(el.options).forEach((opt) => {
            if (opt.text) options.push(opt.text.trim());
          });
        }

        fields.push({
          name: el.name || el.id || labelText || 'field',
          id: el.id || undefined,
          label: labelText || undefined,
          placeholder: el.getAttribute('placeholder') || undefined,
          nearbyText: labelText || undefined,
          type: el.tagName.toLowerCase() === 'textarea' ? 'textarea' : type,
          required: el.required || el.hasAttribute('aria-required'),
          options: options.length ? options : undefined,
          manual: false,
        });
      });

      // Find open shadow roots
      const allChildren = current.querySelectorAll('*');
      allChildren.forEach((child) => {
        if (child.shadowRoot) {
          walk(child.shadowRoot);
        }
      });
    }
  }

  walk(root);
  return fields;
}

function escapeCss(str: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(str);
  }
  return str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

/**
 * Finds the corresponding DOM element for a FormField.
 */
export function findElementForField(root: Element | Document, field: FormField): HTMLElement | null {
  const doc = 'ownerDocument' in root && root.ownerDocument ? root.ownerDocument : document;

  // Search in root and open shadow roots recursively
  function search(current: Element | DocumentFragment | Document): HTMLElement | null {
    if (field.id) {
      const byId = current.querySelector<HTMLElement>(`#${escapeCss(field.id)}`);
      if (byId) return byId;
    }
    if (field.name) {
      const byName = current.querySelector<HTMLElement>(`[name="${escapeCss(field.name)}"]`);
      if (byName) return byName;
    }
    if (field.label) {
      const inputs = current.querySelectorAll<HTMLElement>('input, textarea, select');
      for (const input of Array.from(inputs)) {
        if (input.id) {
          const l = doc.querySelector(`label[for="${input.id}"]`);
          if (l && l.textContent && l.textContent.toLowerCase().includes(field.label.toLowerCase())) {
            return input;
          }
        }
        const pLabel = input.closest('label');
        if (pLabel && pLabel.textContent && pLabel.textContent.toLowerCase().includes(field.label.toLowerCase())) {
          return input;
        }
        const aria = input.getAttribute('aria-label');
        if (aria && aria.toLowerCase().includes(field.label.toLowerCase())) {
          return input;
        }
      }
    }

    const allChildren = current.querySelectorAll('*');
    for (const child of Array.from(allChildren)) {
      if (child.shadowRoot) {
        const found = search(child.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }

  return search(root);
}

/**
 * Highlights a filled field visually with a subtle outline.
 */
export function highlightField(element: HTMLElement): void {
  element.setAttribute('data-jc-filled', 'true');
  element.style.outline = '2px solid #22c55e';
  element.style.outlineOffset = '1px';
}

/**
 * Fills a FormField with a given string or File.
 */
export async function fillFieldWithEngine(field: FormField, value: string | File, root: Element | Document = document): Promise<boolean> {
  if (field.manual) {
    return false;
  }

  const el = findElementForField(root, field);
  if (!el) {
    return false;
  }

  try {
    if (el instanceof HTMLInputElement && el.type === 'file') {
      const file = value instanceof File ? value : new File([value], 'resume.pdf', { type: 'application/pdf' });
      let assigned = false;
      try {
        if (typeof DataTransfer !== 'undefined') {
          const dt = new DataTransfer();
          dt.items.add(file);
          el.files = dt.files;
          assigned = true;
        }
      } catch {
        // Fallback for environments where DataTransfer is restricted
      }

      if (!assigned) {
        // Define files property directly if setter failed (e.g. in JSDOM)
        const fileList = Object.create(FileList.prototype, {
          0: { value: file, enumerable: true },
          length: { value: 1, enumerable: true },
          item: { value: (index: number) => (index === 0 ? file : null), enumerable: true },
        });
        Object.defineProperty(el, 'files', {
          value: fileList,
          configurable: true,
          writable: true,
        });
      }

      el.dispatchEvent(new Event('change', { bubbles: true }));
      highlightField(el);
      return true;
    }

    if (el instanceof HTMLSelectElement) {
      const stringVal = String(value);
      el.value = stringVal;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      highlightField(el);
      return true;
    }

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const stringVal = String(value);
      setNativeValue(el, stringVal);
      highlightField(el);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
