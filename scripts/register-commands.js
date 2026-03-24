import dotenv from 'dotenv';

dotenv.config();

const commands = [
  {
    name: 'armory',
    description: 'Look up character armory information',
    options: [
      {
        name: 'character',
        description: 'Character name',
        type: 3, // STRING
        required: true
      },
      {
        name: 'realm',
        description: 'Realm name',
        type: 3, // STRING
        required: false,
        choices: [
          { name: 'Lordaeron', value: 'lordaeron' },
          { name: 'Icecrown', value: 'icecrown' },
          { name: 'Frostmourne', value: 'frostmourne' }
        ]
      }
    ]
  },
  {
    name: 'talents',
    description: 'Look up character talent information',
    options: [
      {
        name: 'character',
        description: 'Character name',
        type: 3, // STRING
        required: true
      },
      {
        name: 'realm',
        description: 'Realm name',
        type: 3, // STRING
        required: false,
        choices: [
          { name: 'Lordaeron', value: 'lordaeron' },
          { name: 'Icecrown', value: 'icecrown' },
          { name: 'Frostmourne', value: 'frostmourne' }
        ]
      }
    ]
  },
  {
    name: 'uwulogs',
    description: 'UwU Logs points for a character/spec',
    options: [
      { name: 'name', description: 'Character name', type: 3, required: true },
      { name: 'server', description: 'Server', type: 3, required: false },
      { name: 'spec', description: 'Spec (1-3 or name: blood, frost, unholy, etc.)', type: 3, required: false }
    ]
  }
];

async function registerCommands() {
  try {
    const appId = process.env.DISCORD_CLIENT_ID;
    const token = process.env.DISCORD_TOKEN;
    const guildId = process.env.GUILD_ID;

    if (!appId || !token) {
      console.error('Missing DISCORD_CLIENT_ID or DISCORD_TOKEN');
      process.exit(1);
    }

    const base = `https://discord.com/api/v10/applications/${appId}`;
    const url = guildId ? `${base}/guilds/${guildId}/commands` : `${base}/commands`;

    console.log(guildId
      ? `Registering guild commands for guild ${guildId}...`
      : 'Registering global commands...');

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (response.ok) {
      console.log(guildId ? 'Guild commands registered.' : 'Global commands registered.');
    } else {
      const errorText = await response.text();
      console.error('Failed to register commands:', response.status, errorText);
    }
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

registerCommands();
