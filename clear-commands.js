import 'dotenv/config';
import { REST, Routes } from 'discord.js';

async function clearCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const appId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  try {
    console.log('Limpando comandos...');

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: [] });
      console.log('✅ Comandos do guild limpos');
    }

    await rest.put(Routes.applicationCommands(appId), { body: [] });
    console.log('✅ Comandos globais limpos');

    console.log('✨ Limpeza concluída!');
  } catch (error) {
    console.error('Erro ao limpar comandos:', error);
  }

  process.exit(0);
}

clearCommands();
