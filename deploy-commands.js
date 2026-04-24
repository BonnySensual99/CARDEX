// ============================================================
// deploy-commands.js
// Script ONE-SHOT para registrar los slash commands en Discord.
// Ejecutar con: npm run deploy
//
// Para DESARROLLO usa Routes.applicationGuildCommands (instantáneo).
// Para PRODUCCIÓN cambia a Routes.applicationCommands (hasta 1 hora).
// ============================================================

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

// Verificar que las variables de entorno obligatorias estén definidas
const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('[DEPLOY] ❌ Faltan variables de entorno. Revisa tu archivo .env');
  process.exit(1);
}

// Recopilar las definiciones JSON de todos los comandos
const comandos      = [];
const comandosPath  = path.join(__dirname, 'commands');
const archivos      = fs.readdirSync(comandosPath).filter(f => f.endsWith('.js'));

for (const archivo of archivos) {
  const comando = require(path.join(comandosPath, archivo));
  if (comando.data) {
    comandos.push(comando.data.toJSON());
    console.log(`[DEPLOY] Comando preparado: /${comando.data.name}`);
  }
}

// Instanciar el cliente REST de Discord
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`[DEPLOY] Registrando ${comandos.length} comando(s) slash...`);

    // ── Registro en un servidor específico (desarrollo) ──────
    // Los cambios son INSTANTÁNEOS. Perfecto para pruebas.
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: comandos }
    );

    // ── Registro global (producción) ─────────────────────────
    // Descomenta las dos líneas siguientes y comenta las de arriba
    // cuando quieras desplegar en TODOS los servidores donde esté el bot.
    // Los cambios pueden tardar hasta 1 hora en propagarse.
    //
    // await rest.put(
    //   Routes.applicationCommands(CLIENT_ID),
    //   { body: comandos }
    // );

    console.log('[DEPLOY] ✅ Comandos registrados correctamente.');
  } catch (error) {
    console.error('[DEPLOY] ❌ Error al registrar los comandos:', error);
    process.exit(1);
  }
})();
