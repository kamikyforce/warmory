import 'dotenv/config';

async function clearCommands() {
  const appId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.GUILD_ID;
  const token = process.env.DISCORD_TOKEN;

  try {
    console.log('Limpando comandos...');

    if (!appId || !token) {
      console.error('Missing DISCORD_CLIENT_ID or DISCORD_TOKEN');
      process.exit(1);
    }

    if (guildId) {
      const url = `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`;
      const r = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([])
      });
      if (!r.ok) throw new Error(`guild clear failed ${r.status} ${await r.text()}`);
      console.log('✅ Comandos do guild limpos');
    }

    {
      const url = `https://discord.com/api/v10/applications/${appId}/commands`;
      const r = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([])
      });
      if (!r.ok) throw new Error(`global clear failed ${r.status} ${await r.text()}`);
      console.log('✅ Comandos globais limpos');
    }

    console.log('✨ Limpeza concluída!');
  } catch (error) {
    console.error('Erro ao limpar comandos:', error);
  }

  process.exit(0);
}

clearCommands();
