/**
 * Creates the floating action button that appears when a match finishes.
 */
export function createFloatingButton(onClick: () => void): HTMLElement {
  const existing = document.getElementById('talishar-log-export-btn');
  if (existing) return existing;

  const button = document.createElement('button');
  button.id = 'talishar-log-export-btn';
  button.innerHTML = `<span style="font-size: 13px; line-height: 1;">📝</span> <span>Salvar Partida & Notas</span>`;
  button.title = 'Abrir notas e exportar estatísticas da partida';
  button.style.cssText = `
    position: fixed;
    top: 12px;
    right: 20px;
    z-index: 999990;
    display: flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #ff7043, #f4511e);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 12px;
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

  button.addEventListener('click', onClick);

  return button;
}
