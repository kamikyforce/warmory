// src/render/armoryCard.js
import puppeteer from '@cloudflare/puppeteer';

/**
 * Layout (Warmane-like) with labels and tidy spacing:
 *  Left  : Head, Neck, Shoulder, Back, Chest, Shirt, Tabard, Wrist
 *  Right : Hands, Waist, Legs, Feet, Ring1, Ring2, Trinket1, Trinket2
 *  Bottom: MainHand, OffHand, Ranged (flow below columns)
 */
const SLOT_LEFT  = ['Head','Neck','Shoulder','Back','Chest','Shirt','Tabard','Wrist'];
const SLOT_RIGHT = ['Hands','Waist','Legs','Feet','Ring1','Ring2','Trinket1','Trinket2'];
const SLOT_WEAP  = ['MainHand','OffHand','Ranged'];

const LABEL = {
  Head:'Head', Neck:'Neck', Shoulder:'Shoulder', Back:'Back', Chest:'Chest',
  Shirt:'Shirt', Tabard:'Tabard', Wrist:'Wrist',
  Hands:'Hands', Waist:'Waist', Legs:'Legs', Feet:'Feet',
  Ring1:'Ring 1', Ring2:'Ring 2', Trinket1:'Trinket 1', Trinket2:'Trinket 2',
  MainHand:'Main Hand', OffHand:'Off Hand', Ranged:'Ranged'
};

// Warmane-ish quality colors
const QCOLOR = {
  Legendary:'#ff8000', Epic:'#a335ee', Rare:'#0070dd', Uncommon:'#1eff00',
  Artifact:'#e6cc80', Heirloom:'#e6cc80', Poor:'#9d9d9d', Common:'#8a8f98'
};

export async function buildArmoryCard({
  charName, raceClass, specText, gearSlots, thumbUrl
}, env) {
  let browser;
  try {
    browser = await puppeteer.launch(env.MYBROWSER, {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    // Altura maior para garantir zero overlap
    await page.setViewport({ width: 1120, height: 1080 });

    const html = generateArmoryHTML({ charName, raceClass, specText, gearSlots, thumbUrl });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });

    const screenshot = await page.screenshot({ type: 'png', fullPage: true, timeout: 15000 });
    return screenshot;
  } finally {
    if (browser) await browser.close();
  }
}

