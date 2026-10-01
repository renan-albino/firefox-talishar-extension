import type { MatchRecord, MatchResult } from '../types/match';

const UTF8_BOM = '\uFEFF';
const DELIMITER = ';';

export const CSV_HEADERS = [
  'Dia',
  'Jogador',
  'Deck',
  'Match',
  'Formato',
  'Resultado',
  'Iniciou',
  'Plataforma de Jogo',
  'Adversário',
  'Observações',
  'Turnos',
  'Meu Valor Médio/Turno',
  'Valor Médio/Turno Oponente',
  'Cartas Fora/Sideboard',
];

function escapeCsvField(val: string | number | undefined | null): string {
  if (val === undefined || val === null) {
    return '""';
  }
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatDatePtBr(isoString?: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoString;
  }
}

function formatDecimalPtBr(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) {
    return '-';
  }
  // If integer or single decimal, preserve readable representation with comma
  const rounded = Number.isInteger(val) ? val.toFixed(1) : String(val);
  return rounded.replace('.', ',');
}

function translateResult(result: MatchResult): string {
  switch (result) {
    case 'win':
      return 'Vitória';
    case 'loss':
      return 'Derrota';
    case 'draw':
      return 'Empate';
    default:
      return 'Desconhecido';
  }
}

export function inferHeroesFromLogs(
  logs?: string[],
  player?: { name?: string; username?: string; hero?: string },
  opponent?: { name?: string; username?: string; hero?: string }
): { playerHero?: string; opponentHero?: string } {
  if (!logs || logs.length === 0) return {};

  const fabHeroes = [
    'Ser Boltyn, Breaker of Dawn',
    'Ser Boltyn',
    'Vynnset, Iron Maiden',
    'Vynnset',
    'Kayo, Armed and Dangerous',
    'Kayo',
    'Dorinthea Ironsong',
    'Dorinthea',
    'Bravo, Showstopper',
    'Bravo, Star of the Show',
    'Bravo',
    'Levia, Shadowborn Abomination',
    'Levia',
    'Katsu, the Wanderer',
    'Katsu',
    'Ira, Crimson Haze',
    'Rhinar, Reckless Rampage',
    'Dash, Inventor Extraordinaire',
    'Dash, Database',
    'Dash',
    'Uzuri, Switchblade',
    'Dromai, Ash Artist',
    'Fai, Rising Rebellion',
    'Prism, Sculptor of Light',
    'Prism, Awakener of Sol',
    'Chane, Bound by Shadow',
    'Briar, Warden of Thorns',
    'Oldhim, Grandfather of Eternity',
    'Lexi, Livewire',
    'Viserai, Rune Blood',
    'Azalea, Ace in the Hole',
    'Kano, Dracai of Aether',
    'Victor Goldmane',
    'Betsy, Skin in the Game',
    'Kassai of the Golden Sand',
    'Olympia, Prized Fighter',
    'Zen, Tamer of Purpose',
    'Enigma, Ledger of Ancestry',
    'Nuu, Alluring Desire',
    'Aurora, Shooting Star',
    'Florian, Rotwood Harbinger',
    'Verdance, Thorn of the Rose',
    'Cindra, Dracai of Retribution',
    'Gravy Bones, Shipwrecked Looter',
    'Jarl Vetreidi',
    'Arakni, Huntsman',
    'Riptide, Lurker of the Deep',
    'Benji, the Piercing Wind',
  ];

  const norm = (s?: string) => (s ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : '');

  let pFound = player?.hero && player.hero !== '-' ? player.hero : undefined;
  let oFound = opponent?.hero && opponent.hero !== '-' ? opponent.hero : undefined;

  const pNames = [norm(player?.name), norm(player?.username)].filter(Boolean);
  const oNames = [norm(opponent?.name), norm(opponent?.username)].filter(Boolean);

  let lastActor: 'player' | 'opponent' | undefined;

  for (let i = 0; i < logs.length; i++) {
    const line = logs[i];

    // Track active actor: "<Actor> played ...", "<Actor> activated ..."
    const actionMatch = line.match(/^([A-Za-z0-9_,\s.'-]+?)\s+(?:played|activated|attacked|attacks)/i);
    if (actionMatch) {
      const actorNorm = norm(actionMatch[1]);
      if (pNames.some((n) => actorNorm.includes(n)) || (pFound && actorNorm.includes(norm(pFound)))) {
        lastActor = 'player';
      } else if (oNames.some((n) => actorNorm.includes(n)) || (oFound && actorNorm.includes(norm(oFound)))) {
        lastActor = 'opponent';
      }
    }

    // Check target line: "🎯<TargetHero> was chosen as the target"
    const targetMatch = line.match(/🎯\s*([A-Za-z0-9_,\s.'-]+?)\s+was chosen as the target/i);
    if (targetMatch) {
      const targetCandidate = targetMatch[1].trim();
      const targetNorm = norm(targetCandidate);
      const isOpponent = oFound ? norm(oFound).includes(targetNorm) || targetNorm.includes(norm(oFound)) : false;
      const isPlayer = pFound ? norm(pFound).includes(targetNorm) || targetNorm.includes(norm(pFound)) : false;

      if (lastActor === 'player' || isPlayer) {
        if (!oFound && !isPlayer) oFound = targetCandidate;
      } else if (lastActor === 'opponent' || isOpponent) {
        if (!pFound && !isOpponent) pFound = targetCandidate;
      } else {
        if (oFound && !norm(oFound).includes(targetNorm) && !pFound) {
          pFound = targetCandidate;
        } else if (pFound && !norm(pFound).includes(targetNorm) && !oFound) {
          oFound = targetCandidate;
        }
      }
    }

    // Direct hero activations / plays
    for (const hero of fabHeroes) {
      const hNorm = norm(hero);
      if (line.includes(`activated ${hero}`) || line.includes(`${hero} played`)) {
        if (!pFound && (!oFound || !norm(oFound).includes(hNorm))) {
          pFound = hero;
        } else if (!oFound && (!pFound || !norm(pFound).includes(hNorm))) {
          oFound = hero;
        }
      }
    }
  }

  return { playerHero: pFound, opponentHero: oFound };
}

function matchToCsvRow(match: MatchRecord): string {
  let playerHero = match.player.hero;
  let opponentHero = match.opponent.hero;

  if ((!playerHero || playerHero === '-' || !opponentHero || opponentHero === '-') && match.rawLogs) {
    const inferred = inferHeroesFromLogs(match.rawLogs, match.player, match.opponent);
    if ((!playerHero || playerHero === '-') && inferred.playerHero) {
      playerHero = inferred.playerHero;
      match.player.hero = inferred.playerHero;
    }
    if ((!opponentHero || opponentHero === '-') && inferred.opponentHero) {
      opponentHero = inferred.opponentHero;
      match.opponent.hero = inferred.opponentHero;
    }
  }

  const sideboardText =
    match.sideboardCards && match.sideboardCards.length > 0
      ? match.sideboardCards.join(', ')
      : '-';

  const matchTitle = opponentHero || '-';
  const wentFirstText = match.wentFirst === undefined ? '-' : match.wentFirst ? 'Sim' : 'Não';
  const platformText = match.platform || 'Talishar';
  const opponentText = match.opponent.name || opponentHero || 'Oponente';
  const formatText = match.format || 'CC';

  const fields = [
    escapeCsvField(formatDatePtBr(match.timestamp)),
    escapeCsvField(match.player.name || 'Jogador'),
    escapeCsvField(playerHero || '-'),
    escapeCsvField(matchTitle),
    escapeCsvField(formatText),
    escapeCsvField(translateResult(match.result)),
    escapeCsvField(wentFirstText),
    escapeCsvField(platformText),
    escapeCsvField(opponentText),
    escapeCsvField(match.notes || ''),
    escapeCsvField(match.turnsCount ?? 0),
    escapeCsvField(formatDecimalPtBr(match.player.avgTurnValue)),
    escapeCsvField(formatDecimalPtBr(match.opponent.avgTurnValue)),
    escapeCsvField(sideboardText),
  ];

  return fields.join(DELIMITER);
}

/**
 * Substitui os nomes de tela dos jogadores pelos nomes dos seus respectivos heróis/personagens
 * para facilitar a leitura e análise por Inteligência Artificial (LLMs).
 */
export function replacePlayerNamesWithHeroes(
  logLines: string[],
  player?: { name?: string; username?: string; hero?: string },
  opponent?: { name?: string; username?: string; hero?: string }
): string[] {
  if (!logLines || logLines.length === 0) return [];

  const replacements: Array<{ alias: string; hero: string }> = [];

  const pHero = player?.hero?.trim();
  const oHero = opponent?.hero?.trim();

  const isGeneric = (name?: string) => {
    if (!name) return true;
    const lower = name.toLowerCase().trim();
    return (
      lower === 'jogador' ||
      lower === 'oponente' ||
      lower === '-' ||
      lower === 'player' ||
      lower === 'opponent' ||
      lower === 'setup' ||
      lower === 'game' ||
      lower === 'game over' ||
      lower === 'start' ||
      lower === 'end' ||
      lower === 'combat' ||
      lower === 'turn' ||
      lower.length < 2
    );
  };

  const addAlias = (alias: string | undefined, hero: string | undefined) => {
    if (!alias || !hero || hero === '-' || isGeneric(alias)) return;
    const cleanAlias = alias.trim();
    if (cleanAlias.toLowerCase() === hero.toLowerCase()) return;
    if (!replacements.some((r) => r.alias.toLowerCase() === cleanAlias.toLowerCase())) {
      replacements.push({ alias: cleanAlias, hero });
    }
  };

  // 1. Add direct names and usernames
  addAlias(player?.name, pHero);
  addAlias(player?.username, pHero);
  addAlias(opponent?.name, oHero);
  addAlias(opponent?.username, oHero);

  // 2. Discover in-game usernames from Turn Dividers (e.g. "Turn 1 - akiles185")
  const turnDividerUsers: string[] = [];
  for (const line of logLines) {
    const dividerMatch = line.match(/Turn\s+\d+\s*-\s*([A-Za-z0-9_\-.]+)/i);
    if (dividerMatch && dividerMatch[1]) {
      const user = dividerMatch[1].trim();
      if (!isGeneric(user) && !turnDividerUsers.includes(user)) {
        turnDividerUsers.push(user);
      }
    }
  }

  // If we found turn divider usernames, map them to player/opponent heroes
  if (turnDividerUsers.length >= 1) {
    const firstUser = turnDividerUsers[0];
    // If first user matches player or we know player went first
    if (player?.username && firstUser.toLowerCase() === player.username.toLowerCase()) {
      addAlias(firstUser, pHero);
      if (turnDividerUsers.length >= 2) addAlias(turnDividerUsers[1], oHero);
    } else if (opponent?.username && firstUser.toLowerCase() === opponent.username.toLowerCase()) {
      addAlias(firstUser, oHero);
      if (turnDividerUsers.length >= 2) addAlias(turnDividerUsers[1], pHero);
    } else {
      // First actor is player if unassigned
      addAlias(firstUser, pHero);
      if (turnDividerUsers.length >= 2) addAlias(turnDividerUsers[1], oHero);
    }
  }

  if (replacements.length === 0) return logLines;

  // Sort longest aliases first to avoid partial replacements
  replacements.sort((a, b) => b.alias.length - a.alias.length);

  return logLines.map((line) => {
    let modified = line;
    for (const { alias, hero } of replacements) {
      // Handle possessive first: e.g. "akiles185's" -> "Kayo's"
      const possessiveRegex = new RegExp(`\\b${escapeRegex(alias)}'s\\b`, 'gi');
      modified = modified.replace(possessiveRegex, `${hero}'s`);

      // Handle standard word boundary match: "akiles185" -> "Kayo"
      const boundaryStart = /^\w/.test(alias) ? '\\b' : '';
      const boundaryEnd = /\w$/.test(alias) ? '\\b' : '';
      const regex = new RegExp(`${boundaryStart}${escapeRegex(alias)}${boundaryEnd}`, 'gi');
      modified = modified.replace(regex, hero);
    }
    return modified;
  });
}

/**
 * Formats a single match into a standalone PT-BR CSV with headers and UTF-8 BOM.
 */
export function formatMatchSummaryCsv(match: MatchRecord): string {
  const headerRow = CSV_HEADERS.map((h) => `"${h}"`).join(DELIMITER);
  const dataRow = matchToCsvRow(match);
  return `${UTF8_BOM}${headerRow}\n${dataRow}\n`;
}

/**
 * Formats an array of matches into a consolidated history CSV with headers and UTF-8 BOM.
 */
export function formatMatchHistoryCsv(matches: MatchRecord[]): string {
  const headerRow = CSV_HEADERS.map((h) => `"${h}"`).join(DELIMITER);
  const dataRows = matches.map((m) => matchToCsvRow(m)).join('\n');
  return `${UTF8_BOM}${headerRow}\n${dataRows}\n`;
}

export const KNOWN_FAB_PITCHES: Record<string, 'r' | 'y' | 'b'> = {
  // Light / Warrior
  'lumina ascension': 'y',
  'spirit of eirina': 'y',
  'beacon of victory': 'y',
  'soul shield': 'y',
  'saving grace': 'y',
  'spirit of war': 'r',
  'v of the vanguard': 'y',
  'battlefield beacon': 'y',
  'bravery of the blade': 'r',
  'banneret of swordsmanship': 'y',
  'banneret of courage': 'y',
  'banneret of resilience': 'y',
  'banneret of gallantry': 'y',
  'blessing of bellona': 'y',
  'blessing of suraya': 'y',
  'blessing of aegis': 'y',
  'blessing of themis': 'y',
  'prayer of bellona': 'y',
  'duty bound blitz': 'r',
  'beaming bravado': 'y',
  'celestial cataclysm': 'y',
  'tenacity': 'y',

  // Shadow / Runeblade / Vynnset
  'enshrine sin': 'b',
  'widespread annihilation': 'r',
  'deadwood dirge': 'r',
  'deathly delight': 'r',
  'deathly wail': 'r',
  'cull': 'r',
  'widespread ruin': 'r',
  'funeral moon': 'b',
  'eloquent eulogy': 'b',
  'shadow puppetry': 'r',
  'become the shadow lord': 'b',
  'requiem for the damned': 'y',
  'succumb to temptation': 'r',
  'soul of existence': 'b',
  'deep recesses of existence': 'b',
  'fasting carcass': 'y',
  'cullingsong gloomblade': 'b',
  'runeblood barrier': 'r',
  'meat and greet': 'r',
  'marrow drain': 'r',
  'flail of agony': 'r',

  // Shadow / Brute / Levia
  'cleave the heavens': 'r',
  'engulfing shadows': 'r',
  'feasting shadowbeast': 'r',
  'dread screamer': 'r',
  'endless maw': 'r',
  'shadowrealm horror': 'r',
  'deadwood rumbler': 'r',
  'bloodrush bellow': 'y',
  'blood harvest': 'r',
  'diabolic offering': 'r',
  'pull from beyond': 'b',
  'vigorous smashup': 'b',
  'goremass summoning': 'b',
  'rockyard rodeo': 'y',
  'consuming strength': 'r',
  'corrupt and conquer': 'r',
  'fallen herald': 'y',
  'wrecker romp': 'r',
  'feeding frenzy': 'r',

  // Generic staples
  'command and conquer': 'r',
  'enlightened strike': 'r',
  'sink below': 'r',
  'fate foreseen': 'r',
  'sigil of solace': 'r',
  'pummel': 'r',
  'art of war': 'y',
  'energy potion': 'b',
  'potion of strength': 'b',
  'warmongers diplomacy': 'b',
  'that all you got': 'y',
  'give and take': 'y',
  'codex of frailty': 'y',
  'codex of bloodrot': 'y',
  'codex of inertia': 'y',
  'shake down': 'r',
  'swarming gloomveil': 'r',
  'preach': 'r',
  'oasis respite': 'r',
  'peace of mind': 'b',
  'snatch': 'r',
  'cast bones': 'r',
  'wild ride': 'r',
};

/**
 * Builds a pitch lookup map from match metadata, sideboard, and logs.
 */
export function buildKnownPitchMap(match: MatchRecord): Map<string, 'r' | 'y' | 'b'> {
  const pitchMap = new Map<string, 'r' | 'y' | 'b'>();

  // 1. Preload defaults
  for (const [card, pitch] of Object.entries(KNOWN_FAB_PITCHES)) {
    pitchMap.set(card.toLowerCase(), pitch);
  }

  // 2. Scan sideboard cards: "Card Name (r)"
  if (match.sideboardCards) {
    for (const item of match.sideboardCards) {
      const matchPitch = item.match(/^(.+?)\s*\(([ryb])\)$/i);
      if (matchPitch) {
        pitchMap.set(matchPitch[1].trim().toLowerCase(), matchPitch[2].toLowerCase() as 'r' | 'y' | 'b');
      }
    }
  }

  // 3. Scan raw logs for any card names formatted with (r), (y), (b)
  if (match.rawLogs) {
    for (const line of match.rawLogs) {
      const matches = line.matchAll(/([A-Z][a-zA-Z\s,'-]{2,30})\s*\(([ryb])\)/gi);
      for (const m of matches) {
        const cardName = m[1].trim().toLowerCase();
        const pitch = m[2].toLowerCase() as 'r' | 'y' | 'b';
        if (!pitchMap.has(cardName)) {
          pitchMap.set(cardName, pitch);
        }
      }
    }
  }

  return pitchMap;
}

/**
 * Decorates card references in a combat log line with pitch notations if known.
 */
export function decorateLineWithPitches(line: string, pitchMap: Map<string, 'r' | 'y' | 'b'>): string {
  if (
    line.startsWith('---') ||
    line.startsWith('===') ||
    line.startsWith('[Mão Comprada') ||
    line.startsWith('[Chain Link')
  ) {
    return line;
  }

  let modified = line;
  for (const [cardName, pitch] of pitchMap.entries()) {
    // Only match whole card names not already followed by (r), (y), or (b)
    const regex = new RegExp(`\\b${escapeRegex(cardName)}\\b(?!\\s*\\([ryb]\\))`, 'gi');
    if (regex.test(modified)) {
      modified = modified.replace(regex, (match) => `${match} (${pitch})`);
    }
  }
  return modified;
}

export const NON_ATTACK_CARDS = new Set([
  'lumina ascension',
  'blessing of bellona',
  'blessing of aegis',
  'blessing of suraya',
  'blessing of themis',
  'blessing of deliverance',
  'blessing of spirits',
  'prayer of bellona',
  'spirit of eirina',
  'beacon of victory',
  'enshrine sin',
  'deadwood dirge',
  'succumb to temptation',
  'funeral moon',
  'eloquent eulogy',
  'shadow puppetry',
  'pull from beyond',
  'saving grace',
  'sink below',
  'fate foreseen',
  'bloodrush bellow',
  'art of war',
  'energy potion',
  'potion of strength',
  'fyendals spring tunic',
  "fyendal's spring tunic",
  'grasp of the arknight',
  'spellbound creepers',
  'grimoire of fellingsong',
  'warband of bellona',
  'solforge gauntlet',
  'helm of halos grace',
  'circlet of eternal end',
  'face purgatory',
  'sonata arcanix',
  'read the runes',
  'mordaunt tide',
  'become the shadow lord',
  'runeblood barrier',
  'seeds of agony',
  'sting of sorcery',
  'slither',
  'chains of eminence',
  'lead the charge',
  'captains call',
  "captain's call",
  'this rounds on me',
  'hold the line',
  'chaff parade',
]);

export const FAB_CARD_DEFENSE: Record<string, number> = {
  // Equipment
  'longsword leggings': 1,
  'grasp of the arknight': 1,
  'fyendals spring tunic': 1,
  "fyendal's spring tunic": 1,
  'solforge gauntlet': 1,
  'warband of bellona': 2,
  'crown of providence': 2,
  'flail of agony': 0,
  'spellbound creepers': 0,
  'grimoire of fellingsong': 0,
  'face purgatory': 0,
  'ironrot': 1,
  'ironhide': 1,
  'goliath gauntlet': 0,
  'barkbone strapping': 1,
  'scabskin leathers': 1,
  'carrion husk': 6,
  'arcanite skullcap': 1,
  'crown of reflection': 1,
  'cranial crush': 0,
  'halo of illumination': 1,
  'helm of halos grace': 1,
  'circlet of eternal end': 1,
  'kabuto of imperial authority': 1,
  'soulbond resolve': 2,
  'ironsong versus': 1,
  'warpath of winged grace': 1,

  // Common Defense reactions & blocks
  'sink below': 4,
  'fate foreseen': 4,
  'unmovable': 4,
  'soul shield': 6,
  'saving grace': 3,
  'oasis respite': 4,
  'peace of mind': 4,
  'steadfast': 3,
  'staunch response': 4,

  // Common cards seen in blocks
  'cull': 2,
  'requiem for the damned': 3,
  'widespread annihilation': 2,
  'deadwood dirge': 2,
  'deathly delight': 2,
  'deathly wail': 2,
  'widespread ruin': 2,
  'beaming bravado': 2,
  'bolt of courage': 2,
  'bravery of the blade': 2,
  'duty bound blitz': 2,
  'take flight': 2,
  'engulfing light': 2,
  'v of the vanguard': 2,
  'lumina ascension': 2,
  'command and conquer': 3,
  'enlightened strike': 3,
  'pummel': 2,
  'snatch': 2,
  'celestial cataclysm': 0,
  'blessing of bellona': 2,
  'prayer of bellona': 2,
  'tenacity': 2,
};

/**
 * Enriches Chain Link lines with the attack card and total damage/threatened value.
 */
export function enrichChainLinksWithDamage(
  lines: string[],
  pitchMap?: Map<string, 'r' | 'y' | 'b'>
): string[] {
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const chainMatch = line.match(/^(?:\[?Chain Link\s*(\d+)\]?)/i);

    if (chainMatch) {
      const linkNum = chainMatch[1];
      let attackCard = '';
      let damageValue: number | undefined;
      let blockedDefense = 0;
      let explicitPower: number | undefined;
      let hasBlock = false;

      // Look ahead up to 18 lines for the attack resolution
      for (let j = i + 1; j < Math.min(lines.length, i + 18); j++) {
        const nextLine = lines[j];
        if (
          /^(?:\[?Chain Link\s*\d+|The combat chain was closed|--- Turn)/i.test(nextLine)
        ) {
          break;
        }

        // Damage detection: "is about to take X damage from <Card>" takes top priority
        const dmgAboutMatch = nextLine.match(/is about to take\s*(\d+)\s*damage(?:\s+from\s*(.*))?/i);
        if (dmgAboutMatch) {
          damageValue = parseInt(dmgAboutMatch[1], 10);
          if (dmgAboutMatch[2]?.trim()) {
            const candidate = dmgAboutMatch[2].trim();
            if (!NON_ATTACK_CARDS.has(candidate.toLowerCase())) {
              attackCard = candidate;
            }
          }
        }

        const combatHitMatch = nextLine.match(/Combat resolved with a hit for\s*(\d+)\s*damage/i);
        if (combatHitMatch) {
          damageValue = parseInt(combatHitMatch[1], 10);
        }

        // Only consider generic took damage if not from Runechant/arcane
        const tookDmgMatch = nextLine.match(/took\s*(\d+)\s*damage/i);
        if (tookDmgMatch && damageValue === undefined) {
          const prevLine = j > 0 ? lines[j - 1] : '';
          if (!/Runechant|arcane\s+damage/i.test(prevLine)) {
            damageValue = parseInt(tookDmgMatch[1], 10);
          }
        }

        const blockedForMatch = nextLine.match(/(?:blocked|defended)\s+(?:with\s+.+?\s+)?for\s+(\d+)/i);
        if (blockedForMatch) {
          hasBlock = true;
          blockedDefense += parseInt(blockedForMatch[1], 10);
        } else if (/(?:blocked|defended)\s+with\s+(.+)/i.test(nextLine)) {
          hasBlock = true;
          const matchWith = nextLine.match(/(?:blocked|defended)\s+with\s+(.+)/i);
          if (matchWith) {
            const cardsStr = matchWith[1];
            const parts = cardsStr.split(/\s+and\s+|,\s*/i);
            for (const c of parts) {
              const cClean = c.replace(/\s*\([ryb]\)$/i, '').trim().toLowerCase();
              if (FAB_CARD_DEFENSE[cClean] !== undefined) {
                blockedDefense += FAB_CARD_DEFENSE[cClean];
              }
            }
          }
        } else if (/Combat resolved with no hit/i.test(nextLine)) {
          hasBlock = true;
        }

        const playedForMatch = nextLine.match(/(?:played|attacks? with|attacked with)\s+(.+?)\s+for\s+(\d+)/i);
        if (playedForMatch) {
          const cand = playedForMatch[1].trim();
          if (!attackCard && !NON_ATTACK_CARDS.has(cand.toLowerCase())) {
            attackCard = cand;
          }
          explicitPower = parseInt(playedForMatch[2], 10);
        }

        // Attack card detection if not already found
        if (!attackCard) {
          const playedMatch = nextLine.match(
            /(?:played|activated)\s+(?!ability\b|Ser Boltyn|Levia|Bravo|Kayo|Dorinthea)(.+?)(?:\s+from\s+arsenal|\s+for\s+\d+|$)/i
          );
          if (playedMatch) {
            const candidate = playedMatch[1].trim();
            const lowerCand = candidate.toLowerCase();
            if (
              !lowerCand.includes('ability') &&
              !lowerCand.includes('pass') &&
              !NON_ATTACK_CARDS.has(lowerCand)
            ) {
              attackCard = candidate;
            }
          }
        }
      }

      if (damageValue === undefined && hasBlock) {
        damageValue = 0;
      }

      let totalPower: number | undefined = explicitPower;
      if (totalPower === undefined && damageValue !== undefined) {
        if (damageValue > 0) {
          totalPower = damageValue + (blockedDefense > 0 ? blockedDefense : 0);
        } else if (blockedDefense > 0) {
          totalPower = blockedDefense;
        }
      }

      // Add pitch to attackCard if known
      if (attackCard && pitchMap) {
        const lower = attackCard.toLowerCase().replace(/\s*\([ryb]\)$/i, '').trim();
        if (!/\([ryb]\)/i.test(attackCard) && pitchMap.has(lower)) {
          attackCard = `${attackCard} (${pitchMap.get(lower)})`;
        }
      }

      let formattedHeader = `[Chain Link ${linkNum}]`;
      if (attackCard) {
        const powerDesc = totalPower !== undefined ? ` (Poder: ${totalPower})` : '';
        if (damageValue !== undefined) {
          let dmgDesc = '';
          if (damageValue > 0) {
            dmgDesc = blockedDefense > 0
              ? `${damageValue} de dano (${blockedDefense} bloqueado)`
              : `${damageValue} de dano`;
          } else {
            dmgDesc = blockedDefense > 0
              ? `0 de dano (bloqueado por ${blockedDefense})`
              : '0 de dano (bloqueado)';
          }
          formattedHeader = `[Chain Link ${linkNum}] ${attackCard}${powerDesc} — ${dmgDesc}`;
        } else {
          formattedHeader = `[Chain Link ${linkNum}] ${attackCard}${powerDesc}`;
        }
      }

      result.push(formattedHeader);
    } else {
      result.push(line);
    }
  }

  return result;
}

/**
 * Formats a human-readable complete match log including metadata and turn history.
 */
export function formatFullLogText(match: MatchRecord): string {
  let playerHero = match.player.hero;
  let opponentHero = match.opponent.hero;

  if ((!playerHero || playerHero === '-' || !opponentHero || opponentHero === '-') && match.rawLogs) {
    const inferred = inferHeroesFromLogs(match.rawLogs, match.player, match.opponent);
    if ((!playerHero || playerHero === '-') && inferred.playerHero) {
      playerHero = inferred.playerHero;
      match.player.hero = inferred.playerHero;
    }
    if ((!opponentHero || opponentHero === '-') && inferred.opponentHero) {
      opponentHero = inferred.opponentHero;
      match.opponent.hero = inferred.opponentHero;
    }
  }

  const sideboardText =
    match.sideboardCards && match.sideboardCards.length > 0
      ? match.sideboardCards.join(', ')
      : '-';

  const playerEquipText =
    match.playerEquipment && match.playerEquipment.length > 0
      ? match.playerEquipment.join(', ')
      : '-';

  const oppEquipText =
    match.opponentEquipment && match.opponentEquipment.length > 0
      ? match.opponentEquipment.join(', ')
      : '-';

  const header = [
    `=== PARTIDA TALISHAR: ${playerHero || 'Meu Herói'} vs ${opponentHero || 'Oponente'} ===`,
    `Data: ${match.timestamp}`,
    `Jogador: ${match.player.name || 'Jogador'} (${playerHero || '-'})`,
    `Adversário: ${match.opponent.name || 'Oponente'} (${opponentHero || '-'})`,
    `Resultado: ${translateResult(match.result)}`,
    `Iniciou: ${match.wentFirst === undefined ? '-' : match.wentFirst ? 'Sim' : 'Não'}`,
    `Turnos: ${match.turnsCount}`,
    `Meu Valor Médio/Turno: ${formatDecimalPtBr(match.player.avgTurnValue)}`,
    `Valor Médio/Turno Oponente: ${formatDecimalPtBr(match.opponent.avgTurnValue)}`,
    `Meu Equipamento: ${playerEquipText}`,
    `Equipamento Oponente: ${oppEquipText}`,
    `Sideboard / Cartas Fora: ${sideboardText}`,
    `Notas: ${match.notes || '-'}`,
    '',
    '--- ESTATÍSTICAS AVANÇADAS ---',
    `Turno de Maior Dano (Meu): ${match.player.maxDamage ?? 0} de dano (Turno ${match.player.maxDamageTurn ?? 0})`,
    `Turno de Maior Dano (Oponente): ${match.opponent.maxDamage ?? 0} de dano (Turno ${match.opponent.maxDamageTurn ?? 0})`,
    `Fadiga (Cartas no deck ao fim): Eu (${match.player.fatigue ?? '?'}) | Oponente (${match.opponent.fatigue ?? '?'})`,
    '',
    '--- LOG DE COMBATE COMPLETO (PERSONAGENS / IA) ---',
  ].join('\n');

  const pitchMap = buildKnownPitchMap(match);

  const rawLogs = match.rawLogs && match.rawLogs.length > 0
    ? replacePlayerNamesWithHeroes(match.rawLogs, match.player, match.opponent)
    : [];

  // Decorate lines with pitch codes
  const pitchDecoratedLogs = rawLogs.map((l) => decorateLineWithPitches(l, pitchMap));

  // Enrich chain link headers with attack card and damage
  const chainEnrichedLogs = enrichChainLinksWithDamage(pitchDecoratedLogs, pitchMap);

  const formattedLines: string[] = [];
  chainEnrichedLogs.forEach((line) => {
    if (/^---?\s*Turn/i.test(line) || /^Turn\s+\d+/i.test(line)) {
      const clean = line.replace(/^-+\s*/, '').replace(/\s*-+$/, '');
      formattedLines.push('');
      formattedLines.push('--------------------------------------------------');
      formattedLines.push(`--- ${clean} ---`);
      formattedLines.push('--------------------------------------------------');
    } else {
      formattedLines.push(line);
    }
  });

  const logs = formattedLines.length > 0
    ? formattedLines.join('\n')
    : '(Nenhum log registrado)';

  return `${header}\n${logs}\n`;
}
