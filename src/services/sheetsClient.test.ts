import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendMatchToSheets, testSheetsConnection } from './sheetsClient';
import type { MatchRecord } from '../types/match';

describe('SheetsClient', () => {
  const sampleMatch: MatchRecord = {
    id: 'match-001',
    timestamp: '2026-09-09T22:00:00.000Z',
    player: { name: 'Renan', hero: 'Kayo', avgTurnValue: 15.0 },
    opponent: { name: 'Opp', hero: 'Dori', avgTurnValue: 10.0 },
    result: 'win',
    turnsCount: 5,
    sideboardCards: ['Pummel'],
    notes: 'Great match',
    rawLogs: ['Log line 1'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return error if webhook URL is not configured', async () => {
    const result = await sendMatchToSheets(sampleMatch, '');
    expect(result.success).toBe(false);
    expect(result.error).toContain('URL do Webhook não configurada');
  });

  it('should successfully post match record to webhook URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'success', rowNumber: 15 }),
    });
    global.fetch = mockFetch;

    const result = await sendMatchToSheets(sampleMatch, 'https://script.google.com/macros/s/xyz/exec');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://script.google.com/macros/s/xyz/exec');
    expect(options.method).toBe('POST');
    const parsedBody = JSON.parse(options.body);
    expect(parsedBody.id).toBe('match-001');
    expect(parsedBody.player.hero).toBe('Kayo');
    expect(result.success).toBe(true);
    expect(result.rowNumber).toBe(15);
  });

  it('should test connection successfully with PING', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'success', message: 'Conectado!' }),
    });
    global.fetch = mockFetch;

    const result = await testSheetsConnection('https://script.google.com/macros/s/xyz/exec');
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe('PING');
  });

  it('should handle fetch rejection gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const result = await sendMatchToSheets(sampleMatch, 'https://script.google.com/macros/s/xyz/exec');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network offline');
  });
});
