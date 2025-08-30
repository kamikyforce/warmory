// src/render/talentsCard.js
import puppeteer from '@cloudflare/puppeteer';

const GOLD = '#d8c88b';

export async function buildTalentsCard({
  charName, raceClass, specText, trees, glyphs, thumbUrl
}, env) {
  let browser;
  try {
    browser = await puppeteer.launch(env.MYBROWSER, {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 880 });

    const html = generateTalentsHTML({ charName, raceClass, specText, trees, glyphs, thumbUrl });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });

    const screenshot = await page.screenshot({ type: 'png', fullPage: true, timeout: 15000 });
    return screenshot;
  } finally {
    if (browser) await browser.close();
  }
}

function generateTalentsHTML({ charName, raceClass, specText, trees, glyphs, thumbUrl }) {
  const treesHTML   = trees.map(t => generateTreeHTML(t)).join('');
  const majorGlyphs = glyphs?.major || [];
  const minorGlyphs = glyphs?.minor || [];

  // títulos "Holy 12 / Prot 5 / Ret 54"
  const treeChips = trees.map(t => `<div class="tree-chip">${escapeHTML(t.name)} ${t.points || 0}</div>`).join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        width: 1200px; height: 880px;
        background: #0b0d10;
        font-family: 'Inter', Arial, Helvetica, sans-serif;
        color:#c9d1d9; border:2px solid #272b31; border-radius:14px; overflow:hidden; position:relative;
      }

      .chrome { position:absolute; inset:12px; border-radius:12px; background:rgba(255,255,255,0.02); }
      .wrap { position:relative; z-index:1; height:100%; padding:26px; }

      /* Header */
      .header { display:flex; justify-content:space-between; align-items:flex-start; }
      .title { display:flex; flex-direction:column; gap:6px; }
      .char-name { font-size:44px; font-weight:800; color:${GOLD}; }
      .race-class { font-size:17px; color:#9aa1a7; }
      .portrait { width:84px; height:84px; border-radius:10px; border:2px solid #2b2f36; overflow:hidden; }
      .portrait img { width:100%; height:100%; object-fit:cover; }
      .spec-line { margin-top:8px; font-size:15px; color:#fff; opacity:.95; }

      /* Chips */
      .tree-chips {
        display:grid; grid-template-columns:repeat(3, 1fr);
        gap:36px; margin-top:20px; padding:0 6px;
      }
      .tree-chip { text-align:center; color:#b0b6bd; font-size:14px; }

      /* Layout */
      .area { display:flex; gap:64px; margin-top:10px; }
      .trees { display:grid; grid-template-columns:repeat(3, 260px); gap:36px; }

      /* Tree grid */
      .tree { }
      .panel-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
      .panel-top .tname { font-size:16px; font-weight:700; color:#fff; }
      .panel-top .pts   { font-size:13px; color:#c9d1d9; }

      .grid { display:grid; grid-template-columns:repeat(4, 52px); grid-auto-rows:52px; gap:10px; }

      /* Talent tiles */
      .talent {
        width:52px; height:52px; border-radius:6px; position:relative; overflow:hidden;
        background:#161a20; border:2px solid #2b313a;
      }
      .talent img { width:46px; height:46px; margin:3px; border-radius:4px; display:block; }

      .talent.inactive img { filter:grayscale(100%); opacity:.28; }
      .talent.active { border-color:#9c8a3a; }
      .talent.max { border-color:#d1b84b; }
      .talent.disabled:before { content:""; position:absolute; inset:0; background:rgba(0,0,0,.5); border-radius:6px; }

      .rank {
        position:absolute; right:4px; bottom:4px;
        min-width:26px; padding:2px 6px; border-radius:4px; text-align:center;
        font-size:12px; font-weight:700; background:rgba(0,0,0,.65); color:#8b949e;
      }
      .talent.active .rank { color:#b9f56a; }
      .talent.max .rank { color:#f1e58a; }

      /* Glyphs */
      .glyphs { width:300px; }
      .gblock { margin-bottom:24px; }
      .gtitle { font-size:18px; font-weight:800; color:${GOLD}; margin-bottom:12px; }
      .gitem  { font-size:13px; color:#c9d1d9; line-height:21px; margin-bottom:6px; padding-left:18px; position:relative; }
      .gitem:before { content:"•"; position:absolute; left:0; top:0; color:#c9d1d9; }
    </style>
  </head>
  <body>
    <div class="chrome"></div>
    <div class="wrap">
      <div class="header">
        <div class="title">
          <div class="char-name">${escapeHTML(charName || '')}</div>
          <div class="race-class">${escapeHTML(raceClass || '')}</div>
          ${specText ? `<div class="spec-line">Spec: ${escapeHTML(specText)}</div>` : ''}
        </div>
        ${thumbUrl ? `<div class="portrait"><img src="${thumbUrl}" alt="portrait"/></div>` : '<div style="width:84px"></div>'}
      </div>

      <div class="tree-chips">${treeChips}</div>

      <div class="area">
        <div class="trees">
          ${treesHTML}
        </div>
        <div class="glyphs">
          <div class="gblock">
            <div class="gtitle">Major Glyphs</div>
            ${majorGlyphs.map(g => `<div class="gitem">${escapeHTML(g)}</div>`).join('')}
          </div>
          <div class="gblock">
            <div class="gtitle">Minor Glyphs</div>
            ${minorGlyphs.map(g => `<div class="gitem">${escapeHTML(g)}</div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </body>
  </html>`;
}

function generateTreeHTML(tree) {
  const tiles = [];
  for (let row = 0; row < tree.tiers.length; row++) {
    for (const t of tree.tiers[row]) {
      const has = t.rank > 0 && t.max > 0;
      const isMax = has && t.rank === t.max;
      const disabled = t.state === 'disabled';

      const cls = [
        'talent',
        has ? 'active' : 'inactive',
        isMax ? 'max' : '',
        disabled ? 'disabled' : ''
      ].filter(Boolean).join(' ');

      tiles.push(`
        <div class="${cls}" style="grid-column:${(t.xy.col || 0)+1}; grid-row:${row+1};">
          ${t.icon ? `<img src="${t.icon}" alt="">` : ''}
          <div class="rank">${t.rank}/${t.max}</div>
        </div>
      `);
    }
  }

  return `
    <div class="tree">
      <div class="panel-top">
        <div class="tname">${escapeHTML(tree.name)}</div>
        <div class="pts">${tree.points || 0}</div>
      </div>
      <div class="grid">${tiles.join('')}</div>
    </div>
  `;
}

function escapeHTML(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
