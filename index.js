// ============================================================
// index.js
// Punto de entrada del bot Cardex.
// Gestiona comandos, autocompletado y todos los botones.
// ============================================================

require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const {
  inicializarDB,
  reclamarRoll,
  obtenerPerfil,
  sumarCreditos,
  setCocheActivo,
  incrementarRolls,
  verificarLimiteRolls,
} = require('./database/db');

const { cancelarExpiracion } = require('./utils/rollsActivos');
const { COLORES, RAREZA, TIERS_DESC,
  FOOTER, COLOR_ERROR,
  COLOR_EXITO, SEP, fmtNum, getTierEmoji, getTierURL, getTrophyEmoji, getMoneyEmoji } = require('./utils/constants');
const { getCarImage } = require('./utils/images');
const coches = require('./data/coches.json');

// Map rápido id→coche O(1)
const MAPA_COCHES = new Map(coches.map(c => [c.id, c]));

// ── MANEJADORES DE ERRORES GLOBALES (PRODUCCIÓN) ───────────────
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [CRÍTICO] Promesa no manejada:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ [CRÍTICO] Excepción no capturada:', err);
  // No cerramos el proceso para mantener el bot online en producción
});

/**
 * Valida que el entorno y los archivos necesarios estén listos.
 */
function validarEntorno() {
  console.log('🔍 [SISTEMA] Iniciando auditoría de entorno...');
  
  const vars = ['DISCORD_TOKEN', 'GUILD_ID', 'COMMANDS_CHANNEL_ID', 'SHOP_CHANNEL_ID', 'DROPS_CHANNEL_ID'];
  const faltantes = vars.filter(v => !process.env[v]);

  if (faltantes.length > 0) {
    console.warn(`⚠️  [SISTEMA] Faltan variables en .env: ${faltantes.join(', ')}`);
    console.warn('⚠️  [SISTEMA] Algunas funciones podrían no funcionar correctamente.');
  }

  const carpetas = [
    path.join(__dirname, 'assets'),
    path.join(__dirname, 'assets', 'icons'),
    path.join(__dirname, 'assets', 'fuga'),
    path.join(__dirname, 'data')
  ];

  for (const c of carpetas) {
    if (!fs.existsSync(c)) {
      console.log(`✨ [SISTEMA] Creando carpeta faltante: ${path.basename(c)}`);
      fs.mkdirSync(c, { recursive: true });
    }
  }
}

validarEntorno();

// ── Store temporal para competidores cercanos ───────────────
const ráfagaReclamos = new Map(); // rollId -> Set(userIds)

// ── Cliente ───────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildEmojisAndStickers // Necesario para gestionar emojis
  ]
});
client.commands = new Collection();

/**
 * Sincroniza los iconos de categorías como emojis personalizados en el servidor.
 */
async function sincronizarEmojis(client) {
  const guildId = process.env.GUILD_ID;
  if (!guildId) {
    console.warn('[BOT] ⚠️ No se ha definido GUILD_ID en el .env. La sincronización de emojis se omitirá.');
    return;
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.warn(`[BOT] ⚠️ No se pudo encontrar el servidor con ID ${guildId}.`);
    return;
  }

  console.log(`[BOT] 🔍 Sincronizando iconos en: ${guild.name}`);

  // Mapeo EXPLÍCITO para evitar errores de orden
  const mapping = {
    'TierC': 'C.png',
    'TierB': 'B.png',
    'TierV': 'vintage.png',
    'TierA': 'A.png',
    'TierE': 'E.gif',
    'TierL': 'L.gif',
    'TierM': 'M.gif',
    'Tiersecret': 'secret.gif',
    'Money': 'money_logo.gif',
    'Power': 'Power.gif',
    'Locked': 'Lock.gif',
    'Unlocked': 'unlocked.gif',
    'Trophy': 'trophy.gif'
  };

  const emojiMap = {};
  const iconsPath = path.join(__dirname, 'assets', 'icons');

  for (const [tierName, fileName] of Object.entries(mapping)) {
    let emoji = guild.emojis.cache.find(e => e.name === tierName);
    const fullPath = path.join(iconsPath, fileName);

    if (!fs.existsSync(fullPath)) {
      console.warn(`[BOT] ⚠️ Icono no encontrado: ${fileName}`);
      continue;
    }

    if (!emoji) {
      try {
        emoji = await guild.emojis.create({ attachment: fullPath, name: tierName });
        console.log(`[BOT] ✨ Emoji creado: ${tierName}`);
      } catch (err) {
        console.error(`[BOT] ❌ Error subiendo emoji ${tierName}:`, err.message);
        continue;
      }
    }
    emojiMap[tierName] = emoji.toString();
  }

  global.EMOJIS_TIER = emojiMap;
  console.log(`[BOT] ✅ Emojis sincronizados correctamente.`);
}

