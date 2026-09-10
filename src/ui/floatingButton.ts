/**
 * Creates the floating action button that appears when a match finishes.
 */
export function createFloatingButton(onClick: () => void): HTMLElement {
  const existing = document.getElementById('talishar-log-export-btn');
  if (existing) return existing;

  const button = document.createElement('button');
  button.id = 'talishar-log-export-btn';
  button.innerHTML = `<span>📝</span> <span>Salvar Partida & Notas</span>`;
  button.title = 'Abrir notas e exportar estatísticas da partida';
  button.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999990;
    display: flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #ff7043, #f4511e);
    color: white;
    border: none;
    border-radius: 50px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(244, 81, 30, 0.45);
    transition: transform 0.2s, box-shadow 0.2s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-2px) scale(1.03)';
    button.style.boxShadow = '0 6px 20px rgba(244, 81, 30, 0.6)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'none';
    button.style.boxShadow = '0 4px 16px rgba(244, 81, 30, 0.45)';
  });

  button.addEventListener('click', onClick);

  return button;
}
