import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, Collection } from 'discord.js';
import pino from 'pino';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Configuração segura do logger
let logConfig = { level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' };

// Tenta usar pino-pretty apenas se estiver disponível
if (process.env.NODE_ENV !== 'production') {
  try {
    await import('pino-pretty');
    logConfig.transport = { target: 'pino-pretty' };
  } catch {
    // pino-pretty não disponível, usa formato padrão
  }
}

const log = pino(logConfig);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===== carregar comandos =====
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
const slashBodies = [];
for (const file of commandFiles) {
  const cmd = (await import(`./commands/${file}`)).default;
  client.commands.set(cmd.data.name, cmd);
  slashBodies.push(cmd.data.toJSON());
}

// ===== registrar comandos =====
async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const appId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!appId) throw new Error('DISCORD_CLIENT_ID é obrigatório');

  if (guildId) {
    log.info(`Registrando slash commands no guild ${guildId}...`);
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: slashBodies });
    log.info('Slash commands registrados no guild.');
  } else {
    log.info('Registrando slash commands globalmente...');
    await rest.put(Routes.applicationCommands(appId), { body: slashBodies });
    log.info('Slash commands registrados globalmente.');
  }
}

// ===== modos =====
if (process.argv.includes('--register')) {
  registerSlashCommands()
    .then(() => {
      log.info('Comandos registrados com sucesso!');
      process.exit(0);
    })
    .catch(err => {
      log.error(err, 'Falha ao registrar slash commands.');
      process.exit(1);
    });
} else {
  // normal bot mode
  client.once('clientReady', async () => {
    log.info(`Logado como ${client.user.tag}`);
  });

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      log.error(err);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: '❌ Erro ao executar o comando.', flags: 64 });
        } else {
          await interaction.reply({ content: '❌ Erro ao executar o comando.', flags: 64 });
        }
      } catch (replyErr) {
        log.error(replyErr, 'Erro ao responder com mensagem de erro');
      }
    }
  });

  if (!process.env.DISCORD_TOKEN) {
    log.error('DISCORD_TOKEN ausente no .env');
    process.exit(1);
  }

  client.login(process.env.DISCORD_TOKEN);
}
