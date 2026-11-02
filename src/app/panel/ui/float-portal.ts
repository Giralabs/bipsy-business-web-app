/**
 * Moves a floating layer (a menu, a calendar) out to the root of the panel.
 *
 * It is drawn `position: fixed` against the window, but inside a dialog that
 * is not what it gets: the dialog's entrance animation keeps a `transform` on
 * it, which makes the dialog the box that `fixed` is measured from, and the
 * dialog clips its overflow — so the layer came out shifted and cut off, or
 * not at all. Hanging it from `.pn` (where the panel's colour tokens live)
 * puts it back on the window.
 *
 * Angular removes a node with `node.remove()`, wherever it is, so the moved
 * node still goes away when its `@if` turns false, and its bindings and
 * listeners keep working.
 */
export function toPanelRoot(layer: HTMLElement, host: HTMLElement): void {
  const root = host.closest<HTMLElement>('.pn') ?? document.body;
  if (layer.parentElement !== root) root.appendChild(layer);
}
