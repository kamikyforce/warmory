import { scrapeWarmaneArmory } from '../scrape/warmane.js';
import { buildArmoryCard } from '../render/armoryCard.js';
import { InteractionResponseType } from 'discord-interactions';

const REALM_DEFAULT = 'Icecrown';

export const armoryCommand = {
  name: 'armory',
  description: 'Warmane-like Armory view (gear, stats, icons, spec).',
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
      console.log('Scraping armory data for:', characterName, 'on', realm);
      const data = await scrapeWarmaneArmory({ name: characterName, realm });
      if (!data) {
        console.log('No data found for character:', characterName);
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Could not find **${characterName}** on **${realm}**.`
          }
        };
      }

      console.log('Data scraped successfully, building card...');
      const card = await buildArmoryCard(data, env);
      console.log('Card built successfully');
      
      // Don't convert to base64 - send the raw buffer
      // const cardBase64 = card.toString('base64');  // Remove this line
      console.log('Card buffer ready, size:', card.length);
      
      const embed = {
        color: 0x222831,
        title: `${data.charName} — ${data.raceClass}`,
        url: data.profileUrl,
        description: data.specText ? `**Spec:** ${data.specText}` : null,
        image: {
          url: 'attachment://armory.png'
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
              label: 'Open Armory',
              url: data.profileUrl
            },
            {
              type: 2, // BUTTON  
              style: 5, // LINK
              label: 'Talents',
              url: data.profileUrl.replace('/summary', '/talents')
            }
          ]
        }
      ];

      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed],
          files: [{
            name: 'armory.png',
            data: card  // Send raw buffer instead of base64
          }],
          components
        }
      };
    } catch (error) {
      console.error('Armory command error:', error);
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

export default armoryCommand;
