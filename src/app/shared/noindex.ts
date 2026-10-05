import { DestroyRef, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';

/** How many live components are asking for it: the tag goes when the last one does. */
let holders = 0;

/**
 * Keeps search engines away from the page for as long as the calling component
 * is alive. For the screens that are not content: not found, errors,
 * maintenance and the team's door.
 *
 * Call it from a constructor (it needs an injection context).
 */
export function noindex(): void {
  const meta = inject(Meta);
  if (holders++ === 0) meta.updateTag({ name: 'robots', content: 'noindex' });
  inject(DestroyRef).onDestroy(() => {
    if (--holders === 0) meta.removeTag('name="robots"');
  });
}