const PREFIX = '?';

// ... (resto de carga de comandos igual)


// ── Carga dinámica de comandos ────────────────────────────────
const comandosPath = path.join(__dirname, 'commands');
for (const archivo of fs.readdirSync(comandosPath).filter(f => f.endsWith('.js'))) {
  const comando = require(path.join(comandosPath, archivo));
  if (comando.data && typeof comando.execute === 'function') {
    client.commands.set(comando.data.name, comando);
    console.log(`[BOT] ✅ Comando cargado: /${comando.data.name}`);
  } else {
    console.warn(`[BOT] ⚠️  ${archivo} no tiene la estructura correcta.`);
  }
}

// ── Bot listo ─────────────────────────────────────────────────
client.once(Events.ClientReady, async (c) => {
  await sincronizarEmojis(c); // Sincronizar iconos de Tiers antes de nada

  console.log('──────────────────────────────────────────────────');
  console.log(`🚀 [BOT] SISTEMA ONLINE: ${c.user.tag}`);
  console.log(`🌐 [BOT] SERVIDORES: ${c.guilds.cache.size}`);
  console.log(`📦 [BOT] CATÁLOGO: ${coches.length} vehículos cargados`);
  console.log('──────────────────────────────────────────────────');

  // ── Auto-inicialización de la TIENDA fija ──
  const shopChannelId = process.env.SHOP_CHANNEL_ID;
  if (shopChannelId) {
    try {
      const channel = await c.channels.fetch(shopChannelId).catch(() => null);
      if (channel) {
        const tiendaCmd = client.commands.get('tienda');
        if (tiendaCmd) {
          const messages = await channel.messages.fetch({ limit: 50 });
          const botMsg = messages.find(m =>
            m.author.id === c.user.id &&
            (
              m.embeds[0]?.title?.includes('SISTEMA INTEGRAL') ||
              m.embeds[0]?.author?.name?.includes('CARDEX') ||
              m.embeds[0]?.title?.includes('ADQUISICIÓN') ||
              m.embeds[0]?.title?.includes('COMPRA-VENTA') ||
              m.embeds[0]?.title?.includes('TALLER') ||
              m.embeds[0]?.title?.includes('TRADE-UP')
            )
          );

          const { embed, files } = tiendaCmd.embedHome();
          const components = [tiendaCmd.crearFilaCategorias('none')];

          if (botMsg) {
            await botMsg.edit({ embeds: [embed], components: components, files: files });
            console.log('[BOT] 🏪 Tienda persistente actualizada en el canal.');
          } else {
            await channel.send({ embeds: [embed], components: components, files: files });
            console.log('[BOT] 🏪 Tienda persistente inicializada en el canal.');
          }
        }
      }
    } catch (err) {
      console.error('[ERROR] No se pudo inicializar la tienda automática:', err);
    }
  }
});

