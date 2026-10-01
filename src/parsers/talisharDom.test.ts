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
  parseMaxDamageTurn,
  parseFatigue,
  findExcludeLastTurnCheckbox,
  findSwitchPlayerStatsButton,
  autoCaptureEndGameStats,
  extractPlayerHand,
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
    expect(logs[0]).toBe('--- Turn 1 ---');
    expect(logs[1]).toContain('akiles185 pitched Wild Ride');
    expect(logs[2]).toContain('[Chain Link 1] akiles185 played Savage Feast (r) for 6');
    expect(logs[3]).toContain('NateFrautschy defended with Ironrot Gauntlet for 1');
    expect(logs[4]).toBe('--- Turn 2 ---');
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
      '--- Turn 1 - akiles185 ---',
      'The combat chain was closed.',
      '--- Turn 2 - NateFrautschy ---',
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
    expect(logs[0]).toContain('Savage Feast (r)');
    expect(logs[1]).toContain('Sink Below (y)');
    expect(logs[2]).toContain('Sigil of Solace (b)');
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

  it('should accurately calculate max damage turn from logs with took, deals, and lost life', () => {
    const logs = [
      'Turn 1 - akiles185',
      'akiles185 played Savage Feast',
      'RivalEnemy took 4 damage',
      'Turn 2 - RivalEnemy',
      'RivalEnemy attacked with Dawnblade',
      'akiles185 took 3 damage',
      'Turn 3 - akiles185',
      'akiles185 attacked with Cast Bones',
      'RivalEnemy took 9 damage',
      'RivalEnemy lost 2 life',
      'Turn 4 - RivalEnemy',
      'RivalEnemy deals 6 damage',
    ];

    const stats = parseMaxDamageTurn(logs, 'Renan', 'RivalEnemy', 'akiles185', 'RivalEnemy');
    // On Turn 3, akiles185 dealt 9 + 2 = 11 damage
    expect(stats.playerMaxDamage).toBe(11);
    expect(stats.playerMaxDamageTurn).toBe(3);
    // On Turn 4, RivalEnemy dealt 6 damage
    expect(stats.opponentMaxDamage).toBe(6);
    expect(stats.opponentMaxDamageTurn).toBe(4);
  });

  it('should parse fatigue from pOneDeck and pTwoDeck elements', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="GridBoard_pOneDeck__123">
        <div class="DeckZone_deckZone__abc">
          <div class="CountersOverlay_number__xyz">
            <div class="CountersOverlay_text__111">24</div>
          </div>
        </div>
      </div>
      <div class="GridBoard_pTwoDeck__456">
        <div class="DeckZone_deckZone__abc">
          <div class="CountersOverlay_number__xyz">
            <div class="CountersOverlay_text__111">18</div>
          </div>
        </div>
      </div>
    `;

    const fatigue = parseFatigue(doc);
    expect(fatigue.playerFatigue).toBe(24);
    expect(fatigue.opponentFatigue).toBe(18);
  });

  it('should parse equipment from desktop GridBoard pOne and pTwo zones', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="GridBoard_pOneHead__1"><img src="/cards/crown_of_providence.webp" alt="Crown of Providence" /></div>
      <div class="GridBoard_pOneChest__2"><img src="/cards/fyendals_spring_tunic.webp" alt="Fyendal's Spring Tunic" /></div>
      <div class="GridBoard_pOneHands__3"><img src="/cards/goliath_gauntlet.webp" alt="Goliath Gauntlet" /></div>
      <div class="GridBoard_pOneLegs__4"><img src="/cards/scabfall_skin.webp" alt="Scabfall Skin" /></div>
      <div class="GridBoard_pOneWeaponLZone__5"><img src="/cards/mandible_claw.webp" alt="Mandible Claw" /></div>
      <div class="GridBoard_pTwoHead__1"><img src="/cards/ironrot_helm.webp" alt="Ironrot Helm" /></div>
      <div class="GridBoard_pTwoChest__2"><img src="/cards/courage_of_bladehold.webp" alt="Courage of Bladehold" /></div>
    `;

    const equip = parseEquipment(doc);
    expect(equip.playerEquipment).toContain('Crown of Providence');
    expect(equip.playerEquipment).toContain("Fyendal's Spring Tunic");
    expect(equip.playerEquipment).toContain('Goliath Gauntlet');
    expect(equip.playerEquipment).toContain('Scabfall Skin');
    expect(equip.playerEquipment).toContain('Mandible Claw');
    expect(equip.opponentEquipment).toContain('Ironrot Helm');
    expect(equip.opponentEquipment).toContain('Courage of Bladehold');
  });

  it('should find exclude last turn checkbox by class or label', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="statsModal">
        <label>
          <input type="checkbox" class="_excludeLastTurnCheckbox_bg0d3_1028" />
          Exclude Last Turn
        </label>
      </div>
    `;

    const cb = findExcludeLastTurnCheckbox(doc);
    expect(cb).not.toBeNull();
    expect(cb?.className).toContain('_excludeLastTurnCheckbox_bg0d3_1028');
  });

  it('should find switch player stats button by class, text or svg path', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <button class="_buttonDiv_17sv7_12">
        <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" aria-hidden="true" class="_icon_17sv7_55" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 168v-16c0-13.255 10.745-24 24-24h360V80c0-21.367 25.899-32.042 40.971-16.971l80 80c9.372 9.373 9.372 24.569 0 33.941l-80 80C409.956 271.982 384 261.456 384 240v-48H24c-13.255 0-24-10.745-24-24zm488 152H128v-48c0-21.314-25.862-32.08-40.971-16.971l-80 80c-9.372 9.373-9.372 24.569 0 33.941l80 80C102.057 463.997 128 453.437 128 432v-48h360c13.255 0 24-10.745 24-24v-16c0-13.255-10.745-24-24-24z"></path>
        </svg>
        Switch Player Stats
      </button>
    `;

    const btn = findSwitchPlayerStatsButton(doc);
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toContain('Switch Player Stats');
  });

  it('should auto-capture end game stats: check exclude last turn, switch to opponent, and switch back to player view', async () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="statsModal">
        <input type="checkbox" class="_excludeLastTurnCheckbox_bg0d3_1028" />
        <button class="_buttonDiv_17sv7_12">
          <svg><path d="M0 168v-16c0-13.255 10.745-24 24-24h360V80..."></path></svg>
          Switch Player Stats
        </button>
        <div class="_infoRow_1fs3u_100">
          <span class="_infoLabel_1fs3u_120">Avg Value per Turn</span>
          <span class="_infoValue_1fs3u_152" id="val">13.5</span>
        </div>
      </div>
    `;

    const cb = doc.querySelector<HTMLInputElement>('._excludeLastTurnCheckbox_bg0d3_1028')!;
    const btn = doc.querySelector<HTMLButtonElement>('._buttonDiv_17sv7_12')!;
    const valEl = doc.querySelector('#val')!;

    let isOpponent = false;
    cb.addEventListener('click', () => {
      cb.checked = true;
      valEl.textContent = isOpponent ? '10.5' : '15.2';
    });

    let switchClicks = 0;
    btn.addEventListener('click', () => {
      switchClicks++;
      isOpponent = !isOpponent;
      valEl.textContent = isOpponent ? '10.5' : '15.2';
    });

    const result = await autoCaptureEndGameStats(doc, { waitMs: 1 });

    expect(cb.checked).toBe(true);
    expect(result.playerAvgTurnValue).toBe(15.2);
    expect(result.opponentAvgTurnValue).toBe(10.5);
    // Button must be toggled twice so user stays on player view
    expect(switchClicks).toBe(2);
    expect(isOpponent).toBe(false);
  });

  it('should extract cards in player hand ignoring equipment hand slots', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="_pOneHands_1ksvz_321">
        <img alt="Goliath Gauntlet" />
      </div>
      <div class="_handZone_999">
        <img alt="Pummel (1)" />
        <img alt="Command and Conquer (2)" />
        <img alt="Sink Below (3)" />
      </div>
    `;

    const hand = extractPlayerHand(doc);
    expect(hand).toEqual([
      'Pummel (r)',
      'Command and Conquer (y)',
      'Sink Below (b)',
    ]);
  });

  it('should ignore Avg Resources per Turn and only extract Avg Value per Turn', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="_infoRow_1fs3u_100">
        <span class="_infoLabel_1fs3u_120">Avg Resources per Turn</span>
        <span class="_infoValue_1fs3u_152">0.33</span>
      </div>
      <div class="_infoRow_1fs3u_100">
        <span class="_infoLabel_1fs3u_120">Avg Value per Turn</span>
        <span class="_infoValue_1fs3u_152">14.8</span>
      </div>
    `;

    const stats = parseAverageTurnValues(doc);
    expect(stats.playerAvgTurnValue).toBe(14.8);
    expect(stats.playerAvgTurnValue).not.toBe(0.33);
  });

  it('should find excludeLastTurn checkbox with dynamic hash classes like _excludeLastTurnCheckbox_10oml_951', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <input type="checkbox" class="_excludeLastTurnCheckbox_10oml_951" />
    `;

    const cb = findExcludeLastTurnCheckbox(doc);
    expect(cb).not.toBeNull();
    expect(cb?.className).toBe('_excludeLastTurnCheckbox_10oml_951');
  });

  it('should filter out known equipment if present in extractPlayerHand', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="_handContainer_abc">
        <img alt="Raydn Duskbane" />
        <img alt="Circlet Of Eternal End" />
        <img alt="Snatch (1)" />
        <img alt="Fyendals Spring Tunic" />
        <img alt="Sink Below (3)" />
      </div>
    `;

    const hand = extractPlayerHand(doc, [
      'Raydn Duskbane',
      'Circlet Of Eternal End',
      'Fyendals Spring Tunic',
    ]);
    expect(hand).toEqual(['Snatch (r)', 'Sink Below (b)']);
  });
});

