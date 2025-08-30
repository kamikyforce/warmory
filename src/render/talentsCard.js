// src/render/talentsCard.js
import axios from 'axios';
import { createCanvas, loadImage } from 'canvas';

const W = 1200;
const H = 900;
const P = 24;

const TREE_W = 260;
const TREE_H = 640;
const TREE_GAP = 36;

const TILE = 52;
const ROW_GAP = 10;
const COL_GAP = 10;

const GLYPH_COL_W = 288;

// >>> NOVO: gap fixo a mais entre a 3ª árvore e a coluna de glyphs
const TREE_GLYPH_GAP = 48; // gap maior para mais distância

const GOLD = '#d8c88b';

export async function buildTalentsCard({
  charName, raceClass, profileUrl, talentsUrl,
  specName,
  trees,
  glyphs,
  points,
  thumbUrl
}) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // fundo / moldura
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#0b0d10');
  grd.addColorStop(1, '#111418');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#272b31'; ctx.lineWidth = 2;
  roundedRect(ctx, 6, 6, W-12, H-12, 14); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  roundedRect(ctx, 10, 10, W-20, H-20, 12); ctx.fill();

  // header
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 42px Inter, Helvetica, Arial, sans-serif';
  ctx.fillText(charName, P, 58);
  ctx.fillStyle = '#9aa1a7';
  ctx.font = '18px Inter, Helvetica, Arial, sans-serif';
  ctx.fillText(raceClass, P + 6, 88);

  // portrait
  if (thumbUrl) {
    try {
      const img = await loadImage(await fetchImage(thumbUrl));
      ctx.save(); roundedRect(ctx, W - P - 84, P, 78, 78, 10); ctx.clip();
      ctx.drawImage(img, W - P - 84, P, 78, 78); ctx.restore();
      ctx.strokeStyle = '#2b2f36'; ctx.lineWidth = 2;
      roundedRect(ctx, W - P - 84, P, 78, 78, 10); ctx.stroke();
    } catch {}
  }

  // árvores (3 colunas) + coluna de glyphs
  const treeAreaW = TREE_W * 3 + TREE_GAP * 2;

  // largura "livre": tudo que sobra depois de árvores + glyphs + gap extra
  const freeW = W - P * 2 - GLYPH_COL_W - TREE_GLYPH_GAP - treeAreaW;

  // em vez de centralizar perfeitamente, usamos só 25% do espaço livre à esquerda.
  // Isso empurra visualmente as árvores para a esquerda, aumentando o vão à direita.
  const startX = P + Math.max(0, Math.floor(freeW * 0.25));

  // totais centralizados acima de cada árvore
  const headerY = 126;
  ctx.font = '14px Inter, Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#b0b6bd';
  for (let t = 0; t < 3; t++) {
    const tree = trees[t];
    const colX = startX + t * (TREE_W + TREE_GAP);
    const center = colX + TREE_W / 2;
    const chip = `${tree.name} ${tree.points || 0}`;
    const tw = ctx.measureText(chip).width;
    ctx.fillText(chip, Math.round(center - tw / 2), headerY);
  }

  // desenha árvores
  for (let t = 0; t < 3; t++) {
    const tree = trees[t];
    const x0 = startX + t * (TREE_W + TREE_GAP);
    const y0 = 150;

    // moldura
    ctx.strokeStyle = '#262a30';
    ctx.lineWidth = 1.5;
    roundedRect(ctx, x0 - 8, y0 - 8, TREE_W + 16, TREE_H + 16, 12);
    ctx.stroke();

    // título + pontos (esq/dir)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Inter, Helvetica, Arial, sans-serif';
    ctx.fillText(tree.name, x0, y0 - 12);

    ctx.fillStyle = '#c9d1d9';
    ctx.font = '13px Inter, Helvetica, Arial, sans-serif';
    const pts = String(tree.points || 0);
    const ptsW = ctx.measureText(pts).width;
    ctx.fillText(pts, x0 + TREE_W - ptsW, y0 - 12);

    // tiles
    const rowHeight = TILE + ROW_GAP;
    for (let row = 0; row < tree.tiers.length; row++) {
      const tier = tree.tiers[row];
      for (const talent of tier) {
        const x = x0 + talent.xy.col * (TILE + COL_GAP);
        const y = y0 + row * rowHeight;
        await drawTalentTile(ctx, {
          x, y, size: TILE,
          iconUrl: talent.icon,
          state: talent.state,
          rank: talent.rank,
          max: talent.max
        });
      }
    }
  }

  // ===== GLYPHS (coluna direita com folga real) =====
  const gx = W - P - GLYPH_COL_W;
  let gy = 150;

  // Major
  gy = drawGlyphBlock(ctx, {
    x: gx, y: gy,
    title: 'Major Glyphs',
    items: glyphs?.major || [],
    // padding interno maior para não “colar” na borda direita
    maxWidth: GLYPH_COL_W - 24, // antes -8
    fontSize: 13,               // 13px deixa mais espaço horizontal
    lineHeight: 21,             // um tiquinho mais alto
    bulletIndent: 18
  });

  gy += 14;

  // Minor
  gy = drawGlyphBlock(ctx, {
    x: gx, y: gy,
    title: 'Minor Glyphs',
    items: glyphs?.minor || [],
    maxWidth: GLYPH_COL_W - 24,
    fontSize: 13,
    lineHeight: 21,
    bulletIndent: 18
  });

  return canvas.toBuffer('image/png');
}