function generateArmoryHTML({ charName, raceClass, specText, gearSlots, thumbUrl }) {
  const leftSlots   = SLOT_LEFT .map(slot => generateSlotHTML(slot, gearSlots?.[slot])).join('');
  const rightSlots  = SLOT_RIGHT.map(slot => generateSlotHTML(slot, gearSlots?.[slot])).join('');
  const weaponSlots = SLOT_WEAP .map(slot => generateSlotHTML(slot, gearSlots?.[slot], true)).join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

      * { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        width: 1120px; height: 1080px;
        font-family: 'Inter', Arial, Helvetica, sans-serif;
        color: #c9d1d9;
        background: radial-gradient(1200px 1000px at 70% -10%, #161a20 0%, #0b0d10 55%, #0a0c10 100%);
        border: 2px solid #272b31; border-radius: 14px; overflow: hidden;
        position: relative;
      }

      .chrome { position:absolute; inset:12px; border-radius:12px; background:rgba(255,255,255,0.025); }

      .wrap { position:relative; z-index:1; min-height:100%; padding:26px 26px 34px; display:flex; flex-direction:column; }

      /* Header */
      .header { display:flex; align-items:flex-start; justify-content:space-between; }
      .title { display:flex; flex-direction:column; gap:6px; }
      .char-name { font-size:44px; font-weight:800; letter-spacing:.2px; color:#d8c88b; text-shadow:0 1px 0 #111; }
      .race-class { font-size:17px; color:#9aa1a7; }

      .spec-line {
        margin: 10px auto 0; font-size:15px; color:#ffffff; opacity:.95;
      }

      .portrait {
        width:84px; height:84px; border-radius:10px; border:2px solid #2b2f36; overflow:hidden; background:#0e1216;
      }
      .portrait img { width:100%; height:100%; object-fit:cover; }

      /* Columns container */
      .grid {
        display:flex; justify-content:space-between;
        margin-top: 24px; /* depois da spec-line */
        flex: 1 0 auto;
      }

      .col { width: 332px; }
      .col-title { font-size:18px; font-weight:700; color:#fff; margin: 14px 0; }

      /* Slot box */
      .slot {
        display:flex; align-items:center;
        background:#0f1116; border:1px solid #1e232b; border-radius:12px;
        padding:8px; margin-bottom:10px; height:80px; width:100%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      }

      .icon {
        width:56px; height:56px; border-radius:8px; background:#1a1d22;
        margin-right:12px; position:relative; overflow:hidden; flex-shrink:0;
        outline:3px solid transparent;
      }
      .icon img { width:50px; height:50px; margin:3px; border-radius:6px; display:block; }

      .slot-body { flex:1; min-width:0; }
      .label { font-size:12px; color:#8b949e; margin-bottom:4px; }
      .name  { font-size:14px; color:#c9d1d9; line-height:18px; margin-bottom:4px; word-break:break-word; }
      .ilvl  { font-size:12px; color:#7aa2ff; }

      /* Weapons: IN FLOW (no absolute) */
      .weapons { margin-top: 18px; }
      .weapons-title { text-align:center; font-size:18px; font-weight:700; color:#fff; margin-bottom:12px; }
      .weapons-row { display:flex; justify-content:center; gap:16px; }
      .slot.weapon { width: 332px; }

      /* Footer spacer to guarantee non-overlap on short content */
      .spacer { height: 10px; }
    </style>
  </head>
  <body>
    <div class="chrome"></div>
    <div class="wrap">
      <div class="header">
        <div class="title">
          <div class="char-name">${escapeHTML(charName || '')}</div>
          <div class="race-class">${escapeHTML(raceClass || '')}</div>
        </div>
        ${thumbUrl ? `<div class="portrait"><img src="${thumbUrl}" alt="portrait"/></div>` : '<div style="width:84px"></div>'}
      </div>

      ${specText ? `<div class="spec-line">Spec: ${escapeHTML(specText)}</div>` : ''}

      <div class="grid">
        <div class="col">
          <div class="col-title">Equipment</div>
          ${leftSlots}
        </div>
        <div class="col">
          <div class="col-title">Equipment</div>
          ${rightSlots}
        </div>
      </div>

      <div class="weapons">
        <div class="weapons-title">Weapons</div>
        <div class="weapons-row">
          ${weaponSlots}
        </div>
      </div>

      <div class="spacer"></div>
    </div>
  </body>
  </html>`;
}

function generateSlotHTML(slot, item, isWeapon = false) {
  const label  = LABEL[slot] || slot;
  const name   = item?.name || (item?.itemId ? `Item ${item.itemId}` : 'Unknown');
  const ilvl   = item?.ilvl ? `ilvl ${item.ilvl}` : '';
  const q      = item?.quality || 'Common';
  const color  = QCOLOR[q] || QCOLOR.Common;

  // 2-line name wrapping
  const displayName = breakTwoLines(name, 28);

  return `
    <div class="slot ${isWeapon ? 'weapon' : ''}">
      <div class="icon" style="outline-color:${color}; box-shadow:0 0 10px ${hexToRGBA(color, .35)};">
        ${item?.icon ? `<img src="${item.icon}" alt="${escapeHTML(name)}"/>` : ''}
      </div>
      <div class="slot-body">
        <div class="label">${label}:</div>
        <div class="name">${displayName}</div>
        <div class="ilvl">${ilvl}</div>
      </div>
    </div>
  `;
}

/* ---------- helpers ---------- */
function breakTwoLines(text, maxChars = 28) {
  const words = String(text).split(' ');
  let a = '', b = '';
  for (let i = 0; i < words.length; i++) {
    const t = a.length ? a + ' ' + words[i] : words[i];
    if (t.length <= maxChars || i === 0) a = t; else { b = words.slice(i).join(' '); break; }
  }
  if (b.length > maxChars) b = b.slice(0, maxChars - 3) + '...';
  return b ? `${escapeHTML(a)}<br>${escapeHTML(b)}` : escapeHTML(a);
}
function hexToRGBA(hex, alpha = 1) {
  const v = hex.replace('#','');
  const r = parseInt(v.substring(0,2), 16);
  const g = parseInt(v.substring(2,4), 16);
  const b = parseInt(v.substring(4,6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function escapeHTML(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
