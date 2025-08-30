import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { scrapeWarmaneArmory } from '../scrape/warmane.js';
import { buildArmoryCard } from '../render/armoryCard.js';

const REALM_DEFAULT = 'Icecrown';

export default {
  data: new SlashCommandBuilder()
    .setName('armory')
    .setDescription('Warmane-like Armory view (gear, stats, icons, spec).')
    .addStringOption(o => o.setName('character').setDescription('Character name').setRequired(true))
    .addStringOption(o => o.setName('realm').setDescription('Realm (Icecrown, Lordaeron, etc.)')),

  async execute(interaction) {
    const name  = interaction.options.getString('character', true).trim();
    const realm = (interaction.options.getString('realm') || REALM_DEFAULT).trim();

    await interaction.deferReply();

    const data = await scrapeWarmaneArmory({ name, realm });
    if (!data) return interaction.editReply(`Could not find **${name}** on **${realm}**.`);

    const card = await buildArmoryCard(data);
    const file = new AttachmentBuilder(card, { name: 'armory.png' });

    const embed = new EmbedBuilder()
      .setColor(0x222831)
      .setTitle(`${data.charName} — ${data.raceClass}`)
      .setURL(data.profileUrl)
      .setDescription(data.specText ? `**Spec:** ${data.specText}` : null)
      .setImage('attachment://armory.png')
      .setFooter({ text: `Warmane-style • ${realm}` });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open Armory').setURL(data.profileUrl),
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Talents').setURL(data.profileUrl.replace('/summary', '/talents'))
    );

    await interaction.editReply({ embeds: [embed], files: [file], components: [buttons] });
  }
};
