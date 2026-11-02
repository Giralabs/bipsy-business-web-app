export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * The system sheet where the browser has one, otherwise the clipboard
 * (`core/share_sheet.dart`). Whoever calls says what happened: closing the sheet
 * is not an error, and a failure must not be swallowed.
 */
export async function shareOrCopy(text: string, subject: string): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: subject, text });
      return 'shared';
    } catch (cause) {
      if ((cause as DOMException).name === 'AbortError') return 'cancelled';
      // Refused by the browser: copying still gets the message out.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
