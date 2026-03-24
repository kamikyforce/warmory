import { InteractionResponseType } from 'discord-interactions';
import { scrapeUwULogs } from '../scrape/uwulogs.js';
import { buildUwULogsCard } from '../render/uwulogsCard.js';

const SERVER_DEFAULT = 'Icecrown';
const SPEC_DEFAULT = 1;

const CLASS_SPEC_ALIASES = [
  [ ['blood'], ['frost'], ['unholy'] ],                                                        // Death Knight (0)
  [ ['balance'], ['feral','feral combat'], ['restoration','resto'] ],                          // Druid (1)
  [ ['beast mastery','bm'], ['marksmanship','mm'], ['survival','surv'] ],                      // Hunter (2)
  [ ['arcane'], ['fire'], ['frost'] ],                                                         // Mage (3)
  [ ['holy'], ['protection','prot'], ['retribution','ret'] ],                                  // Paladin (4)
  [ ['discipline','disc'], ['holy'], ['shadow'] ],                                             // Priest (5)
  [ ['assassination','assass'], ['combat'], ['subtlety','sub'] ],                              // Rogue (6)
  [ ['elemental','ele'], ['enhancement','enh'], ['restoration','resto'] ],                     // Shaman (7)
  [ ['affliction','aff'], ['demonology','demo'], ['destruction','destro'] ],                   // Warlock (8)
  [ ['arms'], ['fury'], ['protection','prot'] ],                                               // Warrior (9)
];

function normSpec(s) {
  return String(s || '').toLowerCase().replace(/\s+/g,' ').trim();
}
function specIndexFromName(specInput, classIndex) {
  const s = normSpec(specInput);
  if (!s) return null;
  // class specific first
  if (Number.isInteger(classIndex) && classIndex >= 0 && classIndex < CLASS_SPEC_ALIASES.length) {
    const specLists = CLASS_SPEC_ALIASES[classIndex];
    for (let i = 0; i < 3; i++) {
      const aliases = specLists[i] || [];
      if (aliases.some(alias => normSpec(alias) === s)) return i + 1;
    }
  }
  // global fallback matching common aliases
  const GLOBAL = {
    'blood':1,'unholy':3,
    'balance':1,'feral':2,'feral combat':2,'resto':3,
    'bm':1,'beast mastery':1,'marksmanship':2,'mm':2,'survival':3,'surv':3,
    'arcane':1,'fire':2,
    'retribution':3,'ret':3,
    'discipline':1,'disc':1,'shadow':3,'holy':2,
    'assassination':1,'assass':1,'combat':2,'subtlety':3,'sub':3,
    'elemental':1,'ele':1,'enhancement':2,'enh':2,
    'affliction':1,'aff':1,'demonology':2,'demo':2,'destruction':3,'destro':3,
    'arms':1,'fury':2
  };
  return GLOBAL[s] || null;
}

export const uwulogsCommand = {
  name: 'uwulogs',
  description: 'UwU Logs points for a character/spec',
  options: [
    { name: 'name', description: 'Character name', type: 3, required: true },
    { name: 'server', description: 'Server', type: 3, required: false },
    { name: 'spec', description: 'Spec (1-3 or name like: blood, frost, unholy)', type: 3, required: false }
  ],
  async execute(interaction, env) {
    const opts = interaction.data?.options || [];
    const name = opts.find(o => o.name === 'name')?.value;
    const server = opts.find(o => o.name === 'server')?.value || SERVER_DEFAULT;
    const rawSpec = opts.find(o => o.name === 'spec')?.value;
    let spec = null;
    if (rawSpec == null || rawSpec === '') {
      spec = SPEC_DEFAULT;
    } else if (/^\d+$/.test(String(rawSpec))) {
      const n = Number(rawSpec);
      spec = n >= 1 && n <= 3 ? n : SPEC_DEFAULT;
    } else {
      spec = null; // will compute after first fetch using class_i
    }
    if (!name) {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'name required', flags: 64 }
      };
    }
    try {
      let raw = await scrapeUwULogs({ name, server, spec: spec || undefined });
      if (spec == null && raw?.classIndex != null) {
        const idx = specIndexFromName(rawSpec, raw.classIndex);
        if (idx) {
          spec = idx;
          raw = await scrapeUwULogs({ name, server, spec });
        } else {
          spec = SPEC_DEFAULT;
          raw = await scrapeUwULogs({ name, server, spec });
        }
      }
      let card = null;
      try {
        card = await buildUwULogsCard(raw, env, { retries: 2 });
      } catch (e) {
        console.error('uwulogs render error', e);
      }
      const overall = (raw.overallPoints / 100).toFixed(2);
      const linkSpec = Number.isInteger(raw?.usedSpec) ? raw.usedSpec : (Number.isInteger(spec) ? spec : SPEC_DEFAULT);
      const url = `https://uwu-logs.xyz/character?name=${encodeURIComponent(name)}&server=${encodeURIComponent(server)}&spec=${linkSpec}`;
      const embed = {
        color: 0x7b68ee,
        title: `${raw.name} — ${raw.server}`,
        url,
        description: `Overall ${overall} (${raw.overallRank || 0})`,
        image: card ? { url: 'attachment://uwu.png' } : undefined,
        fields: !card ? (raw.bosses || []).slice(0, 10).map(b => ({
          name: b.boss,
          value: `rank ${b.rankPlayers || 0} • pts ${(b.points/100).toFixed(2)} • dps ${Math.round(b.dpsMax || 0)}`
        })) : undefined
      };
      const components = [
        {
          type: 1,
          components: [
            { type: 2, style: 5, label: 'Open UwU Logs', url }
          ]
        }
      ];
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed],
          files: card ? [{ name: 'uwu.png', data: card }] : undefined,
          components
        }
      };
    } catch (e) {
      console.error('uwulogs execute error', e);
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'failed to fetch uwu logs', flags: 64 }
      };
    }
  }
};

export default uwulogsCommand;
