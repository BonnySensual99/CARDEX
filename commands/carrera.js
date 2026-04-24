// ============================================================
// commands/carrera.js
// Comando /carrera @usuario — sistema de carreras PvP.
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

const { randomUUID } = require('crypto');
const { 
  registrarVictoria, 
  registrarDerrota, 
  restarCreditos, 
  sumarCreditos, 
  obtenerPerfil,
  transferirCoche,
  registrarCarreraResultado,
  actualizarMision,
  obtenerVehiculoInstancia,
  sumarExp,
  obtenerHistorialCarrera
} = require('../database/db');
const { getCarImage } = require('../utils/images');
const { checkCarreraCooldown,
  setCarreraCooldown,
  formatearTiempo,
  esFinDeSemana } = require('../utils/cooldowns');
const { COLORES, RAREZA, CIRCUITOS,
  FOOTER,
  COLOR_ERROR, COLOR_CARRERA,
  COLOR_EXITO, SEP,
  fmtNum, getMoneyEmoji, getTrophyEmoji, getTierEmoji, getPowerEmoji, calcularFuerza,
  comentarioCarrera } = require('../utils/constants');
const { calcularNivel, calcularMaxApuesta } = require('../utils/levels');
const coches = require('../data/coches.json');

const MAPA_COCHES = new Map(coches.map(c => [c.id, c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const desafiosPendientes = new Map();
const usuariosEnDesafio = new Set();

function crearDesafioId() {
  return randomUUID().replace(/-/g, '').substring(0, 16);
}

function circuitoAleatorio() {
  return CIRCUITOS[Math.floor(Math.random() * CIRCUITOS.length)];
}


const CLIMA = [
  "☀️ Despejado", "🌧️ Lluvia Ligera", "☁️ Nublado", "🌫️ Niebla Alta"
];

/** Genera una barra de pista visual mejorada */
function renderPistaPro(pos, total = 14, cocheEmoji = '🏎️') {
  const empty = '─';
  const point = '•';

  let trackArr = new Array(total).fill(empty);
  for (let i = 0; i < total; i += 4) if (i !== pos) trackArr[i] = point;

  if (pos >= total) trackArr[total - 1] = cocheEmoji;
  else trackArr[pos] = cocheEmoji;

  return `\`║${trackArr.join('')}🏁║\``;
}

function embedDesafio(desafio) {
  const r1 = RAREZA[desafio.cocheDesafiante.rareza];
  const r2 = RAREZA[desafio.cocheRetado.rareza];
  const m1 = desafio.instanciaDesafiante.motor || 0;
  const m2 = desafio.instanciaRetada.motor || 0;

  const e1 = getTierEmoji(desafio.cocheDesafiante.rareza, true);
  const e2 = getTierEmoji(desafio.cocheRetado.rareza, true);

  const { url: carUrl, files: imgs } = getCarImage(desafio.cocheDesafiante);

  const embed = new EmbedBuilder()
    .setAuthor({
      name: 'CONTROL DE PISTA: DESAFÍO ENTRANTE',
      iconURL: 'https://cdn-icons-png.flaticon.com/512/716/716429.png'
    })
    .setTitle(`🏁 CIRCUITO: ${desafio.circuito.nombre}`)
    .setDescription(
      `### 🏎️ DUELO DE PILOTOS\n` +
      `${SEP}\n` +
      `${e1} **PILOTO 1:** <@${desafio.challengerId}>\n` +
      `> **Coche:** ${desafio.cocheDesafiante.marca} ${desafio.cocheDesafiante.modelo}\n` +
      `> **Fuerza Estimada:** \`${fmtNum(Math.round(desafio.cocheDesafiante.cv * r1.multCarrera * (1 + m1 * 0.05 + (desafio.instanciaDesafiante.turbo || 0) * 0.02)))}\` ${getPowerEmoji()} | **Grado:** \`${r1.grado}\` \n\n` +
      `⚔️ **VERSUS** ⚔️\n\n` +
      `${e2} **PILOTO 2:** ${desafio.targetId === 'BOT' ? '🤖 NIGGA-TECH RIVAL' : `<@${desafio.targetId}>`}\n` +
      `> **Coche:** ${desafio.cocheRetado.marca} ${desafio.cocheRetado.modelo}\n` +
      `> **Fuerza Estimada:** \`${fmtNum(Math.round(desafio.cocheRetado.cv * r2.multCarrera * (1 + m2 * 0.05 + (desafio.instanciaRetada.turbo || 0) * 0.02)))}\` ${getPowerEmoji()} | **Grado:** \`${r2.grado}\` \n` +
      `${SEP}`
    )
    .addFields(
      {
        name: `${getMoneyEmoji()} FONDO DE PREMIOS`,
        value: `\`\`\`fix\n${fmtNum(desafio.apuesta * 2)} CRÉDITOS\n\`\`\``,
        inline: true,
      },
      {
        name: '🚥 MODALIDAD Y RIESGO',
        value: desafio.apostarCoche
          ? `💀 **PINK SLIP**\n└ *APUESTA DE COCHE ACTIVADA*`
          : `🏁 **SPRINT RECREATIVO**\n└ *Solo créditos en juego*`,
        inline: true
      }
    )
    .setColor(desafio.apostarCoche ? 0xFF0000 : COLOR_CARRERA);

  if (desafio.apostarCoche) {
    embed.addFields({
      name: '⚠️ ADVERTENCIA DE SEGURIDAD',
      value: '> **EL PERDEDOR PERDERÁ SU VEHÍCULO ACTUAL PARA SIEMPRE.**',
      inline: false
    });
  }

  if (carUrl) embed.setThumbnail(carUrl);

  return { embed, files: imgs };
}

function filasDesafio(desafioId, apostarCoche = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`carrera_aceptar_${desafioId}`)
      .setLabel(apostarCoche ? 'ACEPTAR DUELO A MUERTE' : 'ACEPTAR RETO')
      .setEmoji(apostarCoche ? '💀' : '🏎️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`carrera_declinar_${desafioId}`)
      .setLabel('RETIRARSE')
      .setStyle(ButtonStyle.Danger)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('carrera')
    .setDescription('Gestión de competiciones y estadísticas.')
    .addSubcommand(sub =>
       sub.setName('reto')
          .setDescription('Reta a otro piloto o al bot')
          .addStringOption(opt => opt.setName('apuesta').setDescription('Apuesta (Número o "max")').setRequired(true))
          .addUserOption(opt => opt.setName('rival').setDescription('El piloto al que quieres retar').setRequired(false))
          .addBooleanOption(opt => opt.setName('apostar_coche').setDescription('Pink Slip (PVP solo)').setRequired(false))
    )
    .addSubcommand(sub =>
        sub.setName('stats')
           .setDescription('Muestra tus estadísticas de carrera')
           .addUserOption(opt => opt.setName('piloto').setDescription('Ver stats de otro piloto'))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'stats') return this.handleStats(interaction);

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    // Cooldown Global (Solo y PvP)
    const restante = checkCarreraCooldown(guildId, userId);
    if (restante !== null) {
      return interaction.reply({
        content: `⏳ Tus mecánicos están revisando el coche. Vuelve en **${formatearTiempo(restante)}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const target = interaction.options.getUser('rival');
    const apuestaInput = interaction.options.getString('apuesta') ?? "0";
    const apostarCoche = interaction.options.getBoolean('apostar_coche') ?? false;

    const perfilCh = await obtenerPerfil(userId);
    const instanciaCh = await obtenerVehiculoInstancia(perfilCh.coche_activo, userId);

    if (!instanciaCh) return interaction.reply({ content: '❌ No tienes un coche activo para competir.', flags: MessageFlags.Ephemeral });

    // Límites de apuesta por nivel
    const nivelCh = calcularNivel(perfilCh.exp || 0);
    const maxApuesta = calcularMaxApuesta(nivelCh);
    const misCreditos = perfilCh.creditos || 0;

    let apuesta = 0;
    if (apuestaInput.toLowerCase() === 'max') {
      // MAX pone siempre el máximo que puede por nivel, pero sin exceder su saldo
      apuesta = Math.min(maxApuesta, misCreditos);
    } else {
      apuesta = parseInt(apuestaInput);
      if (isNaN(apuesta)) apuesta = 0;
    }

    const esSolo = !target || target.id === interaction.client.user.id || target.id === userId;

    if (esSolo && apuesta < 1000) {
      return interaction.reply({ content: '❌ Para correr contra el bot, la apuesta mínima obligatoria es de **1.000 créditos**.', flags: MessageFlags.Ephemeral });
    }

    if (!esSolo && apuesta < 500) {
      return interaction.reply({ content: '❌ Para retar a otro jugador, la apuesta mínima es de **500 créditos**.', flags: MessageFlags.Ephemeral });
    }

    if (apuesta > maxApuesta) {
      return interaction.reply({
        content: `❌ Tu nivel (**Lv. ${nivelCh}**) solo permite apostar **${fmtNum(maxApuesta)} créditos** ${esFinDeSemana() ? '(Bonus Finde x2 activo)' : ''}.`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (apuesta > misCreditos) {
      return interaction.reply({
        content: `❌ No tienes fondos suficientes. Tu saldo es de **${fmtNum(misCreditos)} ${getMoneyEmoji()}**.`,
        flags: MessageFlags.Ephemeral
      });
    }

    const cocheCh = MAPA_COCHES.get(instanciaCh.coche_id);

    // MODO SOLO (vs BOT)
    if (!target) {
      setCarreraCooldown(guildId, userId);

      // 1. Determinar rareza del bot (Balanceado para evitar frustración excesiva)
      let rarezaBot = cocheCh.rareza;
      const rChance = Math.random();
      if (rChance < 0.15) rarezaBot = Math.max(rarezaBot - 1, 1);      // 15% bajar 1 categoria
      else if (rChance < 0.30) rarezaBot = Math.min(rarezaBot + 1, 7);  // 15% subir 1 categoria
      else if (rChance < 0.35) rarezaBot = Math.min(rarezaBot + 2, 7);  // 5% subir 2 categorias (Rival de élite)
      // 65% se mantiene en la misma categoría del jugador

      // 2. Seleccionar coche bot de entre los de esa rareza
      const candidatos = coches.filter(c => c.rareza === rarezaBot);
      const cocheBot = candidatos[Math.floor(Math.random() * candidatos.length)];

      // 3. Mejoras del bot (Escalan con la rareza pero con más variabilidad)
      const minUpgrade = Math.max(0, rarezaBot - 4); // R7 -> min 3 | R4 -> min 0
      const mejorasBot = {
        motor:  Math.min(5, Math.floor(Math.random() * 2) + minUpgrade),
        turbo:  Math.min(5, Math.floor(Math.random() * 2) + Math.max(0, minUpgrade - 1)),
        trans:  Math.min(5, Math.floor(Math.random() * 2) + Math.max(0, minUpgrade - 1)),
        susp:   Math.min(5, Math.floor(Math.random() * 2) + Math.max(0, minUpgrade - 1)),
        frenos: Math.min(5, Math.floor(Math.random() * 2) + Math.max(0, minUpgrade - 1)),
        gomas:  Math.min(5, Math.floor(Math.random() * 2) + Math.max(0, minUpgrade - 1))
      };

      // 4. Lógica de "Bot Overclock" (Rival de Élite / Nigga-Tech) - 10% de probabilidad
      const esChetado = Math.random() < 0.10;
      let overcloking = 1.0;
      
      if (esChetado) {
        // Mejoras agresivas para el lore de Nigga-Tech (Nivel 4-8)
        const nivelNigga = () => Math.floor(Math.random() * 5) + 4;
        mejorasBot.motor = nivelNigga(); 
        mejorasBot.turbo = nivelNigga();
        mejorasBot.trans = nivelNigga();
        mejorasBot.susp = nivelNigga();
        mejorasBot.frenos = nivelNigga();
        mejorasBot.gomas = nivelNigga();

        // Poder extra (Lore: Picos de hasta x2.5 para mantener el reto sin ser imposible)
        overcloking = 1.2 + (Math.random() * 1.3); 
      }
      
      // NOTA: Se ha eliminado toda la lógica de "catch-up" o "espejo" en el else.
      // Ahora si no es chetado (90% de las veces), su fuerza será EXACTAMENTE la que dicte su rareza y nivel base.
      const desafioId = `bot_${crearDesafioId()}`;
      const desafio = {
        challengerId: userId,
        targetId: 'BOT',
        instanciaDesafiante: instanciaCh,
        instanciaRetada: mejorasBot,
        cocheDesafiante: cocheCh,
        cocheRetado: cocheBot,
        apuesta,
        apostarCoche: false,
        circuito: circuitoAleatorio(),
        overclock: overcloking, // Guardamos el multiplicador absurdo
        guildId,
        interaction
      };

      // En modo solo aplicamos cooldown y restamos apuesta al inicio
      if (apuesta > 0) await restarCreditos(userId, guildId, apuesta);

      const cvBotBase = cocheBot.cv;
      // Mostramos la potencia real INCLUYENDO el multiplicador de Overclock para transparencia
      const cvBotFinal = Math.round(cvBotBase * (1 + mejorasBot.motor * 0.05 + mejorasBot.turbo * 0.02) * overcloking);

      const { getTierEmoji } = require('../utils/constants');
      const warningChetado = esChetado ? '\n⚠️ **Sleeper detectado:** Este coche parece modificado...\n' : '';

      const embedSolo = new EmbedBuilder()
        .setAuthor({
          name: esChetado ? '⚠️ AMENAZA: VEHÍCULO SLLEPER' : 'DESAFÍO DETECTADO: SISTEMA PVE',
          iconURL: 'https://cdn-icons-png.flaticon.com/512/810/810332.png'
        })
        .setTitle(`🏁 RIVAL: NIGGA-TECH AI`)
        .setColor(esChetado ? 0xFF0000 : COLORES[cocheBot.rareza])
        .setDescription(
          `### 🚥 ¡NUEVO COMPETIDOR EN PISTA!\n` +
          `Un **${cocheBot.marca} ${cocheBot.modelo}** ha bloqueado tu paso en **${desafio.circuito.nombre}**.\n` +
          `${warningChetado}\n` +
          `▫️ **Situación:** ${desafio.overclock > 1 ? '💀 **YOU ARE COOKED**' : '⚖️ Desafío estándar'}\n` +
          `▫️ **Rareza:** ${getTierEmoji(cocheBot.rareza, true)} ${cocheBot.rareza}\n` +
          `▫️ **Potencia:** \`${cvBotFinal}\` CV ${desafio.overclock > 1 ? '🔥 `OVERCLOCK`' : ''}\n` +
          `▫️ **Circuito:** ${desafio.circuito.emoji} \`${desafio.circuito.nombre}\`\n` +
          `▫️ **Tu Apuesta:** \`${fmtNum(apuesta)}\` ${getMoneyEmoji()}\n` +
          `▫️ **Bote en Juego:** \`${fmtNum(apuesta * 2)}\` ${getMoneyEmoji()}`
        );

      const { url: botUrl, files: botFiles } = getCarImage(cocheBot);
      if (botUrl) embedSolo.setImage(botUrl);

      await interaction.reply({
        embeds: [embedSolo],
        files: botFiles
      });

      // Cuenta regresiva para dar tiempo y tensión
      const countdownEmojis = ['🔴', '🟡', '🟢'];
      for (let i = 3; i > 0; i--) {
        await sleep(1500);
        const emoji = i === 3 ? '🔴' : (i === 2 ? '🟡' : '🟢');
        await interaction.editReply({
          content: `🚥 **SISTEMA:** Calentando motores... **${emoji} ${i}**`,
          embeds: [embedSolo]
        });
      }

      await sleep(1000);
      return await module.exports.ejecutarCarrera(interaction, desafio);
    }

    if (usuariosEnDesafio.has(`${guildId}_${userId}`) || usuariosEnDesafio.has(`${guildId}_${target.id}`)) {
      return interaction.reply({ content: '⚠️ Carrera en curso o desafío pendiente para uno de los pilotos.', flags: MessageFlags.Ephemeral });
    }

    const perfilDesafiante = await obtenerPerfil(userId);
    const perfilRetado = await obtenerPerfil(target.id);

    const instanciaDesafiante = await obtenerVehiculoInstancia(perfilDesafiante.coche_activo, userId);
    const instanciaRetada = await obtenerVehiculoInstancia(perfilRetado.coche_activo, target.id);

    if (!instanciaDesafiante || !instanciaRetada) {
      return interaction.reply({ content: '❌ Ambos pilotos deben tener un coche activo para competir.', flags: MessageFlags.Ephemeral });
    }

    const cocheDesafiante = MAPA_COCHES.get(instanciaDesafiante.coche_id);
    const cocheRetado = MAPA_COCHES.get(instanciaRetada.coche_id);

    const desafioId = crearDesafioId();
    const circuito = circuitoAleatorio();
    const desafio = {
      challengerId: userId,
      targetId: target.id,
      instanciaDesafiante,
      instanciaRetada,
      cocheDesafiante,
      cocheRetado,
      apuesta,
      apostarCoche,
      circuito,
      guildId,
      interaction,
      timer: null,
    };

    usuariosEnDesafio.add(`${guildId}_${userId}`);
    usuariosEnDesafio.add(`${guildId}_${target.id}`);
    setCarreraCooldown(guildId, userId);

    desafio.timer = setTimeout(async () => {
      if (!desafiosPendientes.has(desafioId)) return;
      desafiosPendientes.delete(desafioId);
      usuariosEnDesafio.delete(`${guildId}_${userId}`);
      usuariosEnDesafio.delete(`${guildId}_${target.id}`);
      try { await interaction.editReply({ content: '⏰ Desafío cancelado por tiempo.', embeds: [], components: [] }); } catch { }
    }, 60_000);

    desafiosPendientes.set(desafioId, desafio);

    const { getTrophyEmoji } = require('../utils/constants');
    const { embed: visualReto, files: carFiles } = embedDesafio(desafio);

    await interaction.reply({
      content: `${SEP}\n📢 **ATENCIÓN:** <@${target.id}>, has sido desafiado en pista.`,
      embeds: [visualReto],
      components: [filasDesafio(desafioId, desafio.apostarCoche)],
      files: carFiles
    });
  },

  async handleButton(interaction, accion, desafioId) {
    const desafio = desafiosPendientes.get(desafioId);
    if (!desafio) return interaction.reply({ content: 'Este desafío ya ha prescrito.', flags: MessageFlags.Ephemeral });

    if (interaction.user.id !== desafio.targetId) return interaction.reply({ content: 'No eres el destinatario de este reto.', flags: MessageFlags.Ephemeral });

    clearTimeout(desafio.timer);
    desafiosPendientes.delete(desafioId);
    usuariosEnDesafio.delete(`${desafio.guildId}_${desafio.challengerId}`);
    usuariosEnDesafio.delete(`${desafio.guildId}_${desafio.targetId}`);

    if (accion === 'declinar') {
      return interaction.update({ content: '💨 El rival ha evitado la carrera. Cobardía o estrategia...', embeds: [], components: [] });
    }

    if (accion === 'aceptar') {
      // VERIFICACIÓN DE SEGURIDAD DE ÚLTIMO MOMENTO
      const pC = await obtenerPerfil(desafio.challengerId);
      const pR = await obtenerPerfil(desafio.targetId);
      
      // 1. ¿Siguen teniendo los mismos coches activos?
      if (pC?.coche_activo !== desafio.instanciaDesafiante.id || pR?.coche_activo !== desafio.instanciaRetada.id) {
          return interaction.reply({ 
              content: '❌ Uno de los pilotos ha cambiado de coche o lo ha vendido. Reto anulado por seguridad.', 
              flags: MessageFlags.Ephemeral 
          });
      }

      // 2. ¿Siguen teniendo los créditos?
      if (desafio.apuesta > 0) {
        if ((pC?.creditos ?? 0) < desafio.apuesta) {
             return interaction.reply({ content: '💸 El desafiante ya no tiene suficientes créditos.', flags: MessageFlags.Ephemeral });
        }
        if ((pR?.creditos ?? 0) < desafio.apuesta) {
             return interaction.reply({ content: '💸 No tienes los créditos para cubrir la apuesta.', flags: MessageFlags.Ephemeral });
        }

        // Restar a ambos
        await restarCreditos(desafio.challengerId, desafio.guildId, desafio.apuesta);
        await restarCreditos(desafio.targetId, desafio.guildId, desafio.apuesta);
      }

      await interaction.deferUpdate();
      return await module.exports.ejecutarCarrera(interaction, desafio);
    }
  },

  async ejecutarCarrera(interaction, desafio) {
    let f1 = calcularFuerza(desafio.cocheDesafiante, desafio.circuito, desafio.instanciaDesafiante);
    let f2 = calcularFuerza(desafio.cocheRetado, desafio.circuito, desafio.instanciaRetada);
    
    // Si el bot tiene overclock, aplicamos el multiplicador absurdo
    if (desafio.targetId === 'BOT' && desafio.overclock) {
        f2 *= desafio.overclock;
    }

    // 🎥 ANIMACIÓN DE CARRERA (4 fases, SIN archivos adjuntos para máxima fluidez)
    // Los archivos solo se envían en el resultado final para evitar rate-limits
    const totalSteps = 4;
    for (let i = 0; i < totalSteps; i++) {
      const ratio = f1 > f2 ? f1 / f2 : f2 / f1;
      let p1, p2;
      const basePos = Math.round((i / (totalSteps - 1)) * 18);

      if (f1 > f2) {
        p1 = basePos;
        p2 = Math.max(0, Math.round(basePos / ratio) + (i === 0 ? 0 : -1));
      } else {
        p2 = basePos;
        p1 = Math.max(0, Math.round(basePos / ratio) + (i === 0 ? 0 : -1));
      }

      // Telemetría simulada
      const v1 = Math.round((desafio.cocheDesafiante.velocidad_maxima * 0.8) + (Math.random() * 40));
      const v2 = Math.round((desafio.cocheRetado.velocidad_maxima * 0.8) + (Math.random() * 40));
      const dist = Math.abs(p1 - p2);
      const lider = p1 > p2 ? desafio.challengerId : (p2 > p1 ? desafio.targetId : null);

      const liderCar = p1 >= p2 ? desafio.cocheDesafiante : desafio.cocheRetado;
      const colorTrack = p1 >= p2 ? 0xFF0000 : 0x0000FF;

      const embedAnim = new EmbedBuilder()
        .setAuthor({
          name: `LIDERANDO: ${p1 >= p2 ? 'Tú' : 'RIVAL'}`,
          iconURL: 'https://cdn-icons-png.flaticon.com/512/716/716429.png'
        })
        .setTitle(`🏁 CIRCUITO: ${desafio.circuito.nombre}`)
        .setColor(colorTrack)
        .setDescription(
          `### 🚥 EN CABEZA: \`${liderCar.marca} ${liderCar.modelo}\`\n` +
          `${SEP}\n` +
          `🔴 **Tú**\n` +
          `║${renderPistaPro(p1, 14, '🏎️')}\n` +
          `🔵 **${desafio.targetId === 'BOT' ? 'NIGGA RIVAL' : 'RIVAL'}**\n` +
          `║${renderPistaPro(p2, 14, '🏎️')}\n` +
          `${SEP}`
        )
        .addFields(
          {
            name: '📊 TELEMETRÍA',
            value: `🔴 \`${v1} km/h\`\n🔵 \`${v2} km/h\``,
            inline: true
          },
          {
            name: '📐 DIFERENCIAL',
            value: lider ? `👑 <@${lider}>\n🏎️ \`+${dist * 4}m\`` : '⏱️ **EMPAREJADOS**',
            inline: true
          }
        );

      // ⚡ Sin archivos adjuntos en la animación — solo texto/embed = sin lag
      await interaction.editReply({
        content: '',
        embeds: [embedAnim],
        components: [],
        files: [] // Sin imagen hasta el resultado final
      });

      await sleep(1500); // 1.5s estable en vez de 2s con imágenes
    }

    // Evitar que la animación pise las variables globales de levelup
    let resLvlG = null;
    let resLvlP = null;

    // Proceso de victoria
    const g1 = f1 >= f2;
    const ganador = g1 ? desafio.challengerId : desafio.targetId;
    const perdedor = g1 ? desafio.targetId : desafio.challengerId;
    const cG = g1 ? desafio.cocheDesafiante : desafio.cocheRetado;
    const cP = g1 ? desafio.cocheRetado : desafio.cocheDesafiante;

    const fWinner = g1 ? f1 : f2;
    const fLoser = g1 ? f2 : f1;
    const iWinner = g1 ? desafio.instanciaDesafiante : desafio.instanciaRetada;

    const iLoser = g1 ? desafio.instanciaRetada : desafio.instanciaDesafiante;

    // PROCESADO DE PINK SLIP
    let cocheRobado = null;
    if (desafio.apostarCoche && desafio.targetId !== 'BOT') {
      cocheRobado = g1 ? desafio.cocheRetado : desafio.cocheDesafiante;
      transferirCoche(iLoser.id, ganador, desafio.guildId);
    }

    // El premio es el pozo total (apuesta * 2)
    const cr = desafio.apuesta * 2;

    if (ganador !== 'BOT') {
      resLvlG = await registrarVictoria(ganador);
      if (cr > 0) await sumarCreditos(ganador, null, cr);
      await registrarCarreraResultado(ganador, perdedor, desafio.apuesta, cr - desafio.apuesta, true);
    }
    if (perdedor !== 'BOT') {
      resLvlP = await registrarDerrota(perdedor);
      await registrarCarreraResultado(perdedor, ganador, desafio.apuesta, -desafio.apuesta, false);
    }

    setCarreraCooldown(desafio.guildId, desafio.challengerId);
    if (desafio.targetId !== 'BOT') {
      setCarreraCooldown(desafio.guildId, desafio.targetId);
    }

    // ── GESTIÓN DE MISIONES ─────────────────────────
    let misionesCompletadasLog = [];
    if (ganador !== 'BOT') {
        const complGanador = await actualizarMision(ganador, 'CARRERA_WIN', 1);
        misionesCompletadasLog.push(...complGanador.map(m => ({ user: ganador, ...m })));
    }


    // Debug Log (Consola) para verificar potencia real sin normalización
    if (desafio.targetId === 'BOT') {
      console.log(`[RACE] P1 Force: ${f1} | P2 Force: ${f2} | Ratio: ${(f2/f1).toFixed(2)}`);
    }

    const m = Math.round(Math.abs(f1 - f2) / Math.max(f1, f2) * 1000) / 10;
    const s = g1 ? desafio.cocheDesafiante.rareza < desafio.cocheRetado.rareza : desafio.cocheRetado.rareza < desafio.cocheDesafiante.rareza;

    // Barra de potencia visual (siempre Challenger arriba, Rival abajo)
    const maxF = Math.max(f1, f2);
    const ratio1 = Math.max(0, Math.min(12, Math.round((f1 / maxF) * 12)));
    const ratio2 = Math.max(0, Math.min(12, Math.round((f2 / maxF) * 12)));
    
    // Safety check for repeat
    const barraCh = '▰'.repeat(ratio1) + '▱'.repeat(Math.max(0, 12 - ratio1));
    const barraTr = '▰'.repeat(ratio2) + '▱'.repeat(Math.max(0, 12 - ratio2));

    const finalGanador = ganador === 'BOT' ? '🤖 NIGGA RIVAL' : `<@${ganador}>`;
    const finalPerdedor = perdedor === 'BOT' ? '🤖 NIGGA RIVAL' : `<@${perdedor}>`;

    const upgradesCh = [
      desafio.instanciaDesafiante.motor > 0 ? `⚙️M${desafio.instanciaDesafiante.motor}` : '',
      desafio.instanciaDesafiante.turbo > 0 ? `🚀T${desafio.instanciaDesafiante.turbo}` : '',
      desafio.instanciaDesafiante.trans > 0 ? `⛓️Tx${desafio.instanciaDesafiante.trans}` : '',
      desafio.instanciaDesafiante.susp > 0 ? `🔧S${desafio.instanciaDesafiante.susp}` : '',
      desafio.instanciaDesafiante.frenos > 0 ? `🛑F${desafio.instanciaDesafiante.frenos}` : '',
      desafio.instanciaDesafiante.gomas > 0 ? `🛞G${desafio.instanciaDesafiante.gomas}` : ''
    ].filter(x => x).join(' ') || 'Sin mejoras';

    const upgradesTr = [
      desafio.instanciaRetada.motor > 0 ? `⚙️M${desafio.instanciaRetada.motor}` : '',
      desafio.instanciaRetada.turbo > 0 ? `🚀T${desafio.instanciaRetada.turbo}` : '',
      desafio.instanciaRetada.trans > 0 ? `⛓️Tx${desafio.instanciaRetada.trans}` : '',
      desafio.instanciaRetada.susp > 0 ? `🔧S${desafio.instanciaRetada.susp}` : '',
      desafio.instanciaRetada.frenos > 0 ? `🛑F${desafio.instanciaRetada.frenos}` : '',
      desafio.instanciaRetada.gomas > 0 ? `🛞G${desafio.instanciaRetada.gomas}` : ''
    ].filter(x => x).join(' ') || 'Sin mejoras';

    const embedRes = new EmbedBuilder()
      .setAuthor({
        name: 'RESULTADOS OFICIALES: PODIUM',
        iconURL: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png'
      })
      .setDescription(
        `# ${getTrophyEmoji()} GANADOR: ${finalGanador}\n` +
        `> *${comentarioCarrera(m, s)}*\n\n` +
        `💵 **BALANCE:** ${g1 ? `+\`${fmtNum(desafio.apuesta)}\`` : `-\`${fmtNum(desafio.apuesta)}\``} ${getMoneyEmoji()}\n` +
        `${SEP}\n` +
        `🔴 **Tú:** \`[${barraCh}]\` **${fmtNum(f1)}**\n` +
        `🔵 **RIVAL:** \`[${barraTr}]\` **${fmtNum(f2)}**\n` +
        `${SEP}`
      )
      .addFields(
        {
          name: '🏁 VEREDICTO TÉCNICO',
          value: (() => {
            const cir = (desafio.circuito.nombre || '').toLowerCase();
            const cW = g1 ? desafio.cocheDesafiante : desafio.cocheRetado;
            const cL = g1 ? desafio.cocheRetado : desafio.cocheDesafiante;
            const iW = g1 ? desafio.instanciaDesafiante : desafio.instanciaRetada;
            const iL = g1 ? desafio.instanciaRetada : desafio.instanciaDesafiante;
            
            let rzs = [];
            if (cW.rareza > cL.rareza) rzs.push(`🔼 **Categoría:** Dominio por gama superior (${RAREZA[cW.rareza].grado}).`);
            if (iW.motor > iL.motor) rzs.push(`⚙️ **Motor:** Mejor rendimiento térmico y potencia.`);
            if (iW.turbo > iL.turbo) rzs.push(`🚀 **Turbo:** Mayor presión de soplado en aceleración.`);
            
            if (cir.includes('autopista') || cir.includes('recta')) {
              if (cW.velocidad_maxima > cL.velocidad_maxima) rzs.push(`🛣️ **Pista:** Superior en velocidad punta.`);
            } else if (cir.includes('urbano') || cir.includes('callejero')) {
              if (cW.aceleracion_0_100 < cL.aceleracion_0_100) rzs.push(`🏙️ **Pista:** Tracción y salida de curva superior.`);
            } else if (cW.peso_kg < cL.peso_kg) {
              rzs.push(`⚖️ **Peso:** Mayor agilidad por ligereza.`);
            }

            if (desafio.overclock > 1) rzs.push(`🔥 **Nigga-Tech:** Modificación agresiva de CV activa.`);
            if (rzs.length === 0) rzs.push("🏎️ **Consistencia:** Superioridad técnica general.");
            return rzs.join('\n');
          })(),
          inline: false
        },
        {
          name: `🔴 TU VEHÍCULO ${g1 ? '🏆' : ''}`,
          value: `▫️ **Coche:** ${getTierEmoji(desafio.cocheDesafiante.rareza, true)} ${desafio.cocheDesafiante.marca} ${desafio.cocheDesafiante.modelo}\n` +
            `▫️ **Taller:** \`${upgradesCh}\`\n` +
            `▫️ **Potencia:** \`${Math.round(desafio.cocheDesafiante.cv * (1 + desafio.instanciaDesafiante.motor * 0.05 + (desafio.instanciaDesafiante.turbo || 0) * 0.02))}\` CV\n` +
            `▫️ **Puntuación:** \`${fmtNum(f1)}\``,
          inline: true
        },
        {
          name: `🔵 RIVAL ${!g1 ? '🏆' : ''}`,
          value: `▫️ **Diferencia:** \`${m}%\`\n` +
            `▫️ **Coche:** ${getTierEmoji(desafio.cocheRetado.rareza, true)} ${desafio.cocheRetado.marca} ${desafio.cocheRetado.modelo}\n` +
            `▫️ **Categoría:** ${desafio.overclock > 1 ? '💀 **YOU ARE COOKED**' : (desafio.cocheRetado.rareza > desafio.cocheDesafiante.rareza ? '🔼 **SUPERIOR**' : (desafio.cocheRetado.rareza < desafio.cocheDesafiante.rareza ? '🔽 **INFERIOR**' : '⚖️ **IGUALADO**'))}\n` +
            `▫️ **Taller:** \`${upgradesTr}\`\n` +
            `▫️ **Potencia:** \`${Math.round(desafio.cocheRetado.cv * (1 + desafio.instanciaRetada.motor * 0.05 + (desafio.instanciaRetada.turbo || 0) * 0.02) * (desafio.overclock || 1))}\` CV${(desafio.overclock > 1) ? ' 🔥 `OVERCLOCK`' : ''}\n` +
            `▫️ **Puntuación:** \`${fmtNum(f2)}\``,
          inline: true
        }
      )
      .setColor(COLORES[cG.rareza]);

    if (cocheRobado) {
      embedRes.addFields({
        name: '💀 PINK SLIP: COCHE RECLAMADO',
        value: `El piloto <@${ganador}> se ha llevado el **${cocheRobado.marca} ${cocheRobado.modelo}** de <@${perdedor}>.`,
        inline: false
      });
      embedRes.setColor(0xFF0000);
    }

    // Mostrar misiones completadas
    if (misionesCompletadasLog.length > 0) {
      const gCompl = misionesCompletadasLog.filter(m => m.user === ganador);
      if (gCompl.length > 0) {
          embedRes.addFields({
              name: '🎯 ¡MISIONES COMPLETADAS!',
              value: gCompl.map(m => `✅ **${m.desc}**\n🎁 Recompensa: \`${fmtNum(m.recompensa_cr)} 💰\` y \`${m.recompensa_xp} XP\``).join('\n'),
              inline: false
          });
      }
    }

    // Notificaciones de nivel
    if (resLvlG?.subio) {
      embedRes.addFields({
        name: '🆙 ¡GANADOR SUBE DE NIVEL!',
        value: `<@${ganador}> ha alcanzado el **Nivel ${resLvlG.nivelNuevo}** (+${fmtNum(resLvlG.recompensa)} ${getMoneyEmoji()})`,
        inline: false
      });
    }
    if (resLvlP?.subio) {
      embedRes.addFields({
        name: '🆙 ¡RIVAL SUBE DE NIVEL!',
        value: `<@${perdedor}> ha alcanzado el **Nivel ${resLvlP.nivelNuevo}** (+${fmtNum(resLvlP.recompensa)} ${getMoneyEmoji()})`,
        inline: false
      });
    }

    const { url: winnerUrl, files: winnerFiles } = getCarImage(cG);
    embedRes.setImage(winnerUrl)
      .setTimestamp();

    await interaction.editReply({ embeds: [embedRes], components: [], files: winnerFiles });
  },

  async handleStats(interaction) {
      const target = interaction.options.getUser('piloto') || interaction.user;
      const p = await obtenerPerfil(target.id);
      const host = await obtenerHistorialCarrera(target.id, 10);

      const total = (p.victorias || 0) + (p.derrotas || 0);
      const winrate = total > 0 ? ((p.victorias / total) * 100).toFixed(1) : 0;

      const historyStr = host.length > 0 
        ? host.map(h => {
            const timestamp = h.fecha ? Math.floor(new Date(h.fecha).getTime() / 1000) : 0;
            const time = timestamp > 0 ? `<t:${timestamp}:R>` : '*Fecha no registrada*';
            const rival = h.rival_id === 'BOT' ? '🤖 AI' : `<@${h.rival_id}>`;
            return `${h.resultado === 1 ? '🥇' : '🏁'} vs ${rival} | **${h.ganancia >= 0 ? '+' : ''}${fmtNum(h.ganancia)}** | ${time}`;
        }).join('\n')
        : '*Parece que aún no has debutado en la pista...*';

      const embed = new EmbedBuilder()
        .setAuthor({ name: `PERFIL DE PILOTO: ${target.displayName}`, iconURL: target.displayAvatarURL({ dynamic: true }) })
        .setTitle('🏁 FICHA TÉCNICA DE COMPETICIÓN')
        .setDescription(`${SEP}\n### 🏆 PALMARÉS\n` +
            `🏁 **Victorias:** \`${p.victorias || 0}\` | 💀 **Derrotas:** \`${p.derrotas || 0}\`\n` +
            `📈 **Ratio Victoria:** \`${winrate}%\`\n` +
            `💰 **Bote Máximo:** \`${fmtNum(p.carrera_max_ganancia || 0)}\` ${getMoneyEmoji()}\n` +
            `📈 **Total Ganado:** \`${fmtNum(p.carrera_total_ganado || 0)}\` ${getMoneyEmoji()}\n` +
            `💸 **Total Perdido:** \`${fmtNum(p.carrera_total_perdido || 0)}\` ${getMoneyEmoji()}\n\n` +
            `### 📜 ÚLTIMOS 10 DUELOS\n${historyStr}\n${SEP}`)
        .setColor(COLOR_CARRERA)
        .setFooter({ text: FOOTER });

      return interaction.reply({ embeds: [embed] });
  },
};
/*
        const challengerId = args; // En este caso args es perdedor (partes[2])
        const targetId     = interaction.customId.split('_')[3];
        const apuesta      = parseInt(interaction.customId.split('_')[4]) || 0;

        if (interaction.user.id !== challengerId) {
            return interaction.reply({ content: 'Solo el perdedor de la carrera anterior puede pedir revancha.', flags: MessageFlags.Ephemeral });
        }

        // Re-usamos la lógica de execute pero adaptada a interacción de botón
        const guildId = interaction.guildId;
        const targetUser = await interaction.client.users.fetch(targetId);

        // Validaciones express
        if (usuariosEnDesafio.has(`${guildId}_${challengerId}`) || usuariosEnDesafio.has(`${guildId}_${targetId}`)) {
            return interaction.reply({ content: 'Uno de los pilotos ya está ocupado.', flags: MessageFlags.Ephemeral });
        }

        const perfilDesafiante = await obtenerPerfil(challengerId);
        const perfilRetado     = await obtenerPerfil(targetId);

        if (!perfilDesafiante?.coche_activo || !perfilRetado?.coche_activo) {
            return interaction.reply({ content: 'Ambos pilotos deben tener un coche activo.', flags: MessageFlags.Ephemeral });
        }

        if (apuesta > 0 && (perfilDesafiante.creditos ?? 0) < apuesta) {
            return interaction.reply({ content: 'No tienes créditos suficientes para la revancha.', flags: MessageFlags.Ephemeral });
        }

        const { obtenerVehiculoInstancia } = require('../database/db');
        const instanciaCh = await obtenerVehiculoInstancia(perfilDesafiante.coche_activo);
        const instanciaTr = await obtenerVehiculoInstancia(perfilRetado.coche_activo);

        if (!instanciaCh || !instanciaTr) {
            return interaction.reply({ content: 'Uno de los pilotos no tiene un coche válido asignado.', flags: MessageFlags.Ephemeral });
        }

        const desafioId = crearDesafioId();
        const circuito  = circuitoAleatorio();
        const desafio = {
          challengerId,
          targetId,
          instanciaDesafiante: instanciaCh,
          instanciaRetada: instanciaTr,
          cocheDesafiante: MAPA_COCHES.get(instanciaCh.coche_id),
          cocheRetado: MAPA_COCHES.get(instanciaTr.coche_id),
          apuesta,
          circuito,
          guildId,
          interaction: interaction,
          timer: setTimeout(async () => {
            if (!desafiosPendientes.has(desafioId)) return;
            desafiosPendientes.delete(desafioId);
            usuariosEnDesafio.delete(`${guildId}_${challengerId}`);
            usuariosEnDesafio.delete(`${guildId}_${targetId}`);
            try { await interaction.channel.send(`⏰ La revancha de <@${challengerId}> ha expirado.`); } catch {}
          }, 60_000)
        };

        desafiosPendientes.set(desafioId, desafio);
        usuariosEnDesafio.add(`${guildId}_${challengerId}`);
        usuariosEnDesafio.add(`${guildId}_${targetId}`);

        await interaction.reply({
            content: `${SEP}\n🔥 **REVANCHA SOLICITADA:** <@${challengerId}> quiere la revancha contra <@${targetId}>!`,
            embeds: [embedDesafio(desafio)],
            components: [filasDesafio(desafioId, desafio.apostarCoche)]
        });
    }
  },
};
*/
