// src/scrape/warmane.js
import { load } from 'cheerio';

// ====== D1 Database setup ======
let DB = null;

function initDB(env) {
  if (!DB) {
    DB = env.DB; // Cloudflare D1 database binding
  }
  return DB;
}

// Initialize tables (called once during worker startup)
export async function initializeTables(env) {
  const db = initDB(env);
  
  await db.prepare(`CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS item_cache (
    item_id INTEGER PRIMARY KEY,
    name TEXT,
    ilvl INTEGER,
    fetched_at INTEGER NOT NULL
  )`).run();
}

const TTL_MIN = 30; // Default cache TTL in minutes
const ITEM_TTL_DAYS = 7; // Default item cache TTL in days
const ENABLE_ITEM_LOOKUP = true;

async function getCache(key, env) {
  const db = initDB(env);
  const result = await db.prepare('SELECT value, created_at FROM cache WHERE key = ?').bind(key).first();
  if (!result) return null;
  const ageMin = (Date.now() - result.created_at) / 60000;
  if (ageMin > TTL_MIN) return null;
  try { return JSON.parse(result.value); } catch { return null; }
}

async function setCache(key, value, env) {
  const db = initDB(env);
  await db.prepare('REPLACE INTO cache (key, value, created_at) VALUES (?, ?, ?)').bind(
    key, JSON.stringify(value), Date.now()
  ).run();
}

function normalizeRealm(realm) {
  return encodeURIComponent(realm);
}
function buildUrl({ name, realm }) {
  return `https://armory.warmane.com/character/${encodeURIComponent(name)}/${normalizeRealm(realm)}/summary`;
}

function abs(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url.replace(/^http:/, 'https:');
  return `https:${url}`;
}

// ====== Item lookup with D1 ======
async function getItemCache(itemId, env) {
  const db = initDB(env);
  const result = await db.prepare('SELECT name, ilvl, fetched_at FROM item_cache WHERE item_id = ?').bind(itemId).first();
  if (!result) return null;
  const ageDays = (Date.now() - result.fetched_at) / (24 * 60 * 60 * 1000);
  if (ageDays > ITEM_TTL_DAYS) return null;
  return { name: result.name, ilvl: result.ilvl ?? null };
}

async function setItemCache(itemId, name, ilvl, env) {
  const db = initDB(env);
  await db.prepare('REPLACE INTO item_cache (item_id, name, ilvl, fetched_at) VALUES (?, ?, ?, ?)').bind(
    itemId, name || null, ilvl || null, Date.now()
  ).run();
}