// ── Handler de interacciones ──────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  // Ignorar si no es el servidor configurado para esta instancia
  if (process.env.GUILD_ID && interaction.guildId !== process.env.GUILD_ID) return;

  // ── Autocompletado ─────────────────────────────────────────
  if (interaction.isAutocomplete()) {
    const comando = client.commands.get(interaction.commandName);
    if (comando?.autocomplete) {
      try { await comando.autocomplete(interaction); }
      catch (err) { console.error(`[ERROR] Autocomplete /${interaction.commandName}:`, err); }
    }
    return;
  }

  // ── Slash commands ─────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const comando = client.commands.get(interaction.commandName);
    if (!comando) return;

    // ── Restricción de Canal ──
    const commandsChannelId = process.env.COMMANDS_CHANNEL_ID;
    const shopChannelId = process.env.SHOP_CHANNEL_ID;

    if (commandsChannelId && interaction.channelId !== commandsChannelId && interaction.channelId !== shopChannelId) {
      // Excepción para Administradores: pueden usar comandos en cualquier canal
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: `❌ Los comandos de **CARSDAE** solo están permitidos en el canal <#${commandsChannelId}>.`,
          flags: MessageFlags.Ephemeral
        });
      }
    }

    try {
      await comando.execute(interaction);
    } catch (err) {
      console.error(`[ERROR] /${interaction.commandName}:`, err);
      const fallback = {
        embeds: [
          new EmbedBuilder()
            .setTitle('❌  Error inesperado')
            .setDescription('> Ocurrió un error ejecutando este comando. Inténtalo de nuevo.')
            .setColor(COLOR_ERROR)
            .setFooter({ text: FOOTER }),
        ],
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(fallback).catch(() => { });
      } else {
        await interaction.reply(fallback).catch(() => { });
      }
    }
    return;
  }

  // ── Menús Desplegables ─────────────────────────────────────
  if (interaction.isStringSelectMenu()) {
    // Primero comprobamos casos especiales y específicos
    if (interaction.customId === 'tienda_category_select' || interaction.customId === 'tienda_market_action_select') {
      const tiendaCmd = client.commands.get('tienda');
      if (tiendaCmd && tiendaCmd.handleSelectMenu) {
        await tiendaCmd.handleSelectMenu(interaction);
        return;
      }
    }

    const partes = interaction.customId.split('_');
    const cmdName = partes[0];
    const comando = client.commands.get(cmdName);

    if (comando?.handleSelectMenu) {
      await comando.handleSelectMenu(interaction, partes.slice(1));
    }
    return;
  }

  // ── Botones ────────────────────────────────────────────────
  if (!interaction.isButton()) return;

  const partes = interaction.customId.split('_');
  const accion = partes[0];

  // ── Botón: reclamar coche ──────────────────────────────────
  if (accion === 'reclamar') {
    const rollId = partes.slice(1).join('_');

    try {
      await interaction.deferUpdate();
    } catch (error) {
      // Si la interacción expira o falla en milisegundos de concurrencia, abortamos para no crashear
      return;
    }

    const resultado = await reclamarRoll(rollId, interaction.user.id);

    if (!resultado.exito) {
      // 📝 Si el reclamo falla porque ya tiene dueño, lo añadimos a la lista de "por poco"
      const compitiendo = ráfagaReclamos.get(rollId);
      if (compitiendo) {
        compitiendo.add(interaction.user.id);
      }

      await interaction.followUp({
        content: `⏱️  ¡Casi! Has sido rápido pero no lo suficiente. ¡Alguien se te ha adelantado por milésimas!`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // ── Si ha tenido éxito, abrimos una ventana de 2.5s para ver quién más era rápido ──
    const competidores = new Set();
    ráfagaReclamos.set(rollId, competidores);

    // Cancelar expiración
    cancelarExpiracion(rollId);

    const coche = MAPA_COCHES.get(resultado.cocheId);
    if (!coche) return;

    const r = RAREZA[coche.rareza];
    const guildId = resultado.guildId;
    const userId = interaction.user.id;

    // ── Dar créditos al reclamante ──────────────────────────
    await sumarCreditos(userId, guildId, r.creditos);

    // ── Auto-asignar coche activo si no tiene ninguno ───────
    const perfil = await obtenerPerfil(userId, guildId);
    if (!perfil?.coche_activo && resultado.inventarioId) {
      await setCocheActivo(userId, guildId, resultado.inventarioId);
    }

    // ── Borrar el mensaje original (el del roll con botones) ──
    try { await interaction.deleteReply(); } catch { }

    // ── ENVIAR NUEVO MENSAJE CON TODA LA INFO DETALLADA ──
    const duplicadoStr = resultado.yaLoTenia
      ? `🔄 **DUPLICADO** (Tienes **${resultado.copias}** copias)`
      : `✨ **¡NUEVA ADQUISICIÓN!**`;

    const { url: carUrl, files: carFiles } = getCarImage(coche);
    const limite = await verificarLimiteRolls(userId, guildId);

    const embedFichaTecnica = new EmbedBuilder()
      .setAuthor({
        name: `🏆 ¡Coche añadido al garaje!`,
        iconURL: getTrophyEmoji(true),
      })
      .setTitle(`${coche.marca} ${coche.modelo} (${coche.anio})`)
      .setDescription(
        `### ${duplicadoStr}\n` +
        `*${coche.descripcion}*\n\n` +
        `${SEP}\n` +
        `${r.medalla}  **Categoría ${r.nombre}**  ·  [ ${getTierEmoji(coche.rareza, true)} ]\n` +
        `> ${interaction.user.toString()} **ha sido el más rápido.**\n` +
        `> 💰 **+${fmtNum(r.creditos)} créditos** añadidos.`
      )
      .addFields(
        {
          name: '📊 Ficha Técnica',
          value: `⚡ \`${coche.cv} cv\`\n⏱️ \`${coche.aceleracion_0_100} s\`\n🚀 \`${coche.velocidad_maxima} km/h\``,
          inline: true
        },
        {
          name: '⚙️ Configuración',
          value: `⚖️ \`${fmtNum(coche.peso_kg)} kg\`\n🏁 \`${coche.traccion}\`\n🆔 **ID:** \`#${coche.id}\``,
          inline: true
        }
      )
      .setColor(resultado.yaLoTenia ? 0x95A5A6 : COLOR_EXITO)
      .setThumbnail(getTierURL(coche.rareza))
      .setImage(carUrl)
      .setFooter({ text: `${FOOTER}  ·  Tiradas: ${limite.normales}/50 normales${limite.extras > 0 ? ` + ${limite.extras} extra 💎` : ''}`, iconURL: getMoneyEmoji(true) });

    if (resultado.levelUp?.subio) {
      embedFichaTecnica.addFields({
        name: '🆙 ¡SUBIDA DE NIVEL!',
        value: `¡Has alcanzado el **Nivel ${resultado.levelUp.nivelNuevo}**!\n💰 Recompensa: **+${fmtNum(resultado.levelUp.recompensa)} 💰**`,
        inline: false
      });
      embedFichaTecnica.setColor(0xF1C40F); // Dorado para nivel up
    }

    const msgConfirmacion = await interaction.channel.send({
      content: `${SEP}\n🎊 ¡Atención! **${interaction.user.toString()}** ha reclamado el **${coche.marca} ${coche.modelo}**!`,
      embeds: [embedFichaTecnica],
      files: carFiles
    });

    // ── Ventana de 3s para procesar el Photo Finish ──
    setTimeout(async () => {
      const compitiendo = ráfagaReclamos.get(rollId);
      if (compitiendo && compitiendo.size > 0) {
        const otros = Array.from(compitiendo).map(id => `<@${id}>`);

        const embedConFoto = EmbedBuilder.from(embedFichaTecnica)
          .addFields({
            name: '🏁 Photo Finish',
            value: `Duelo de asfalto. Estos pilotos también frenaron tarde: ${otros.join(', ')}`,
            inline: false
          });

        await msgConfirmacion.edit({ embeds: [embedConFoto] }).catch(() => { });
      }
      ráfagaReclamos.delete(rollId);
    }, 3000);

    // ── NOTIFICACIÓN GLOBAL EN #drops (Nivel 4+ o S+) ────────
    if (coche.rareza >= 4) {
      const channelDrops = interaction.guild.channels.cache.get(process.env.DROPS_CHANNEL_ID);

      if (channelDrops) {
        const embedDrops = new EmbedBuilder()
          .setAuthor({ name: '🔥 ¡NUEVO DROP ÉPICO DETECTADO!', iconURL: 'https://cdn-icons-png.flaticon.com/128/3112/3112946.png' })
          .setTitle(`${r.medalla} ${coche.marca} ${coche.modelo} (${coche.anio})`)
          .setDescription(
            `El piloto **${interaction.user.toString()}** acaba de dominar el asfalto.\n\n` +
            `🔹 **Categoría:** ${r.nombre} [${r.grado}]\n` +
            `🔹 **Potencia:** ${coche.cv} cv\n` +
            `🔹 **Valor:** ${fmtNum(r.creditos)} 💰`
          )
          .setImage(carUrl)
          .setColor(COLORES[coche.rareza])
          .setFooter({ text: `Anunciado en: ${interaction.guild.name}  ·  ${FOOTER}` })
          .setTimestamp();

        await channelDrops.send({
          content: `⚡ ¡Felicidades <@${interaction.user.id}>!`,
          embeds: [embedDrops],
          files: carFiles
        }).catch(() => { });
      }
    }

    return;
  }

  // ── Botón: garaje (paginación) ───────────────────────────
  if (accion === 'garaje') {
    const garajeCmd = client.commands.get('garaje');
    if (garajeCmd?.handleButton) {
      await garajeCmd.handleButton(interaction, partes);
    }
    return;
  }

  // ── Botón: ranking (cambio de pestaña) ──────────────────
  if (accion === 'ranking') {
    const rankingCmd = client.commands.get('ranking');
    if (rankingCmd?.handleButton) {
      await rankingCmd.handleButton(interaction, partes[1]);
    }
    return;
  }

  // ── Botón: fallo en reclamar (el que sale en el /roll) ───────
  if (accion === 'fallo') {
    const ownerId = partes[2];
    const esOwner = interaction.user.id === ownerId;

    if (esOwner) {
      await interaction.reply({
        content: `❌ **¡DEDOS DE TRAPO!** ${interaction.user.toString()} se ha puesto nervioso y ha fallado la maniobra de adquisición (botón equivocado). ¡Más suerte la próxima vez!`,
      });
    } else {
      await interaction.reply({
        content: `❌ **¡INTENTO DE ROBO FRUSTRADO!** ${interaction.user.toString()} ha intentado interceptar un cargamento que no le pertenece y ha saltado la alarma de seguridad.`,
      });
    }
    return;
  }

  // ── Botón: carrera (aceptar / declinar) ───────────────────
  if (accion === 'carrera') {
    const tipoCarrera = partes[1]; // 'aceptar' o 'declinar'
    const challengeId = partes[2];
    const carreraCmd = client.commands.get('carrera');
    if (carreraCmd?.handleButton) {
      await carreraCmd.handleButton(interaction, tipoCarrera, challengeId);
    }
    return;
  }

  // ── Botón: Tienda (Compra de Packs) ─────────────────────────
  if (accion === 'tienda' && partes[1] === 'buy') {
    const rarezaMin = parseInt(partes[2]); // 1, 4, 5 o 6
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const PRECIOS = { 1: 15000, 4: 120000, 5: 500000, 6: 1500000 };
    const precio = PRECIOS[rarezaMin] || 0;

    const { verificarLimiteTienda, registrarCompraTienda, restarCreditos, añadirCocheGaraje, setCocheActivo, actualizarMision, obtenerUltimosCoches } = require('./database/db');

    // ── Deferir para evitar Timeouts ──
    try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch (e) { return; }

    try {
      // ── Verificar Limite Diario ──
      const limiteTienda = await verificarLimiteTienda(userId, 10);
      if (!limiteTienda.puede) {
        return interaction.editReply({
          content: `❌ Has alcanzado el límite diario de compras (**10/10**). Vuelve mañana para adquirir más packs.`,
        });
      }

      const perfil = await obtenerPerfil(userId);
      if ((perfil?.creditos ?? 0) < precio) {
        return interaction.editReply({
          content: `❌ No tienes suficientes créditos. Necesitas **${fmtNum(precio)} 💰**`,
        });
      }

      // ── LÓGICA DE SORTEO PONDERADA PARA LA TIENDA ──
      const poolRarezas = [];
      for (const rKey in RAREZA) {
        if (parseInt(rKey) >= rarezaMin) poolRarezas.push(parseInt(rKey));
      }

      const pesoPoolTotal = poolRarezas.reduce((s, r) => s + RAREZA[r].prob, 0);
      let dado = Math.random() * pesoPoolTotal;
      let rarezaElegida = poolRarezas[0];

      for (const r of poolRarezas) {
        dado -= RAREZA[r].prob;
        if (dado <= 0) {
          rarezaElegida = r;
          break;
        }
      }

      const cochesEnRareza = coches.filter(c => c.rareza === rarezaElegida);
      const recientes = await obtenerUltimosCoches(userId, 10);
      
      let cocheSorteado = cochesEnRareza[Math.floor(Math.random() * cochesEnRareza.length)];

      // Protección de duplicados para rarezas altas (Epic+)
      if (rarezaElegida >= 5 && cocheSorteado && recientes.includes(cocheSorteado.id)) {
          const posibles = cochesEnRareza.filter(c => !recientes.includes(c.id));
          if (posibles.length > 0) {
              cocheSorteado = posibles[Math.floor(Math.random() * posibles.length)];
          }
      }

      // Si por algún error no hay coches en esa rareza, fallback al pool plano
      if (!cocheSorteado) {
        const fallbackPool = coches.filter(c => c.rareza >= rarezaMin);
        if (fallbackPool.length === 0) throw new Error("No hay coches disponibles para esta categoría.");
        cocheSorteado = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
      }

      // ── EJECUCIÓN DE LA TRANSACCIÓN ──
      await restarCreditos(userId, guildId, precio);
      await registrarCompraTienda(userId);
      const complMisiones = await actualizarMision(userId, 'SHOP_SPEND', precio);
      const res = await añadirCocheGaraje(userId, guildId, cocheSorteado.id);

      // Auto-activar si es el primero
      if (!perfil?.coche_activo && res.inventarioId) {
        await setCocheActivo(userId, guildId, res.inventarioId);
      }

      const r = RAREZA[cocheSorteado.rareza];
      const { url: carUrlComp, files: carFilesComp } = getCarImage(cocheSorteado);
      
      const embedCompra = new EmbedBuilder()
        .setAuthor({ name: 'COMPRA EXITOSA: SHOWROOM CARSDAE', iconURL: 'https://cdn-icons-png.flaticon.com/512/1162/1162456.png' })
        .setTitle(`🎁 ¡Has adquirido un ${cocheSorteado.marca}!`)
        .setDescription(
          `Has canjeado **${fmtNum(precio)} 💰** por un paquete exclusivo de importación.\n\n` +
          `🔹 **Vehículo:** ${cocheSorteado.marca} ${cocheSorteado.modelo}\n` +
          `🔹 **Categoría:** ${r.nombre} [${r.grado}]\n\n` +
          `*El coche ha sido enviado a tu /garaje. ¡A disfrutarlo, piloto!*`
        )
        .setThumbnail(carUrlComp)
        .setColor(COLOR_EXITO)
        .setFooter({ text: FOOTER });

      await interaction.editReply({ embeds: [embedCompra], files: carFilesComp });

      // Notificación pública del drop de tienda
      const { url: carUrlAnuncio, files: carFilesAnuncio } = getCarImage(cocheSorteado);

      const embedAnuncio = new EmbedBuilder()
        .setAuthor({
          name: `🏢 ENTREGA EXCLUSIVA: SHOWROOM CARSDAE`,
          iconURL: 'https://cdn-icons-png.flaticon.com/512/3085/3085330.png'
        })
        .setTitle(`${r.medalla} ${cocheSorteado.marca} ${cocheSorteado.modelo} (${cocheSorteado.anio})`)
        .setDescription(
          `### 💎 Adquisición de Alta Gama\n` +
          `**${interaction.user.toString()}** ha formalizado la compra de un nuevo activo.\n\n` +
          `> **Origen:** \`Pack ${rarezaMin === 1 ? 'Estándar' : (rarezaMin === 4 ? 'Épico' : (rarezaMin === 5 ? 'Legendario' : 'Mítico'))}\`\n` +
          `> **Inversión:** \`${fmtNum(precio)} 💰\`\n\n` +
          `${SEP}\n` +
          `**ESPECIFICACIONES TÉCNICAS:**\n` +
          `🏆 **Rareza:** ${r.nombre} [${r.grado}]\n` +
          `⚡ **Potencia:** \`${cocheSorteado.cv} CV\`\n` +
          `🚀 **Velocidad:** \`${cocheSorteado.velocidad_maxima} km/h\`\n` +
          `${SEP}`
        )
        .setImage(carUrlAnuncio)
        .setColor(COLORES[cocheSorteado.rareza])
        .setTimestamp()
        .setFooter({ text: `CARSDAE Premium Lifestyle · Exclusividad Garantizada` });

      if (complMisiones.length > 0) {
        embedAnuncio.addFields({
            name: '🎯 ¡MISIONES COMPLETADAS!',
            value: complMisiones.map(m => `✅ **${m.desc}**\n🎁 Recompensa: \`${fmtNum(m.recompensa_cr)} 💰\` e \`${m.recompensa_xp} XP\``).join('\n'),
            inline: false
        });
      }

      const canalAnuncios = await interaction.client.channels.fetch(process.env.DROPS_CHANNEL_ID).catch(() => interaction.channel);
      await canalAnuncios.send({
        content: `🎉 ¡Felicidades <@${userId}> por tu nueva adquisición!`,
        embeds: [embedAnuncio],
        files: carFilesAnuncio
      });

    } catch (err) {
      console.error("[ERROR COMPRA TIENDA]:", err);
      return interaction.editReply({
        content: `❌ Ocurrió un error procesando tu compra. Por favor, contacta con un administrador.`,
      });
    }
    return;
  }

  // Botón: Tienda (Mejoras / Taller)
  if (accion === 'tienda' && partes[1] === 'up') {
    const upgradeType = partes[2]; // 'motor', 'turbo', 'peso', 'gomas'
    const tiendaCmd = client.commands.get('tienda');
    if (tiendaCmd?.handleUpgrade) {
      await tiendaCmd.handleUpgrade(interaction, upgradeType);
    }
    return;
  }

  // Botón: Tienda (Contratos / Trade-up)
  if (accion === 'tienda' && partes[1] === 'contract' && partes[2] === 'exec') {
    const tiendaCmd = client.commands.get('tienda');
    if (tiendaCmd?.handleContract) {
      await tiendaCmd.handleContract(interaction);
    }
    return;
  }

  // Select: Tienda (Mercado: Elegir acción)
  if (interaction.customId === 'tienda_market_action_select') {
    const tiendaCmd = client.commands.get('tienda');
    if (tiendaCmd?.handleSelectMenu) {
      await tiendaCmd.handleSelectMenu(interaction);
    }
    return;
  }

  // Botón: Tienda (Mercado: Paginación)
  if (accion === 'tienda' && partes[1] === 'market' && partes[2] === 'page') {
    const pagina = partes[3];
    const tiendaCmd = client.commands.get('tienda');
    if (tiendaCmd?.handleMarketPage) {
      await tiendaCmd.handleMarketPage(interaction, pagina);
    }
    return;
  }

  // Botón: Tienda (Ventas: Paginación)
  if (accion === 'tienda' && partes[1] === 'sell' && partes[2] === 'page') {
    const pagina = partes[3];
    const tiendaCmd = client.commands.get('tienda');
    if (tiendaCmd?.handleSellPage) {
      await tiendaCmd.handleSellPage(interaction, pagina);
    }
    return;
  }

  // Botón: Tienda (Mercado: Confirmar compra)
  if (accion === 'tienda' && partes[1] === 'market' && partes[2] === 'buy' && partes[3] === 'confirm') {
    const mercadoId = partes[4];
    const tiendaCmd = client.commands.get('tienda');
    if (tiendaCmd?.handleMarketBuyConfirm) {
      await tiendaCmd.handleMarketBuyConfirm(interaction, mercadoId);
    }
    return;
  }

  // Botón: Tienda (Mercado: Abrir modal de venta)
  if (interaction.customId === 'tienda_market_sell_trigger_modal') {
    const tiendaCmd = client.commands.get('tienda');
    if (tiendaCmd?.handleMarketSellTrigger) {
      await tiendaCmd.handleMarketSellTrigger(interaction);
    }
    return;
  }
});

// ── Modals Submit ──────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === 'tienda_market_sell_modal_global') {
    const tiendaCmd = client.commands.get('tienda');
    if (tiendaCmd?.handleMarketSellModal) {
      await tiendaCmd.handleMarketSellModal(interaction);
    }
  }

  if (interaction.customId.startsWith('tienda_sell_modal_')) {
    const invId = interaction.customId.split('_')[3];
    const tiendaCmd = client.commands.get('tienda');
    if (tiendaCmd?.handleMarketSellModal) {
      await tiendaCmd.handleMarketSellModal(interaction, invId);
    }
  }
});