// ===== helpers =====
async function drawTalentTile(ctx, { x, y, size, iconUrl, state, rank, max }) {
  const hasPoints  = rank > 0 && max > 0;
  const isMax      = hasPoints && rank === max;
  const isDisabled = state === 'disabled';

  ctx.fillStyle = '#161a20';
  roundedRect(ctx, x, y, size, size, 6); ctx.fill();

  if (iconUrl) {
    try {
      const img = await loadImage(await fetchImage(iconUrl));
      ctx.save(); roundedRect(ctx, x+3, y+3, size-6, size-6, 4); ctx.clip();
      ctx.drawImage(img, x+3, y+3, size-6, size-6); ctx.restore();
    } catch {}
  }

  if (isDisabled) {
    ctx.fillStyle = 'rgba(0,0,0,0.50)';
    roundedRect(ctx, x, y, size, size, 6); ctx.fill();
  } else if (!hasPoints) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundedRect(ctx, x, y, size, size, 6); ctx.fill();
  }

  let border = '#2b313a';
  if (!isDisabled && hasPoints) border = '#9c8a3a';
  if (!isDisabled && isMax)     border = '#d1b84b';
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  roundedRect(ctx, x+0.5, y+0.5, size-1, size-1, 6); ctx.stroke();

  ctx.fillStyle = isDisabled ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.65)';
  roundedRect(ctx, x + size - 30, y + size - 20, 26, 16, 4); ctx.fill();

  let badge = '#8b949e';
  if (!isDisabled && hasPoints && !isMax) badge = '#b9f56a';
  if (!isDisabled && isMax)               badge = '#f1e58a';

  ctx.fillStyle = badge;
  ctx.font = 'bold 12px Inter, Helvetica, Arial, sans-serif';
  const txt = `${rank}/${max}`;
  const tw = ctx.measureText(txt).width;
  ctx.fillText(txt, x + size - 17 - tw/2, y + size - 8);
}

// utilidades
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const tryLine = line ? `${line} ${w}` : w;
    if (ctx.measureText(tryLine).width <= maxWidth) {
      line = tryLine;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawGlyphBlock(
  ctx,
  { x, y, title, items, maxWidth, fontSize = 14, lineHeight = 20, bulletIndent = 16 }
) {
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 18px Inter, Helvetica, Arial, sans-serif';
  ctx.fillText(title, x, y);
  y += 22;

  ctx.fillStyle = '#c9d1d9';
  ctx.font = `${fontSize}px Inter, Helvetica, Arial, sans-serif`;

  const bullet = '• ';
  for (const item of items) {
    const firstWidth = maxWidth - ctx.measureText(bullet).width;
    const lines = wrapLines(ctx, item, firstWidth);
    if (!lines.length) continue;

    // primeira linha com bullet
    ctx.fillText(bullet + lines[0], x, y);
    y += lineHeight;

    // linhas seguintes com indent
    for (let i = 1; i < lines.length; i++) {
      ctx.fillText(lines[i], x + bulletIndent, y);
      y += lineHeight;
    }
  }
  return y;
}

async function fetchImage(url) {
  const safe = url?.startsWith('http') ? url.replace(/^http:/, 'https:') : (url ? `https:${url}` : null);
  if (!safe) return null;
  const res = await axios.get(safe, {
    responseType: 'arraybuffer',
    timeout: 15000,
    headers: { 'User-Agent': 'Warmane Armory Bot' }
  });
  return Buffer.from(res.data);
}
