import { describe, it, expect } from 'vitest';
import {
  parsePlayerNames,
  parseHeroNames,
  parseCombatLogs,
  parseAverageTurnValues,
  parseMatchResult,
  parseTurnCount,
  extractMatchRecordFromDom,
  parseWentFirst,
  parseEquipment,
} from './talisharDom';

describe('talisharDom parser', () => {
  it('should parse player and opponent names from playerName components', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="RightColumn_rightColumn__abc">
        <div class="PlayerName_playerName__123">
          <div class="PlayerName_nameContainer__456">
            <div class="PlayerName_nameContent__789">RivalMaster</div>
          </div>
        </div>
      </div>
      <div class="PlayerBoardGrid_playerBoard__xyz">
        <div class="PlayerName_playerName__123 PlayerName_playerTwo__999">
          <div class="PlayerName_nameContainer__456">
            <div class="PlayerName_nameContent__789">RenanFAB</div>
          </div>
        </div>
      </div>
    `;

    const names = parsePlayerNames(doc);
    expect(names.player).toBe('RenanFAB');
    expect(names.opponent).toBe('RivalMaster');
  });

  it('should parse hero names from heroZone or card images', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="OpponentBoardGrid">
        <div class="HeroZone_heroZone__abc">
          <img alt="Dorinthea Ironsong" title="Dorinthea Ironsong" src="/cards/dori.png" />
        </div>
      </div>
      <div class="PlayerBoardGrid">
        <div class="HeroZone_heroZone__abc">
          <img alt="Kayo, Armed and Dangerous" title="Kayo, Armed and Dangerous" src="/cards/kayo.png" />
        </div>
      </div>
    `;

    const heroes = parseHeroNames(doc);
    expect(heroes.playerHero).toBe('Kayo, Armed and Dangerous');
    expect(heroes.opponentHero).toBe('Dorinthea Ironsong');
  });

  it('should extract combat logs including nested cards played, blocks, and pitches', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="ChatBox_chatBox__xyz">
        <div class="chatContent">
          <div class="ChatBox_turnDivider__111">Turn 1</div>
          <div class="ChatBox_chatMessage__222">
            <b>akiles185</b> pitched <span class="card">Wild Ride</span>
          </div>
          <div class="ChatBox_chatMessage__333">
            <b>akiles185</b> played <span class="card">Savage Feast (1)</span> for 6
          </div>
          <div class="ChatBox_chatMessage__444">
            <b>NateFrautschy</b> defended with <span class="card">Ironrot Gauntlet</span> for 1
          </div>
          <div class="ChatBox_turnDivider__111">Turn 2</div>
          <div class="ChatBox_chatMessage__555">
            <b>NateFrautschy</b> played <span class="card">Dawnblade</span>
          </div>
        </div>
      </div>
    `;

    const logs = parseCombatLogs(doc);
    expect(logs).toHaveLength(6);
    expect(logs[0]).toBe('Turn 1');
    expect(logs[1]).toContain('akiles185 pitched Wild Ride');
    expect(logs[2]).toContain('akiles185 played Savage Feast (1 - Vermelha) for 6');
    expect(logs[3]).toContain('NateFrautschy defended with Ironrot Gauntlet for 1');
    expect(logs[4]).toBe('Turn 2');
    expect(logs[5]).toContain('NateFrautschy played Dawnblade');
  });

  it('should format turnDivider with label and player spans and retain repeated events across turns', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="ChatBox_chatBox__xyz">
        <div class="ChatBox_turnDivider__111">
          <span class="ChatBox_turnDividerLabel__222">Turn 1</span>
          <span class="ChatBox_turnDividerPlayer__333">akiles185</span>
        </div>
        <div class="ChatBox_chatMessage__444">
          The combat chain was closed.
        </div>
        <div class="ChatBox_turnDivider__111">
          <span class="ChatBox_turnDividerLabel__222">Turn 2</span>
          <span class="ChatBox_turnDividerPlayer__333">NateFrautschy</span>
        </div>
        <div class="ChatBox_chatMessage__444">
          The combat chain was closed.
        </div>
      </div>
    `;

    const logs = parseCombatLogs(doc);
    expect(logs).toEqual([
      'Turn 1 - akiles185',
      'The combat chain was closed.',
      'Turn 2 - NateFrautschy',
      'The combat chain was closed.',
    ]);
  });

  it('should extract Average Turn Value and End Game Result', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="EndGameStats_statsContainer__123">
        <div class="EndGameStats_outcomeVictory__456">
          Victory
        </div>
        <div class="EndGameStats_infoBox__789">
          <div class="EndGameStats_infoRow__aaa">
            <span class="EndGameStats_infoLabel__bbb">Avg Value per Turn</span>
            <span class="EndGameStats_infoValue__ccc">14.8</span>
          </div>
          <div class="EndGameStats_infoRow__aaa">
            <span class="EndGameStats_infoLabel__bbb">Avg Damage Threatened per Turn</span>
            <span class="EndGameStats_infoValue__ccc">12.0</span>
          </div>
        </div>
        <div class="opponentStats">
          <div class="EndGameStats_infoRow__aaa">
            <span class="EndGameStats_infoLabel__bbb">Opponent Avg Value per Turn</span>
            <span class="EndGameStats_infoValue__ccc">11.4</span>
          </div>
        </div>
      </div>
    `;

    const result = parseMatchResult(doc);
    expect(result).toBe('win');

    const avgValues = parseAverageTurnValues(doc);
    expect(avgValues.playerAvgTurnValue).toBe(14.8);
    expect(avgValues.opponentAvgTurnValue).toBe(11.4);
  });

  it('should determine turn count from log dividers', () => {
    const logs = [
      'Turn 1',
      'Action A',
      'Turn 2',
      'Action B',
      'Turn 3',
      'Action C',
      'Turn 4',
    ];
    const turns = parseTurnCount(document, logs);
    expect(turns).toBe(4);
  });

  it('should consolidate a partial match record from DOM', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="PlayerBoardGrid">
        <div class="PlayerName_playerName__123 PlayerName_playerTwo__999">
          <div class="PlayerName_nameContent__789">Renan</div>
        </div>
        <div class="HeroZone_heroZone__abc">
          <img alt="Kayo" />
        </div>
      </div>
      <div class="OpponentBoardGrid">
        <div class="PlayerName_playerName__123">
          <div class="PlayerName_nameContent__789">Opponent</div>
        </div>
        <div class="HeroZone_heroZone__abc">
          <img alt="Dorinthea" />
        </div>
      </div>
      <div class="EndGameStats_outcomeVictory__123">Victory</div>
      <div class="EndGameStats_infoRow__aaa">
        <span class="EndGameStats_infoLabel__bbb">Avg Value per Turn</span>
        <span class="EndGameStats_infoValue__ccc">13.5</span>
      </div>
    `;

    const record = extractMatchRecordFromDom(doc);
    expect(record.player?.name).toBe('Renan');
    expect(record.player?.hero).toBe('Kayo');
    expect(record.opponent?.name).toBe('Opponent');
    expect(record.opponent?.hero).toBe('Dorinthea');
    expect(record.result).toBe('win');
    expect(record.player?.avgTurnValue).toBe(13.5);
    expect(record.format).toBe('CC');
    expect(record.platform).toBe('Talishar');
  });

  it('should parse whether the player went first from logs', () => {
    const logsPlayerFirst = ['Turn 1 - Renan', 'Turn 1 - Opponent', 'Turn 2 - Renan'];
    expect(parseWentFirst(logsPlayerFirst, 'Renan', 'Opponent')).toBe(true);

    const logsOpponentFirst = ['Turn 1 - Opponent', 'Turn 1 - Renan', 'Turn 2 - Opponent'];
    expect(parseWentFirst(logsOpponentFirst, 'Renan', 'Opponent')).toBe(false);

    expect(parseWentFirst([], 'Renan', 'Opponent')).toBeUndefined();
  });

  it('should parse opponent average turn value when opponent tab is active with hashed CSS classes', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="tabs">
        <button class="tab selected active">OpponentPlayer</button>
      </div>
      <div class="_infoRow_1fs3u_100">
        <span class="_infoLabel_1fs3u_120">Avg Value per Turn</span>
        <span class="_infoValue_1fs3u_152">11.33</span>
      </div>
    `;

    const avg = parseAverageTurnValues(doc, 'OpponentPlayer', 'Renan');
    expect(avg.opponentAvgTurnValue).toBe(11.33);
  });

  it('should parse equipment for player and opponent', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="PlayerBoardGrid">
        <div class="equipmentZone">
          <img title="Crown of Providence" />
          <img title="Fyendal's Spring Tunic" />
        </div>
        <div class="weaponZone">
          <img title="Mandible Claw" />
        </div>
      </div>
      <div class="OpponentBoardGrid">
        <div class="equipmentZone">
          <img title="Ironrot Gauntlet" />
        </div>
        <div class="weaponZone">
          <img title="Dawnblade" />
        </div>
      </div>
    `;

    const equip = parseEquipment(doc);
    expect(equip.playerEquipment).toContain('Crown of Providence');
    expect(equip.playerEquipment).toContain("Fyendal's Spring Tunic");
    expect(equip.playerEquipment).toContain('Mandible Claw');
    expect(equip.opponentEquipment).toContain('Ironrot Gauntlet');
    expect(equip.opponentEquipment).toContain('Dawnblade');
  });

  it('should annotate card pitch colors in combat logs', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="ChatBox_chatBox__xyz">
        <div class="ChatBox_chatMessage__1">
          <b>akiles185</b> played <span class="card">Savage Feast (1)</span> for 6
        </div>
        <div class="ChatBox_chatMessage__2">
          <b>NateFrautschy</b> defended with <span class="card pitch2">Sink Below</span>
        </div>
        <div class="ChatBox_chatMessage__3">
          <b>NateFrautschy</b> pitched <span class="card pitch3">Sigil of Solace</span>
        </div>
      </div>
    `;

    const logs = parseCombatLogs(doc);
    expect(logs[0]).toContain('Savage Feast (1 - Vermelha)');
    expect(logs[1]).toContain('Sink Below (Amarela)');
    expect(logs[2]).toContain('Sigil of Solace (Azul)');
  });

  it('should recognize opponent average turn value when different from known player average', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="_infoRow_1fs3u_100">
        <span class="_infoLabel_1fs3u_120">Avg Value per Turn</span>
        <span class="_infoValue_1fs3u_152">11.33</span>
      </div>
    `;

    const avg = parseAverageTurnValues(doc, undefined, undefined, 14.8);
    expect(avg.opponentAvgTurnValue).toBe(11.33);
  });

  it('should detect win when opponent concedes in combat logs', () => {
    const doc = document.implementation.createHTMLDocument();
    const logs = [
      'Turn 3 - Renan',
      'Renan played Command and Conquer for 6',
      'RivalPlayer has conceded the game',
    ];

    const result = parseMatchResult(doc, logs, 'Renan', 'RivalPlayer');
    expect(result).toBe('win');
  });

  it('should detect loss when player concedes in combat logs', () => {
    const doc = document.implementation.createHTMLDocument();
    const logs = [
      'Turn 4 - RivalPlayer',
      'RivalPlayer played Red in the Ledger',
      'Renan conceded the match',
    ];

    const result = parseMatchResult(doc, logs, 'Renan', 'RivalPlayer');
    expect(result).toBe('loss');
  });

  it('should detect win when player has won the game is announced in combat logs', () => {
    const doc = document.implementation.createHTMLDocument();
    const logs = [
      'Turn 5 - Renan',
      'Renan has won the game!',
    ];

    const result = parseMatchResult(doc, logs, 'Renan', 'RivalPlayer');
    expect(result).toBe('win');
  });
});

