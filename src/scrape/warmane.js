import axios from 'axios';
import { load } from 'cheerio';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// ====== setup de cache ======
const DATA_DIR = path.resolve('./data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB = new Database(path.join(DATA_DIR, 'cache.db'));
DB.pragma('journal_mode = WAL');
DB.prepare(`CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`).run();

// cache dedicado p/ itens (nome/ilvl) — vive mais
DB.prepare(`CREATE TABLE IF NOT EXISTS item_cache (
  item_id INTEGER PRIMARY KEY,
  name TEXT,
  ilvl INTEGER,
  fetched_at INTEGER NOT NULL
)`).run();

const TTL_MIN = parseInt(process.env.CACHE_TTL_MINUTES || '30', 10);
const ITEM_TTL_DAYS = parseInt(process.env.ITEM_TTL_DAYS || '7', 10);
const ENABLE_ITEM_LOOKUP = String(process.env.ENABLE_ITEM_LOOKUP || '1') === '1';

function getCache(key) {
  const row = DB.prepare('SELECT value, created_at FROM cache WHERE key = ?').get(key);
  if (!row) return null;
  const ageMin = (Date.now() - row.created_at) / 60000;
  if (ageMin > TTL_MIN) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}
function setCache(key, value) {
  DB.prepare('REPLACE INTO cache (key, value, created_at) VALUES (?, ?, ?)').run(
    key, JSON.stringify(value), Date.now()
  );
}

function normalizeRealm(realm) {
  return encodeURIComponent(realm);
}
function buildUrl({ name, realm }) {
  return `https://armory.warmane.com/character/${encodeURIComponent(name)}/${normalizeRealm(realm)}/summary`;
}

// ——— util: força https/absoluto
function abs(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url.replace(/^http:/, 'https:');
  return `https:${url}`;
}

// ====== lookup de nome/ilvl no Cavern of Time (opcional) ======
function getItemCache(itemId) {
  const row = DB.prepare('SELECT name, ilvl, fetched_at FROM item_cache WHERE item_id = ?').get(itemId);
  if (!row) return null;
  const ageDays = (Date.now() - row.fetched_at) / (24 * 60 * 60 * 1000);
  if (ageDays > ITEM_TTL_DAYS) return null;
  return { name: row.name, ilvl: row.ilvl ?? null };
}
function setItemCache(itemId, name, ilvl) {
  DB.prepare('REPLACE INTO item_cache (item_id, name, ilvl, fetched_at) VALUES (?, ?, ?, ?)').run(
    itemId, name || null, ilvl || null, Date.now()
  );
}

async function fetchItemMeta(itemId) {
  const cached = getItemCache(itemId);
  if (cached) return cached;

  try {
    // HTTPS + cabeçalhos — ajuda a evitar bloqueio
    const url = `https://wotlk.cavernoftime.com/item=${itemId}`;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Warmane Armory Bot (+https://github.com/you/armory-bot)',
        'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.7',
        'Referer': 'https://armory.warmane.com/'
      },
      timeout: 15000
    });

    const $ = load(res.data);
    const title = $('title').first().text().trim(); // "Shadowmourne - WotLK Classic Database"
    const name = title.replace(/\s+-\s+.*$/i, '').trim();

    let ilvl = null;
    const ilvlMatch = res.data.match(/Item Level\s*(\d{1,3})/i);
    if (ilvlMatch) ilvl = parseInt(ilvlMatch[1], 10);

    setItemCache(itemId, name || null, ilvl || null);
    return { name, ilvl };
  } catch {
    setItemCache(itemId, null, null);
    return { name: null, ilvl: null };
  }
}

export async function scrapeWarmaneArmory({ name, realm }) {
  const url = buildUrl({ name, realm });
  const cacheKey = `armory:${url}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const resp = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Warmane Armory Bot for Discord; +https://example.com)',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    timeout: 15000
  });

  const $ = load(resp.data);

  // ——— header
  const charName = $('.information .information-left .name').first().text().trim()
    || $('div.name').first().text().trim();
  const levelRaceClass = $('.information .level-race-class').first().text().trim();
  const levelMatch = levelRaceClass.match(/Level\s+(\d+)/i);
  const level = levelMatch ? `Level ${levelMatch[1]}` : '';
  const raceClass = levelRaceClass.replace(/Level\s+\d+\s+/, '').replace(/,\s*.*$/, '').trim();
  const specText = $('.specialization .stub .text').first().text().replace(/\s+/g, ' ').trim();
  const rawThumb = $('#character-profile .item-left .item-slot img').first().attr('src') || null;
  const thumbUrl = abs(rawThumb);

  // ——— gear
  const gearSlots = {};
  const leftOrder  = ['Head','Neck','Shoulder','Back','Chest','Shirt','Tabard','Wrist'];
  const rightOrder = ['Hands','Waist','Legs','Feet','Ring1','Ring2','Trinket1','Trinket2'];
  const bottomOrder = ['MainHand','OffHand','Ranged'];

  let idx = 0;
  $('#character-profile .item-model .item-left .item-slot').each((_, el) => {
    const slotName = leftOrder[idx] || `Left${idx+1}`;
    idx++;
    const it = parseSlot($, el);
    // Sempre adiciona o slot, mesmo se vazio
    gearSlots[slotName] = it;
  });

  idx = 0;
  $('#character-profile .item-model .item-right .item-slot').each((_, el) => {
    const slotName = rightOrder[idx] || `Right${idx+1}`;
    idx++;
    const it = parseSlot($, el);
    // Sempre adiciona o slot, mesmo se vazio
    gearSlots[slotName] = it;
  });

  idx = 0;
  $('#character-profile .item-model .item-bottom .item-slot').each((_, el) => {
    const slotName = bottomOrder[idx] || `Weapon${idx+1}`;
    idx++;
    const it = parseSlot($, el);
    // Sempre adiciona o slot, mesmo se vazio
    gearSlots[slotName] = it;
  });

  // lookup opcional (para nomes/ilvl)
  if (ENABLE_ITEM_LOOKUP) {
    const entries = Object.values(gearSlots).filter(g => g.itemId);
    for (const it of entries) {
      const meta = await fetchItemMeta(it.itemId);
      if (meta?.name) it.name = meta.name;
      if (meta?.ilvl) it.ilvl = meta.ilvl;
    }
  }

  // ——— stats
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

  // ——— professions
  const professions = [];
  $('.profskills .stub .text').each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    const m = t.match(/^([A-Za-z ]+)\s+(\d+\s*\/\s*\d+)/);
    if (m) professions.push({ name: m[1].trim(), value: m[2].replace(/\s+/g, '') });
  });

  // ——— recent
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

  setCache(cacheKey, data);
  return data;
}

// ——— helpers
function parseSlot($, el) {
  const a = $(el).find('a[href]').first();
  
  // Se não há link, retorna slot vazio ao invés de null
  if (!a.length) {
    return {
      href: null,
      itemId: null,
      icon: null,
      name: null,
      quality: 'Common',
      enchant: null,
      gems: []
    };
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

// 8. Backup do Banco de Dados

// Para o SQLite, configure backups periódicos:
export function backupDatabase() {
  const backupPath = path.join(DATA_DIR, `cache-backup-${Date.now()}.db`);
  DB.backup(backupPath);
  log.info(`Database backed up to ${backupPath}`);
}