// ── Soporte de Prefix "?" ─────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  // Ignorar si no es el servidor configurado para esta instancia
  if (process.env.GUILD_ID && message.guildId !== process.env.GUILD_ID) return;

  const commandsChannelId = process.env.COMMANDS_CHANNEL_ID;
  if (commandsChannelId && message.channel.id !== commandsChannelId) {
    // Excepción para Administradores
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply(`❌ Este bot solo responde en <#${commandsChannelId}>.`);
    }
  }

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const comando = client.commands.get(commandName);

  if (!comando) return;

  // Bloquear comandos administrativos vía prefijo ? (Solo permitir vía Slash / para mayor seguridad)
  const perms = comando.data.default_member_permissions;
  if (perms === '8' || perms === '32') { 
    return message.reply('❌ Este comando administrativo solo puede usarse mediante comandos de barra (`/`).');
  }

  const subcommands = (comando.data.options || []).filter(opt => opt.type === 1 || opt.constructor.name.includes('Subcommand')).map(opt => opt.name);
  const hasSubcommand = args[0] && subcommands.includes(args[0].toLowerCase());
  const effectiveArgs = hasSubcommand ? args.slice(1) : args;

  // Mapeo avanzado de opciones para soporte de prefix en subcomandos
  const subName = hasSubcommand ? args[0].toLowerCase() : null;
  const subObj = subName ? (comando.data.options || []).find(o => o.name === subName) : null;
  const optionsList = subObj ? (subObj.options || []) : (comando.data.options || []);

  let msgRespuesta = null;
  let isCreating = false; // Bloqueo para evitar duplicados en condiciones de carrera

  const pseudoInteraction = {
    user: message.author,
    member: message.member,
    guildId: message.guildId,
    guild: message.guild,
    channel: message.channel,
    client: client,
    reply: async (payload) => {
      if (isCreating) {
        // Esperar un poco si ya se está creando un mensaje
        for(let i=0; i<10 && isCreating; i++) await new Promise(r => setTimeout(r, 200));
      }
      if (msgRespuesta) return await msgRespuesta.edit(payload);
      
      isCreating = true;
      try {
        msgRespuesta = await message.reply(payload);
        return msgRespuesta;
      } finally {
        isCreating = false;
      }
    },
    editReply: async (payload) => {
      if (isCreating) {
        // Si se está creando el mensaje original, esperamos a que termine
        for(let i=0; i<10 && isCreating; i++) await new Promise(r => setTimeout(r, 200));
      }

      if (msgRespuesta) {
        return await msgRespuesta.edit(payload).catch(() => {});
      } else {
        isCreating = true;
        try {
          msgRespuesta = await message.channel.send(payload);
          return msgRespuesta;
        } finally {
          isCreating = false;
        }
      }
    },
    followUp: (payload) => message.channel.send(payload),
    deferUpdate: async () => { },
    deferReply: async () => { },
    isChatInputCommand: () => true,
    options: {
      getSubcommand: () => subName,
      getUser: (name) => {
        const idx = optionsList.findIndex(o => o.name === name);
        const arg = effectiveArgs[idx];
        if (arg && arg.startsWith('<@')) {
            const id = arg.replace(/[<@!>]/g, '');
            return client.users.cache.get(id) || message.mentions.users.get(id) || null;
        }
        // Fallback al primer usuario mencionado si no hay correspondencia directa
        return message.mentions.users.first();
      },
      getInteger: (name) => {
        const idx = optionsList.findIndex(o => o.name === name);
        // Intentar buscar el primer número disponible si el argumento en el índice es una mención
        const possibleArgs = effectiveArgs.slice(idx);
        for (const a of possibleArgs) {
            if (!a.startsWith('<@')) {
                const n = parseInt(a);
                if (!isNaN(n)) return n;
            }
        }
        return null;
      },
      getString: (name) => {
        const idx = optionsList.findIndex(o => o.name === name);
        const possibleArgs = effectiveArgs.slice(idx);
        for (const a of possibleArgs) {
            if (optionsList[idx]?.type !== 6 && a.startsWith('<@')) continue;
            return a;
        }
        return null;
      },
      getBoolean: (name) => {
        const idx = optionsList.findIndex(o => o.name === name);
        for (const a of effectiveArgs.slice(idx)) {
            if (a.startsWith('<@')) continue;
            return ['true', 'si', 'on', 'yes', '1'].includes(a.toLowerCase());
        }
        return null;
      }
    }
  };

  try {
    await comando.execute(pseudoInteraction);
  } catch (err) {
    console.error(`[ERROR PREFIX] ${commandName}:`, err);
    message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Error Crítico')
          .setDescription(`Se produjo un error al ejecutar \`${commandName}\` vía prefijo.`)
          .setColor(COLOR_ERROR)
          .setFooter({ text: FOOTER })
      ]
    });
  }
});

// ── Arrancar ──────────────────────────────────────────────────
inicializarDB()
  .then(() => {
    return client.login(process.env.DISCORD_TOKEN);
  })
  .catch(err => {
    console.error('[ERROR] Fallo al inicializar la base de datos:', err);
    process.exit(1);
  });
