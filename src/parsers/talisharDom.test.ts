import { describe, it, expect } from 'vitest';
import {
  parsePlayerNames,
  parseHeroNames,
  parseCombatLogs,
  parseAverageTurnValues,
  parseMatchResult,
  parseTurnCount,
  extractMatchRecordFromDom,
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

  it('should extract combat logs from chatBox', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="ChatBox_chatBox__xyz">
        <div class="chatContent">
          <div class="TurnDivider">Turn 1</div>
          <div>Player 1 played Wild Ride</div>
          <div>Player 2 defended with 3</div>
          <div class="TurnDivider">Turn 2</div>
          <div>Player 2 played Dawnblade</div>
        </div>
      </div>
    `;

    const logs = parseCombatLogs(doc);
    expect(logs).toHaveLength(5);
    expect(logs[0]).toBe('Turn 1');
    expect(logs[1]).toBe('Player 1 played Wild Ride');
    expect(logs[4]).toBe('Player 2 played Dawnblade');
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
  });
});
