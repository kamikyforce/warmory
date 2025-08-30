// src/render/armoryCard.js
import axios from 'axios';
import { createCanvas, loadImage } from 'canvas';

/**
 * Estilo Warmane com textos:
 *  Esquerda: Head, Neck, Shoulder, Back, Chest, Shirt, Tabard, Wrist
 *  Direita : Hands, Waist, Legs, Feet, Ring1, Ring2, Trinket1, Trinket2
 *  Armas   : MainHand, OffHand, Ranged (centralizadas na base)
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

const QCOLOR = {
  Legendary:'#ff8000', Epic:'#a335ee', Rare:'#0070dd', Uncommon:'#1eff00',
  Artifact:'#e6cc80', Heirloom:'#e6cc80', Poor:'#9d9d9d', Common:'#8a8f98'
};

/* ---------- Medidas ---------- */
const W = 1000;
const H = 1000;
const P = 24;

const ICON = 52;
const TEXT_W = 230;
const SLOT_W = ICON + 12 + TEXT_W;     // largura de cada “caixa” (ícone + textos)
const SLOT_H = 74;                      // altura suficiente p/ 2 linhas + ilvl
const GAP_Y  = 12;

const COLX_L = P;
const COLX_R = W - P - SLOT_W;
const TOP_Y  = 140;

const WEAP_Y = H - P - SLOT_H;         // armas embaixo
const WEAP_GAP = 14;

/* ---------- Tipografia ---------- */
const FONT_LABEL   = '13px Inter, Helvetica, Arial, sans-serif';
const FONT_NAME    = '14px Inter, Helvetica, Arial, sans-serif';
const FONT_ILVL    = '13px Inter, Helvetica, Arial, sans-serif';
const LINE_H       = 18;

export async function buildArmoryCard({
  charName, raceClass, specText, gearSlots, thumbUrl
}) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  drawBackground(ctx);

  // Header
  ctx.fillStyle = '#d8c88b';
  ctx.font = 'bold 42px Inter, Helvetica, Arial, sans-serif';
  ctx.fillText(charName, P, 58);

  ctx.fillStyle = '#9aa1a7';
  ctx.font = '18px Inter, Helvetica, Arial, sans-serif';
  ctx.fillText(raceClass, P + 6, 88);

  // Spec (opcional, estilo Warmane coloca no topo)
  if (specText) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Inter, Helvetica, Arial, sans-serif';
    const t = `Spec: ${specText}`;
    const w = ctx.measureText(t).width;
    ctx.fillText(t, (W - w) / 2, 112);
  }

  // Retrato
  if (thumbUrl) {
    try {
      const img = await loadImage(await fetchImage(thumbUrl));
      ctx.save();
      roundedRect(ctx, W - P - 84, P, 78, 78, 10); ctx.clip();
      ctx.drawImage(img, W - P - 84, P, 78, 78);
      ctx.restore();
      ctx.strokeStyle = '#2b2f36';
      ctx.lineWidth = 2;
      roundedRect(ctx, W - P - 84, P, 78, 78, 10);
      ctx.stroke();
    } catch {}
  }

  // Títulos das colunas
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Inter, Helvetica, Arial, sans-serif';
  ctx.fillText('Equipment', COLX_L, TOP_Y - 18);
  ctx.fillText('Equipment', COLX_R, TOP_Y - 18);
  ctx.fillText('Weapons', (W - 120) / 2, WEAP_Y - 12);

  // Coluna esquerda
  for (let i = 0; i < SLOT_LEFT.length; i++) {
    const slot = SLOT_LEFT[i];
    const item = gearSlots?.[slot] || null;
    await drawSlot(ctx, COLX_L, TOP_Y + i * (SLOT_H + GAP_Y), slot, item);
  }

  // Coluna direita
  for (let i = 0; i < SLOT_RIGHT.length; i++) {
    const slot = SLOT_RIGHT[i];
    const item = gearSlots?.[slot] || null;
    await drawSlot(ctx, COLX_R, TOP_Y + i * (SLOT_H + GAP_Y), slot, item);
  }

  // Armas (3 caixas centralizadas)
  const totalW = SLOT_W * 3 + WEAP_GAP * 2;
  const startX = Math.round((W - totalW) / 2);
  for (let i = 0; i < SLOT_WEAP.length; i++) {
    const slot = SLOT_WEAP[i];
    const item = gearSlots?.[slot] || null;
    await drawSlot(ctx, startX + i * (SLOT_W + WEAP_GAP), WEAP_Y, slot, item);
  }

  return canvas.toBuffer('image/png');
}

