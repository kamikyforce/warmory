import { scrapeWarmaneTalents } from '../scrape/warmane.js';
import { buildTalentsCard } from '../render/talentsCard.js';
import { InteractionResponseType } from 'discord-interactions';

const REALM_DEFAULT = 'Icecrown';

export const talentsCommand = {
  name: 'talents',
  description: 'Warmane-like Talents view (trees + glyphs).',
  options: [
    {
      name: 'character',
      description: 'Character name',
      type: 3, // STRING
      required: true
    },
    {
      name: 'realm',
      description: 'Realm (Icecrown, Lordaeron, etc.)',
      type: 3, // STRING
      required: false
    }
  ],

  async execute(interaction, env) {
    const { options } = interaction.data;
    const characterName = options?.find(opt => opt.name === 'character')?.value;
    const realm = options?.find(opt => opt.name === 'realm')?.value || REALM_DEFAULT;
    
    if (!characterName) {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Character name is required.',
          flags: 64 // Ephemeral
        }
      };
    }

    try {
      const data = await scrapeWarmaneTalents({ name: characterName, realm });
      if (!data) {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Could not find **${characterName}** on **${realm}**.`
          }
        };
      }

      const card = await buildTalentsCard(data, env);
      
      // Remove the base64 conversion - send raw buffer instead
      // const cardBase64 = card.toString('base64');
      
      const treesLine = (data.trees || [])
        .map(t => `${t.name} **${t.points || 0}**`)
        .join(' • ');

      const embed = {
        color: 0x222831,
        title: `${data.charName} — ${data.raceClass}`,
        url: data.talentsUrl,
        description: treesLine,
        image: {
          url: 'attachment://talents.png'
        },
        footer: {
          text: `Warmane-style • ${realm}`
        }
      };

      const components = [
        {
          type: 1, // ACTION_ROW
          components: [
            {
              type: 2, // BUTTON
              style: 5, // LINK
              label: 'Open Talents',
              url: data.talentsUrl
            },
            {
              type: 2, // BUTTON  
              style: 5, // LINK
              label: 'Open Armory',
              url: data.profileUrl
            }
          ]
        }
      ];

      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed],
          files: [{
            name: 'talents.png',
            data: card  // Send raw buffer instead of cardBase64
          }],
          components
        }
      };
    } catch (error) {
      console.error('Talents command error:', error);
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Sorry, I couldn\'t fetch the character data. Please try again later.',
          flags: 64 // Ephemeral
        }
      };
    }
  }
};

export default talentsCommand;
