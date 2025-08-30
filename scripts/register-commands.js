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
  }
];

async function registerCommands() {
  try {
    console.log('Started refreshing application (/) commands.');
    
    const response = await fetch(
      `https://discord.com/api/v10/applications/${process.env.DISCORD_CLIENT_ID}/commands`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commands),
      }
    );
    
    if (response.ok) {
      console.log('Successfully reloaded application (/) commands.');
    } else {
      const errorText = await response.text();
      console.error('Failed to register commands:', response.status, errorText);
    }
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

registerCommands();