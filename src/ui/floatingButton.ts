/**
 * Creates the floating action button that appears when a match finishes.
 */
export function createFloatingButton(onClick: () => void): HTMLElement {
  const existing = document.getElementById('talishar-log-export-btn');
  if (existing) {
    const clickHandler = (e?: Event) => {
      e?.preventDefault();
      e?.stopPropagation();
      onClick();
    };
    existing.onclick = clickHandler;
    existing.style.setProperty('display', 'flex', 'important');
    existing.style.setProperty('visibility', 'visible', 'important');
    existing.style.setProperty('pointer-events', 'auto', 'important');
    existing.style.setProperty('opacity', '1', 'important');
    return existing;
  }

  const button = document.createElement('button');
  button.id = 'talishar-log-export-btn';
  button.innerHTML = `<span style="font-size: 13px; line-height: 1;">📝</span> <span>Salvar Partida & Notas</span>`;
  button.title = 'Abrir notas e exportar estatísticas da partida';

  // React portal signature so Talishar useAdScript passes isReactPortalEl()
  (button as any).__reactFiber$talishar = true;
  (button as any).__reactProps$talishar = true;
  try {
    if ((button as any).wrappedJSObject) {
      (button as any).wrappedJSObject.__reactFiber$talishar = true;
      (button as any).wrappedJSObject.__reactProps$talishar = true;
    }
  } catch {}

  button.style.cssText = `
    position: fixed;
    top: 12px;
    right: 20px;
    left: auto !important;
    width: auto !important;
    max-width: fit-content;
    z-index: 2147483647 !important;
    display: flex !important;
    visibility: visible !important;
    pointer-events: auto !important;
    opacity: 1 !important;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #ff7043, #f4511e);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 20px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    user-select: none;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-1px) scale(1.02)';
    button.style.boxShadow = '0 5px 14px rgba(244, 81, 30, 0.55)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'none';
    button.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.4)';
  });

  const clickHandler = (e?: Event) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onClick();
  };

  button.onclick = clickHandler;

  // Guard against any external scripts attempting to hide or disable the button
  if (typeof MutationObserver !== 'undefined') {
    const guard = new MutationObserver(() => {
      if (button.style.visibility === 'hidden') button.style.setProperty('visibility', 'visible', 'important');
      if (button.style.pointerEvents === 'none') button.style.setProperty('pointer-events', 'auto', 'important');
    });
    guard.observe(button, { attributes: true, attributeFilter: ['style'] });
  }

  return button;
}
