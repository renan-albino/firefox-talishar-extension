import { describe, it, expect } from 'vitest';
import type { MatchRecord } from './match';

describe('MatchRecord Domain Type', () => {
  it('should instantiate a valid MatchRecord shape', () => {
    const mockMatch: MatchRecord = {
      id: 'match-123',
      timestamp: new Date().toISOString(),
      player: {
        name: 'Renan',
        hero: 'Kayo, Armed and Dangerous',
        avgTurnValue: 14.5,
      },
      opponent: {
        name: 'Opponent1',
        hero: 'Dorinthea Ironsong',
        avgTurnValue: 12.0,
      },
      result: 'win',
      turnsCount: 6,
      sideboardCards: ['Pummel (Red)', 'Cast Bones'],
      notes: 'Good match, prioritized tempo and maintained pressure.',
      rawLogs: ['Turn 1: Renan played Wild Ride...', 'Turn 2: Opponent pitched...'],
    };

    expect(mockMatch.id).toBe('match-123');
    expect(mockMatch.result).toBe('win');
    expect(mockMatch.player.avgTurnValue).toBe(14.5);
    expect(mockMatch.sideboardCards).toHaveLength(2);
  });
});
