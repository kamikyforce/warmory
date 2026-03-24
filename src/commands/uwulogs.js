import { InteractionResponseType } from 'discord-interactions';
import { scrapeUwULogs } from '../scrape/uwulogs.js';
import { buildUwULogsCard } from '../render/uwulogsCard.js';

const SERVER_DEFAULT = 'Icecrown';
const SPEC_DEFAULT = 1;

export const uwulogsCommand = {
  name: 'uwulogs',
  description: 'UwU Logs points for a character/spec',
  options: [
    { name: 'name', description: 'Character name', type: 3, required: true },
    { name: 'server', description: 'Server', type: 3, required: false },
    { name: 'spec', description: 'Spec number (1-3)', type: 4, required: false }
  ],
  async execute(interaction, env) {
    const opts = interaction.data?.options || [];
    const name = opts.find(o => o.name === 'name')?.value;
    const server = opts.find(o => o.name === 'server')?.value || SERVER_DEFAULT;
    const spec = Number(opts.find(o => o.name === 'spec')?.value || SPEC_DEFAULT);
    if (!name) {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'name required', flags: 64 }
      };
    }
    try {
      const raw = await scrapeUwULogs({ name, server, spec });
      const card = await buildUwULogsCard(raw, env);
      const overall = (raw.overallPoints / 100).toFixed(2);
      const url = `https://uwu-logs.xyz/character?name=${encodeURIComponent(name)}&server=${encodeURIComponent(server)}&spec=${spec}`;
      const embed = {
        color: 0x7b68ee,
        title: `${raw.name} — ${raw.server}`,
        url,
        description: `Overall ${overall} (${raw.overallRank || 0})`,
        image: { url: 'attachment://uwu.png' }
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
          files: [{ name: 'uwu.png', data: card }],
          components
        }
      };
    } catch (e) {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'failed to fetch uwu logs', flags: 64 }
      };
    }
  }
};

export default uwulogsCommand;
