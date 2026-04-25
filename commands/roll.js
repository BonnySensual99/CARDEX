// ============================================================
// commands/roll.js
// Comando /roll — gacha de coches con suspense de 3 fases.
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
const { registrarRoll } = require('../database/db');
const { checkCooldown, setCooldown,
  formatearTiempo, getRollCooldown } = require('../utils/cooldowns');
const { registrarExpiracion, EXPIRY_MS } = require('../utils/rollsActivos');
const { COLORES, RAREZA, FOOTER, COLOR_NEUTRO,
  COLOR_ERROR, SEP, fmtNum, getMoneyEmoji, getTrophyEmoji, getTierEmoji, getTierURL, getPowerEmoji } = require('../utils/constants');
const { getCarImage, getTierIcon } = require('../utils/images');
const coches = require('../data/coches.json');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Pre-cálculo ponderado (una sola vez al arrancar) ─────────
const _grupos = {};
for (const c of coches) {
  if (!_grupos[c.rareza]) _grupos[c.rareza] = [];
  _grupos[c.rareza].push(c);
}
const _rarezasOrdenadas = Object.keys(_grupos).map(Number).sort((a, b) => a - b);
const _pesoTotal = _rarezasOrdenadas.reduce((s, r) => s + RAREZA[r].prob, 0);

function sacarCoche(avoidIds = []) {
  let dado = Math.random() * _pesoTotal;
  let rarezaElegida = _rarezasOrdenadas[0];
  for (const r of _rarezasOrdenadas) {
    dado -= RAREZA[r].prob;
    if (dado <= 0) { rarezaElegida = r; break; }
  }
  const grupo = _grupos[rarezaElegida];

  // Protección de duplicados para rarezas altas (Épico o superior)
  if (rarezaElegida >= 5 && avoidIds.length > 0) {
    let coche = grupo[Math.floor(Math.random() * grupo.length)];
    // Si el coche elegido está en la lista de recientes, intentamos buscar uno diferente en el mismo grupo
    if (avoidIds.includes(coche.id)) {
      const posibles = grupo.filter(c => !avoidIds.includes(c.id));
      if (posibles.length > 0) {
        return posibles[Math.floor(Math.random() * posibles.length)];
      }
    }
    return coche;
  }

  return grupo[Math.floor(Math.random() * grupo.length)];
}