/* ---------- desenho de um slot (ícone + textos) ---------- */
async function drawSlot(ctx, x, y, slot, item) {
  // container
  ctx.fillStyle = '#0f1116';
  ctx.strokeStyle = '#1e232b';
  ctx.lineWidth = 1;
  roundedRect(ctx, x - 6, y - 6, SLOT_W + 12, SLOT_H + 12, 12);
  ctx.fill();
  ctx.stroke();

  // sombra sutil
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  roundedRect(ctx, x - 6, y - 6, SLOT_W + 12, SLOT_H + 12, 12);
  ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fill();
  ctx.restore();

  // ícone com borda por qualidade
  await drawIcon(ctx, {
    x, y, size: ICON,
    iconUrl: item?.icon,
    quality: item?.quality
  });

  // textos
  const textX = x + ICON + 12;

  // label do slot
  ctx.font = FONT_LABEL;
  ctx.fillStyle = '#8b949e';
  ctx.fillText(`${LABEL[slot] || slot}:`, textX, y + 16);

  // nome (até 2 linhas + ellipsis)
  const name = item?.name || (item?.itemId ? `Item ${item.itemId}` : '—');
  const lines = splitTwoLines(ctx, name, TEXT_W);

  ctx.font = FONT_NAME;
  ctx.fillStyle = '#c9d1d9';
  const nameBaseY = y + 34;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], textX, nameBaseY + i * LINE_H);
  }

  // ilvl sempre abaixo do nome
  if (item?.ilvl) {
    ctx.font = FONT_ILVL;
    ctx.fillStyle = '#7aa2ff';
    const ilvlY = Math.min(y + SLOT_H - 8, nameBaseY + lines.length * LINE_H + 8);
    ctx.fillText(`ilvl ${item.ilvl}`, textX, ilvlY);
  }
}

/* ---------- ícone com qualidade ---------- */
async function drawIcon(ctx, { x, y, size, iconUrl, quality }) {
  // fundo do slot
  ctx.fillStyle = '#1a1d22';
  roundedRect(ctx, x, y, size, size, 6);
  ctx.fill();

  // imagem
  if (iconUrl) {
    try {
      const img = await loadImage(await fetchImage(iconUrl));
      ctx.save();
      roundedRect(ctx, x + 3, y + 3, size - 6, size - 6, 4); ctx.clip();
      ctx.drawImage(img, x + 3, y + 3, size - 6, size - 6);
      ctx.restore();
    } catch {}
  }

  // borda por qualidade
  ctx.strokeStyle = QCOLOR[quality] || QCOLOR.Common;
  ctx.lineWidth = 3;
  roundedRect(ctx, x + 0.5, y + 0.5, size - 1, size - 1, 6);
  ctx.stroke();
}

/* ---------- base ---------- */
function drawBackground(ctx) {
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#0b0d10');
  grd.addColorStop(1, '#111418');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#272b31';
  ctx.lineWidth = 2;
  roundedRect(ctx, 6, 6, W - 12, H - 12, 14);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  roundedRect(ctx, 10, 10, W - 20, H - 20, 12);
  ctx.fill();
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- texto helpers ---------- */
function splitTwoLines(ctx, text, maxWidth) {
  if (!text) return ['—'];
  ctx.font = FONT_NAME;

  // tenta caber na 1ª linha
  const words = text.split(' ');
  let line1 = '';
  for (let i = 0; i < words.length; i++) {
    const t = line1 ? `${line1} ${words[i]}` : words[i];
    if (ctx.measureText(t).width <= maxWidth) {
      line1 = t;
    } else {
      // sobra vira segunda
      const rest = words.slice(i).join(' ');
      return [line1, ellipsize(ctx, rest, maxWidth)];
    }
  }
  return [line1];
}

function ellipsize(ctx, s, maxWidth) {
  if (ctx.measureText(s).width <= maxWidth) return s;
  let out = s;
  while (out.length && ctx.measureText(out + '...').width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out.length ? out + '...' : '...';
}

/* ---------- imagens ---------- */
async function fetchImage(url) {
  const safe = url?.startsWith('http') ? url.replace(/^http:/, 'https:') : (url ? `https:${url}` : null);
  if (!safe) throw new Error('no icon url');
  const res = await axios.get(safe, {
    responseType: 'arraybuffer',
    timeout: 15000,
    headers: { 'User-Agent': 'Warmane Armory Bot' }
  });
  return Buffer.from(res.data);
}
