import {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} from 'discord.js';
import { scrapeWarmaneTalents } from '../scrape/warmane.js';
import { buildTalentsCard } from '../render/talentsCard.js';

const REALM_DEFAULT = 'Icecrown';

export default {
  data: new SlashCommandBuilder()
    .setName('talents')
    .setDescription('Warmane-like Talents view (trees + glyphs).')
    .addStringOption(o => o.setName('character').setDescription('Character name').setRequired(true))
    .addStringOption(o => o.setName('realm').setDescription('Realm (Icecrown, Lordaeron, etc.)')),
  async execute(interaction) {
    const name  = interaction.options.getString('character', true).trim();
    const realm = (interaction.options.getString('realm') || REALM_DEFAULT).trim();

    await interaction.deferReply();

    const data = await scrapeWarmaneTalents({ name, realm });
    if (!data) {
      return interaction.editReply(`Could not find **${name}** on **${realm}**.`);
    }

    const card = await buildTalentsCard(data);
    const file = new AttachmentBuilder(card, { name: 'talents.png' });

    const treesLine = (data.trees || [])
      .map(t => `${t.name} **${t.points || 0}**`)
      .join(' • ');

    const embed = new EmbedBuilder()
      .setColor(0x222831)
      .setTitle(`${data.charName} — ${data.raceClass}`)
      .setURL(data.talentsUrl)
      .setDescription(treesLine)
      .setImage('attachment://talents.png')
      .setFooter({ text: `Warmane-style • ${realm}` });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open Talents').setURL(data.talentsUrl),
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open Armory').setURL(data.profileUrl)
    );

    await interaction.editReply({ embeds: [embed], files: [file], components: [buttons] });
  }
};