// Decoradores de texto para ruido visual en rarezas altas
const DECO = { 1: '', 2: '', 3: '', 4: '✦ ', 5: '✦✦ ', 6: '✦✦✦ ', 7: '✧✦✧ ' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('¡Rueda para conseguir un coche aleatorio y reclámalo antes que nadie!'),

  async execute(interaction) {

    // 1. Cooldown y Límites
    const { verificarLimiteRolls } = require('../database/db');
    const limiteRolls = await verificarLimiteRolls(interaction.user.id, interaction.guildId);

    if (!limiteRolls.puede) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name: interaction.user.displayName,
              iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
            })
            .setTitle('🚫  LÍMITE DE ROLLS ALCANZADO')
            .setDescription(
              `> Has agotado tus **50 tiradas** permitidas para este bloque.\n` +
              `> Se habilitarán nuevas tiradas en: **${formatearTiempo(limiteRolls.resetEn)}**.\n\n` +
              `*Nota: Esto ayuda a mantener el equilibrio económico del servidor.*`
            )
            .setColor(COLOR_ERROR)
            .setFooter({ text: FOOTER }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const restante = checkCooldown(interaction.guildId, interaction.user.id);
    if (restante !== null) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name: interaction.user.displayName,
              iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
            })
            .setTitle('⏳  Cooldown activo')
            .setDescription(
              `> Podrás tirar de nuevo en **${formatearTiempo(restante)}**.\n` +
              `> Cooldown entre tiradas: **${formatearTiempo(getRollCooldown())}**`,
            )
            .setColor(COLOR_ERROR)
            .setFooter({ text: FOOTER }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    setCooldown(interaction.guildId, interaction.user.id);
    await interaction.deferReply();

    // 2. Selección del coche ANTES de la animación para saber la rareza final
    const { obtenerUltimosCoches } = require('../database/db');
    const recientes = await obtenerUltimosCoches(interaction.user.id, 15); // Miramos los últimos 15
    const coche = sacarCoche(recientes);
    const r = RAREZA[coche.rareza];
    const finalEmoji = getTierEmoji(coche.rareza, true);

    // 3. Fase 1: Ruleta estilo CS:GO (Optimizado para Fluidez — 6 frames)
    const tiers = Object.keys(RAREZA).map(Number);
    const probTotal = tiers.reduce((s, t) => s + RAREZA[t].prob, 0);

    const randomTierWeighted = () => {
      let dado = Math.random() * probTotal;
      for (const t of tiers) {
        dado -= RAREZA[t].prob;
        if (dado <= 0) return getTierEmoji(t, true);
      }
      return getTierEmoji(1, true);
    };

    // Creamos la "cinta" de 60 iconos
    const sequence = [];
    while (sequence.length < 60) {
      sequence.push(randomTierWeighted());
    }

    // El RESULTADO REAL estará en la posición 48 (centro del último frame)
    sequence[48] = finalEmoji;

    // Troll amago: si el coche es malo, ponemos una rareza alta justo antes para el suspense
    const esMalo = coche.rareza <= 3;
    const tieneTrollAmago = esMalo && (Math.random() < 0.40);
    if (tieneTrollAmago) {
      const topTiers = [5, 6, 7];
      const tierFalso = topTiers[Math.floor(Math.random() * topTiers.length)];
      sequence[47] = getTierEmoji(tierFalso, true);
    }

    // Aseguramos que los iconos alrededor del ganador sean distintos
    for (let j = 46; j <= 50; j++) {
      if (j !== 48 && (j !== 47 || !tieneTrollAmago) && sequence[j] === sequence[48]) {
        sequence[j] = randomTierWeighted();
      }
    }

    // Saltamos muchos al principio (rápido) y pocos al final (frenando).
    // Optimizado: Solo 5 frames para evitar lag por rate-limits de Discord.
    const frames = [10, 25, 38, 45, 46];

    for (let i = 0; i < frames.length; i++) {
      const idx = frames[i];

      // Ventana de 5 iconos centrada en idx+2
      const ventana = [
        sequence[idx],
        sequence[idx + 1],
        sequence[idx + 2], // CENTRO (donde apunta la flecha)
        sequence[idx + 3],
        sequence[idx + 4]
      ];

      const ruletaVisual = `[ ${ventana.join(' | ')} ]`;
      const esFinal = i === frames.length - 1;

      // Volvemos a 'await' para asegurar el orden correcto en Discord y evitar duplicados visuales
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name: `🎰 ABRIENDO CARGAMENTO: ${interaction.user.displayName}`,
              iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            })
            .setDescription(
              `### 🧪 SISTEMA DE ESCANEO ACTIVO\n` +
              `> 　　　　🔻\n` +
              `> ${ruletaVisual}\n` +
              `> 　　　　🔺\n`
            )
            .setColor(esFinal ? COLORES[coche.rareza] : 0xFFAA00)
            .setFooter({ text: FOOTER }),
        ],
      });

      // Tiempos optimizados para fluidez y reducción de latencia
      let sleepTime = 600;
      if (i === frames.length - 3) sleepTime = 800;
      if (i === frames.length - 2) sleepTime = 1100;
      if (esFinal) sleepTime = 1000;

      await sleep(sleepTime);
    }

    // 4. Fase 2: "Rareza detectada" (Confirmación)
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setAuthor({ name: '✨ CARGAMENTO IDENTIFICADO ✨', iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
          .setDescription(
            `### 🚢 REPORTE DE ESCANEO\n` +
            `\`\`\`fix\nSTATUS: [ ACCESS GRANTED ]\nOBJETO: [ VEHÍCULO DE ALTA GAMA ]\nRAREZA: [ ${r.nombre.toUpperCase()} ]\n\`\`\`\n` +
            `> **Chasis detectado:** \`#${require('crypto').randomUUID().substring(0, 8).toUpperCase()}\`\n` +
            `> **Integridad:** \`[ ██████████ ] 100%\`\n\n` +
            `> *"${r.frase}"*`
          )
          .setColor(COLORES[coche.rareza])
          .setFooter({ text: FOOTER }),
      ],
    });
    await sleep(1200);

    const { registrarRoll, incrementarRolls } = require('../database/db');
    const rollId = require('crypto').randomUUID().replace(/-/g, '').substring(0, 24);
    await registrarRoll(rollId, interaction.guildId, coche.id);
    await incrementarRolls(interaction.user.id, interaction.guildId);

    // 5. Fase 3: reveal completo
    const { url: carUrl, files: carFiles } = getCarImage(coche);
    const enX = Math.round(100 / r.prob);

    // Aviso de rolls restantes
    const { esFinDeSemana } = require('../utils/cooldowns');
    const resetTimeStr = esFinDeSemana() ? '1 min' : '90 min';

    let avisoRolls = `\n📊 **Tiradas**: \`${limiteRolls.normales - 1}/50\` normales${limiteRolls.extras > 0 ? ` + \`${limiteRolls.extras}\` extra 💎` : ''}`;
    const restantes = (limiteRolls.restantes || 1) - 1;
    if (restantes <= 3 && restantes > 0) avisoRolls += `\n🚨 **¡ÚLTIMAS ${restantes} TIRADAS!**`;
    if (restantes === 0) avisoRolls += `\n🛑 **¡ESTA ES TU ÚLTIMA TIRADA!** (Próximas en ${resetTimeStr})`;

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `📦 CARGAMENTO DESBLOQUEADO: ${interaction.user.displayName}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(
        `## ${getTierEmoji(coche.rareza, true)} ${coche.marca} ${coche.modelo}\n` +
        `> **Año:** ${coche.anio} | **ID:** \`${coche.id}\`\n` +
        `> **Rareza:** \`${RAREZA[coche.rareza].grado}\` \`${RAREZA[coche.rareza].nombre}\`\n` +
        `${SEP}`
      )
      .setColor(COLORES[coche.rareza])
      .setThumbnail(getTierURL(coche.rareza))
      .setImage(carUrl);

    if (esFinDeSemana()) {
      embed.addFields({ name: '✨ EVENTO: FIN DE SEMANA', value: '`⚡ DOBLE XP ACTIVADO (x2)`', inline: false });
    }

    // 6. Sistema de Reacción: Desafío de 4 flechas (D-Pad Style) - ORDEN FIJO
    const ARROWS = ['⬆️', '⬇️', '⬅️', '➡️'];

    // El orden ahora es FIJO como ha solicitado el usuario
    const finalButtons = [...ARROWS];
    const targetEmoji = ARROWS[Math.floor(Math.random() * ARROWS.length)];

    const fila = new ActionRowBuilder().addComponents(
      finalButtons.map((emoji, i) => {
        const esCorrecto = emoji === targetEmoji;
        return new ButtonBuilder()
          .setCustomId(esCorrecto ? `reclamar_${rollId}` : `fallo_${rollId}_${interaction.user.id}_${i}`)
          .setEmoji(emoji)
          .setStyle(ButtonStyle.Secondary);
      })
    );

    await interaction.editReply({
      content:
        `### 🏁 ¡VERIFICACIÓN DE PILOTO!\n` +
        `> **PULSA LA FLECHA:** ${targetEmoji} para reclamar el vehículo.`,
      embeds: [embed],
      components: [fila],
      files: carFiles
    });
    registrarExpiracion(rollId, interaction, coche);
  },
};

