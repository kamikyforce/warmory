import puppeteer from '@cloudflare/puppeteer';

export async function buildUwULogsCard(data, env, opts = {}) {
  const retries = typeof opts.retries === 'number' ? opts.retries : 2;
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let browser;
    try {
      browser = await puppeteer.launch(env.MYBROWSER, {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 900 });
      const html = generateHTML(data);
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
      const img = await page.screenshot({ type: 'png', fullPage: true, timeout: 15000 });
      return img;
    } catch (e) {
      lastErr = e;
      const msg = String(e && e.message || e);
      const isRate = msg.includes('429') || /rate limit/i.test(msg);
      if (attempt < retries && isRate) {
        await sleep(400 * Math.pow(2, attempt));
        continue;
      }
      throw e;
    } finally {
      try { if (browser) await browser.close(); } catch {}
    }
  }
  throw lastErr || new Error('render failed');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function generateHTML({ name, server, overallPoints, overallRank, bosses }) {
  const rows = (bosses || []).map(x => rowHTML(x)).join('');
  const overall = formatPoints(overallPoints);
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{width:1200px;height:900px;background:#0b0d10;color:#eaecef;font-family:Inter,Arial,Helvetica,sans-serif;border:2px solid #272b31;border-radius:14px;overflow:hidden}
      .wrap{padding:26px;height:100%}
      .header{display:flex;align-items:flex-end;justify-content:space-between}
      .title{display:flex;flex-direction:column;gap:6px}
      .name{font-size:44px;font-weight:800;color:#d8c88b}
      .server{font-size:16px;color:#9aa1a7}
      .score{display:flex;align-items:baseline;gap:8px}
      .score .val{font-size:42px;font-weight:900;color:#f4b860}
      .score .rank{font-size:14px;color:#9aa1a7}
      .table{margin-top:18px;background:#0f1116;border:1px solid #1e232b;border-radius:12px;overflow:hidden}
      table{width:100%;border-collapse:collapse}
      thead{background:#14181f}
      th,td{padding:10px 12px;font-size:14px}
      th{color:#c9d1d9;text-align:left}
      th.sticky,td.sticky{position:sticky;left:0;background:inherit;box-shadow:2px 0 0 #1e232b}
      tr:nth-child(even) td{background:#0e1217}
      .cell-points{font-weight:700;text-align:right}
      .cell-dps,.cell-dur,.cell-raids,.cell-date,.cell-rank{text-align:right;color:#c9d1d9}
      .cell-name{color:#fff}
      .top100{color:#f1c40f}
      .top99{color:#ffa62b}
      .top98{color:#ffa62b}
      .top97{color:#ff8c2b}
      .top95{color:#a335ee}
      .top90{color:#a335ee}
      .top80{color:#0070dd}
      .top70{color:#1eff00}
      .top0{color:#8b949e}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="header">
        <div class="title">
          <div class="name">${escapeHTML(name || '')}</div>
          <div class="server">${escapeHTML(server || '')}</div>
        </div>
        <div class="score">
          <div class="val">${overall}</div>
          <div class="rank">(${overallRank || 0})</div>
        </div>
      </div>
      <div class="table">
        <table>
          <thead>
            <tr>
              <th class="sticky">Boss</th>
              <th>Rank</th>
              <th>Points</th>
              <th>Best Dps</th>
              <th>Dur</th>
              <th>Kills</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  </body>
  </html>`;
}

function rowHTML(x) {
  const has = x && x.rankPlayers;
  const points = has ? formatPoints(x.points) : '0.00';
  const cls = pointsClass(x.points);
  const dps = has ? formatDps(x.dpsMax) : '';
  const dur = has ? formatDur(x.fastestKill) : '';
  const raids = has ? String(x.raids) : '';
  const date = has ? formatDate(x.reportId) : '';
  return `
  <tr>
    <td class="cell-name sticky">${escapeHTML(x.boss)}</td>
    <td class="cell-rank">${has ? splitThousands(x.rankPlayers) : ''}</td>
    <td class="cell-points ${cls}">${points}</td>
    <td class="cell-dps">${dps}</td>
    <td class="cell-dur">${dur}</td>
    <td class="cell-raids">${raids}</td>
    <td class="cell-date">${escapeHTML(date)}</td>
  </tr>`;
}

function formatPoints(v) {
  const n = typeof v === 'number' ? v : 0;
  return (n / 100).toFixed(2);
}

function pointsClass(v) {
  const p = (v || 0) / 100;
  if (p >= 100) return 'top100';
  if (p >= 99) return 'top99';
  if (p >= 98) return 'top98';
  if (p >= 97) return 'top97';
  if (p >= 95) return 'top95';
  if (p >= 90) return 'top90';
  if (p >= 80) return 'top80';
  if (p >= 70) return 'top70';
  return 'top0';
}

function formatDps(n) {
  if (!n || !isFinite(n)) return '';
  const fixed = n.toFixed(1);
  const parts = fixed.split('.');
  const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts[1] ? `${int}.${parts[1]}` : int;
}

function formatDur(sec) {
  if (!sec || !isFinite(sec)) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function splitThousands(n) {
  if (n == null) return '';
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatDate(reportId) {
  if (!reportId) return '';
  const d = reportId.slice(0, 8);
  const [yy, mm, dd] = d.split('-');
  if (!yy || !mm || !dd) return '';
  return `${dd}-${mm}-${yy}`;
}

function escapeHTML(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export default buildUwULogsCard;