async function fetchItemMeta(itemId, env) {
  const cached = await getItemCache(itemId, env);
  if (cached) return cached;

  try {
    const url = `https://wotlk.cavernoftime.com/item=${itemId}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Warmane Armory Bot (+https://github.com/you/armory-bot)',
        'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.7',
        'Referer': 'https://armory.warmane.com/'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $ = load(html);
    const title = $('title').first().text().trim();
    const name = title.replace(/\s+-\s+.*$/i, '').trim();

    let ilvl = null;
    const ilvlMatch = html.match(/Item Level\s*(\d{1,3})/i);
    if (ilvlMatch) ilvl = parseInt(ilvlMatch[1], 10);

    await setItemCache(itemId, name || null, ilvl || null, env);
    return { name, ilvl };
  } catch {
    await setItemCache(itemId, null, null, env);
    return { name: null, ilvl: null };
  }
}

export async function scrapeWarmaneArmory({ name, realm }, env) {
  const url = buildUrl({ name, realm });
  const cacheKey = `armory:${url}`;
  const cached = await getCache(cacheKey, env);
  if (cached) return cached;

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Warmane Armory Bot for Discord; +https://example.com)',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();
  const $ = load(html);

  // header
  const charName = $('.information .information-left .name').first().text().trim()
    || $('div.name').first().text().trim();
  const levelRaceClass = $('.information .level-race-class').first().text().trim();
  const levelMatch = levelRaceClass.match(/Level\s+(\d+)/i);
  const level = levelMatch ? `Level ${levelMatch[1]}` : '';
  const raceClass = levelRaceClass.replace(/Level\s+\d+\s+/, '').replace(/,\s*.*$/, '').trim();
  const specText = $('.specialization .stub .text').first().text().replace(/\s+/g, ' ').trim();
  const rawThumb = $('#character-profile .item-left .item-slot img').first().attr('src') || null;
  const thumbUrl = abs(rawThumb);

  // gear
  const gearSlots = {};
  const leftOrder  = ['Head','Neck','Shoulder','Back','Chest','Shirt','Tabard','Wrist'];
  const rightOrder = ['Hands','Waist','Legs','Feet','Ring1','Ring2','Trinket1','Trinket2'];
  const bottomOrder = ['MainHand','OffHand','Ranged'];

  let idx = 0;
  $('#character-profile .item-model .item-left .item-slot').each((_, el) => {
    const slotName = leftOrder[idx] || `Left${idx+1}`; idx++;
    gearSlots[slotName] = parseSlot($, el);
  });
  idx = 0;
  $('#character-profile .item-model .item-right .item-slot').each((_, el) => {
    const slotName = rightOrder[idx] || `Right${idx+1}`; idx++;
    gearSlots[slotName] = parseSlot($, el);
  });
  idx = 0;
  $('#character-profile .item-model .item-bottom .item-slot').each((_, el) => {
    const slotName = bottomOrder[idx] || `Weapon${idx+1}`; idx++;
    gearSlots[slotName] = parseSlot($, el);
  });

  if (ENABLE_ITEM_LOOKUP) {
    const entries = Object.values(gearSlots).filter(g => g.itemId);
    for (const it of entries) {
      const meta = await fetchItemMeta(it.itemId, env);
      if (meta?.name) it.name = meta.name;
      if (meta?.ilvl) it.ilvl = meta.ilvl;
    }
  }

  // stats
  const statBlocks = $('.character-stats .stub .text');
  const stats = {};
  statBlocks.each((_, el) => {
    const raw = $(el).text().trim().replace(/\s+/g, ' ');
    if (raw.startsWith('Melee')) {
      const v = blockToKv(raw);
      stats.melee = { damage: v['Damage'] || '', hit: v['Hit rating'] || '', crit: v['Critical'] || '' };
    } else if (raw.startsWith('Ranged')) {
      const v = blockToKv(raw);
      stats.ranged = { damage: v['Damage'] || '', hit: v['Hit rating'] || '', crit: v['Critical'] || '' };
    } else if (raw.startsWith('Spell')) {
      const v = blockToKv(raw);
      stats.spell = { power: v['Power'] || '', haste: v['Haste'] || '', hit: v['Hit rating'] || '', crit: v['Critical'] || '' };
    } else if (raw.startsWith('Attributes')) {
      const v = blockToKv(raw);
      stats.attrs = { int: v['Intellect'] || '', sta: v['Stamina'] || '', spi: v['Spirit'] || '' };
    }
  });

  // professions
  const professions = [];
  $('.profskills .stub .text').each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    const m = t.match(/^([A-Za-z ]+)\s+(\d+\s*\/\s*\d+)/);
    if (m) professions.push({ name: m[1].trim(), value: m[2].replace(/\s+/g, '') });
  });

  // recent
  const recent = [];
  $('.recent-activity .stub .text').each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    const when = (t.match(/(\d+\s+\w+\s+ago)/) || [])[1] || '';
    const title = t.replace(/Earned\s+/, '').replace(/\s+achievement.*$/, '').trim();
    recent.push({ title, when });
  });

  const data = {
    charName: charName || name,
    level,
    raceClass,
    specText,
    profileUrl: url,
    gearSlots,
    stats,
    professions,
    recent,
    thumbUrl
  };

  await setCache(cacheKey, data, env);
  return data;
}

// === talents ===
function buildTalentsUrl({ name, realm }) {
  return `https://armory.warmane.com/character/${encodeURIComponent(name)}/${encodeURIComponent(realm)}/talents`;
}

export async function scrapeWarmaneTalents({ name, realm }, env) {
  const talentsUrl = buildTalentsUrl({ name, realm });
  const cacheKey = `talents:${talentsUrl}`;
  const cached = await getCache(cacheKey, env);
  if (cached) return cached;

  const resp = await fetch(talentsUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Warmane Armory Bot for Discord; +https://example.com)',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();
  const $ = load(html);

  // header
  const charName = $('.information .information-left .name').first().text().trim()
    || $('div.name').first().text().trim() || name;
  const raceClass = $('.information .level-race-class').first().text().trim();
  const profileUrl = $('a[href*="/summary"]').first().attr('href')
    ? `https://armory.warmane.com${$('a[href*="/summary"]').first().attr('href')}`
    : `https://armory.warmane.com/character/${encodeURIComponent(name)}/${encodeURIComponent(realm)}/summary`;

  // portrait
  let thumbUrl = null;
  const thumbGuess = $('img.character-portrait').attr('src') || $('#character-profile .item-left .item-slot img').first().attr('src');
  if (thumbGuess) thumbUrl = abs(thumbGuess);

  // spec ativa
  let activeSpecIndex = 0;
  const activeTd = $('table.talent-spec-switch td.selected').attr('data-spec');
  if (activeTd) activeSpecIndex = parseInt(activeTd, 10) || 0;

  // glyphs do spec ativo
  const glyphs = { major: [], minor: [] };
  const glyphBox = $(`.character-glyphs div[data-glyphs="${activeSpecIndex}"]`).first();
  glyphBox.find('.glyph.major a').each((_, a) => glyphs.major.push($(a).text().trim()));
  glyphBox.find('.glyph.minor a').each((_, a) => glyphs.minor.push($(a).text().trim()));

  // árvores do spec ativo
  const trees = [];
  const points = {}; // somente as árvores que existem
  const specDiv = $(`#spec-${activeSpecIndex}`);
  const frames = specDiv.find('.talent-frame');

  frames.each((_, frameEl) => {
    const treeEl = $(frameEl).find('.talent-tree').first();

    // nome + total
    const info = $(treeEl).find('.talent-tree-info').first().text().replace(/\s+/g, ' ').trim();
    let treeName = 'Tree';
    let treePts = 0;
    const m = info.match(/([A-Za-z]+)\s+(\d+)/);
    if (m) { treeName = m[1]; treePts = parseInt(m[2], 10) || 0; }
    points[treeName] = treePts;

    // tiers/linhas
    const tiers = [];
    $(treeEl).find('.tier').each((rowIdx, rowEl) => {
      const rowTalents = [];
      $(rowEl).find('a.talent').each((_, a) => {
        const $a = $(a);
        const cls = ($a.attr('class') || '').split(/\s+/);
        const colClass = cls.find(c => /^col[0-3]$/.test(c));
        const col = colClass ? parseInt(colClass.replace('col', ''), 10) : 0;

        const style = $a.attr('style') || '';
        const iconRel = (style.match(/url\((.*?)\)/) || [])[1] || null;
        const icon = abs(iconRel);

        const tp = $a.find('.talent-points').first();
        const raw = tp.text().trim();  // "2/3"
        const mm = raw.match(/(\d+)\s*\/\s*(\d+)/);
        const rank = mm ? parseInt(mm[1], 10) : 0;
        const max  = mm ? parseInt(mm[2], 10) : 0;

        let state = 'points';
        if (tp.hasClass('disabled')) state = 'disabled';
        if (tp.hasClass('max')) state = 'max';

        rowTalents.push({ icon, state, rank, max, xy: { row: rowIdx, col } });
      });
      tiers.push(rowTalents);
    });

    trees.push({ name: treeName, points: treePts, tiers });
  });

  const data = {
    talentsUrl,
    profileUrl,
    charName,
    raceClass,
    trees,
    glyphs,
    points,
    specName:
      Object.keys(points).reduce((best, k) =>
        best === null || points[k] > points[best] ? k : best, null) || '',
    thumbUrl
  };

  await setCache(cacheKey, data, env);
  return data;
}

// ——— helpers ———
function parseSlot($, el) {
  const a = $(el).find('a[href]').first();
  if (!a.length) {
    return { href: null, itemId: null, icon: null, name: null, quality: 'Common', enchant: null, gems: [] };
  }
  const href = a.attr('href');
  const itemId = extractItemId(href);
  const icon = abs($(el).find('img').attr('src') || null);

  let itemName = a.attr('title') || $(el).find('img').attr('alt') || (itemId ? `Item ${itemId}` : 'Unknown');

  const quality = getItemQuality($, el);
  const rel = a.attr('rel') || '';
  const enchMatch = rel.match(/ench=(\d+)/);
  const gemsMatch = rel.match(/gems=([0-9:]+)/);
  const enchant = enchMatch ? Number(enchMatch[1]) : null;
  const gems = gemsMatch ? gemsMatch[1].split(':').filter(Boolean).map(n => Number(n)) : [];

  return { href, itemId, icon, name: itemName, quality, enchant, gems };
}
function extractItemId(href) {
  const m = String(href || '').match(/item=(\d+)/);
  return m ? Number(m[1]) : null;
}
function blockToKv(raw) {
  const out = {};
  const re = /([A-Za-z ]+):\s*([^:]+)/g;
  let m;
  while ((m = re.exec(raw)) !== null) out[m[1].trim()] = m[2].trim();
  return out;
}
function getItemQuality($, el) {
  const qDiv = $(el).find('div.icon-quality').first();
  const classes = (qDiv.attr('class') || '').split(/\s+/);
  const qClass = classes.find(c => /^icon-quality\d$/.test(c));
  const map = {
    'icon-quality0': 'Poor',
    'icon-quality1': 'Common',
    'icon-quality2': 'Uncommon',
    'icon-quality3': 'Rare',
    'icon-quality4': 'Epic',
    'icon-quality5': 'Legendary',
    'icon-quality6': 'Artifact',
    'icon-quality7': 'Heirloom'
  };
  if (qClass && map[qClass]) return map[qClass];

  const link = $(el).find('a');
  const style = link.attr('style') || '';
  if (style.includes('#ff8000') || style.includes('orange')) return 'Legendary';
  if (style.includes('#a335ee') || style.includes('purple')) return 'Epic';
  if (style.includes('#0070dd') || style.includes('blue')) return 'Rare';
  if (style.includes('#1eff00') || style.includes('green')) return 'Uncommon';
  if (style.includes('#9d9d9d') || style.includes('gray')) return 'Poor';
  return 'Common';
}
