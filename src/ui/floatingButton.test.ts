import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFloatingButton } from './floatingButton';

describe('floatingButton UI', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should create the floating button with compact top-positioned styles', () => {
    const onClick = vi.fn();
    const btn = createFloatingButton(onClick);
    document.body.appendChild(btn);

    expect(btn.id).toBe('talishar-log-export-btn');
    expect(btn.style.position).toBe('fixed');
    expect(btn.style.top).toBe('12px');
    expect(btn.style.right).toBe('20px');
    expect(btn.textContent).toContain('Salvar Partida & Notas');

    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should return existing button if already in document', () => {
    const onClick = vi.fn();
    const first = createFloatingButton(onClick);
    document.body.appendChild(first);

    const second = createFloatingButton(onClick);
    expect(second).toBe(first);
  });
});
