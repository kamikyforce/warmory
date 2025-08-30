import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';
import { armoryCommand } from './commands/armory.js';
import { talentsCommand } from './commands/talents.js';
import { initializeTables } from './scrape/warmane.js';

export default {
  async fetch(request, env, ctx) {
    // Initialize database tables on startup
    ctx.waitUntil(initializeTables(env));
    
    // Handle Discord interactions via webhooks
    if (request.method === 'POST') {
      const signature = request.headers.get('x-signature-ed25519');
      const timestamp = request.headers.get('x-signature-timestamp');
      const body = await request.text();
      
      // Verify Discord signature using the public key from environment
      const isValidRequest = verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
      if (!isValidRequest) {
        return new Response('Bad request signature', { status: 401 });
      }
      
      const interaction = JSON.parse(body);
      
      // Handle ping
      if (interaction.type === InteractionType.PING) {
        return new Response(JSON.stringify({ type: InteractionResponseType.PONG }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Handle application commands
      if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        const { name } = interaction.data;
        
        try {
          // Send immediate deferred response to prevent timeout
          const deferredResponse = {
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
          };
          
          // Process command in background and send followup
          ctx.waitUntil(processCommandAsync(interaction, env, name));
          
          return new Response(JSON.stringify(deferredResponse), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Command execution error:', error);
          return new Response(JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: 'An error occurred while processing your request.' }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
    
    return new Response('Hello from Warmane Armory Bot!', { status: 200 });
  }
};

// Process command asynchronously and send followup message
async function processCommandAsync(interaction, env, commandName) {
  try {
    let result;
    
    switch (commandName) {
      case 'armory':
        result = await armoryCommand.execute(interaction, env);
        break;
      case 'talents':
        result = await talentsCommand.execute(interaction, env);
        break;
      default:
        result = {
          content: 'Unknown command'
        };
    }
    
    // Send followup message with the actual result
    await sendFollowupMessage(interaction, env, result.data);
  } catch (error) {
    console.error('Async command processing error:', error);
    await sendFollowupMessage(interaction, env, {
      content: 'An error occurred while processing your request.'
    });
  }
}

// Send followup message to Discord
async function sendFollowupMessage(interaction, env, messageData) {
  const followupUrl = `https://discord.com/api/v10/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;
  
  let response;
  
  // Check if message has file attachments
  if (messageData.files && messageData.files.length > 0) {
    // Use FormData for file uploads
    const formData = new FormData();
    
    // Add the JSON payload
    const payload = {
      embeds: messageData.embeds,
      components: messageData.components
    };
    formData.append('payload_json', JSON.stringify(payload));
    
    // Add file attachments
    messageData.files.forEach((file, index) => {
      const blob = new Blob([file.data], { type: 'image/png' });
      formData.append(`files[${index}]`, blob, file.name);
    });
    
    response = await fetch(followupUrl, {
      method: 'POST',
      body: formData
    });
  } else {
    // Use JSON for text-only messages
    response = await fetch(followupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData)
    });
  }
  
  if (!response.ok) {
    console.error('Failed to send followup message:', await response.text());
  }
}