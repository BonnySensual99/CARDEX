// ============================================================
// commands/info.js
// Comando /info — ficha técnica con autocompletado.
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { obtenerInventario }                               = require('../database/db');
const { COLORES, RAREZA,
        FOOTER, COLOR_ERROR, SEP, fmtNum, getTierEmoji, getMoneyEmoji, getPowerEmoji, getTrophyEmoji }                = require('../utils/constants');
const { getCarImage, getTierIcon } = require('../utils/images');
const coches                                              = require('../data/coches.json');

const MAPA_COCHES = new Map(coches.map(c => [c.id, c]));

const TOTAL_POR_RAREZA = {};
for (const c of coches) TOTAL_POR_RAREZA[c.rareza] = (TOTAL_POR_RAREZA[c.rareza] ?? 0) + 1;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('Consulta la ficha técnica de cualquier vehículo del catálogo.')
    .addStringOption(option =>
      option
        .setName('coche')
        .setDescription('Escribe la marca o modelo del vehículo')
        .setRequired(true)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    const query = interaction.options.getFocused().toLowerCase().trim();
    const resultados = coches
      .filter(c =>
        c.marca.toLowerCase().includes(query) ||
        c.modelo.toLowerCase().includes(query) ||
        `${c.marca} ${c.modelo}`.toLowerCase().includes(query),
      )
      .slice(0, 25)
      .map(c => ({
        name:  `${RAREZA[c.rareza].icono} ${c.marca} ${c.modelo} (${c.anio})`,
        value: String(c.id),
      }));
    await interaction.respond(resultados);
  },

  async execute(interaction) {
    const idStr   = interaction.options.getString('coche');
    if (!idStr) {
        return interaction.reply({ content: '❌ Debes especificar un coche (ID, Marca o Modelo).', flags: MessageFlags.Ephemeral });
    }
    const cocheId = parseInt(idStr, 10);

    const cocheFinal =
      MAPA_COCHES.get(cocheId) ??
      coches.find(c => `${c.marca} ${c.modelo}`.toLowerCase().includes(idStr.toLowerCase()));

    if (!cocheFinal) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌  Coche no encontrado')
            .setDescription(
              `> No existe ningún coche que coincida con **"${idStr}"**.\n` +
              `> Usa el autocompletado del comando para buscar correctamente.`,
            )
            .setColor(COLOR_ERROR)
            .setFooter({ text: FOOTER }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const r         = RAREZA[cocheFinal.rareza];
    const enX       = Math.round(100 / r.prob);
    const totalTier = TOTAL_POR_RAREZA[cocheFinal.rareza] ?? '?';

    const inventario = await obtenerInventario(interaction.user.id, interaction.guildId);
    const copias     = inventario.filter(e => e.coche_id === cocheFinal.id).length;
    const posesion   = copias > 0 ? `✅ **Poseído (×${copias})**` : '❌ **No poseído**';

    // Buscar la mejor instancia en el inventario para mostrar stats reales
    const myInstances = inventario.filter(e => e.coche_id === cocheFinal.id);
    const bestMotor = myInstances.length > 0 ? Math.max(...myInstances.map(i => i.motor)) : 0;
    
    const boost = 1 + (bestMotor * 0.05);
    const finalCV = Math.round(cocheFinal.cv * boost);

    // Cálculo dinámico de "Performance Score" ajustado por motor
    const scoreAcel = Math.max(0, Math.min(100, Math.round((9 - cocheFinal.aceleracion_0_100) * 12)));
    const scoreVmax = Math.max(0, Math.min(100, Math.round((cocheFinal.velocidad_maxima - 150) / 2)));
    const scorePwr  = Math.max(0, Math.min(100, Math.round(finalCV / 12)));
    const totalScore = Math.round((scoreAcel + scoreVmax + scorePwr) / 3);

    const renderBar = (val) => {
        const full = '▰';
        const empty = '▱';
        const count = Math.floor(val / 10);
        return `\`${full.repeat(count)}${empty.repeat(10 - count)}\``;
    };

    const { url: carUrl, files: carFiles } = getCarImage(cocheFinal);

    const embed = new EmbedBuilder()
      .setAuthor({
        name:    `ENCICLOPEDIA AUTOMOTRIZ: ${cocheFinal.marca}`,
        iconURL: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png',
      })
      .setTitle(`🚗 ${cocheFinal.marca} ${cocheFinal.modelo} (${cocheFinal.anio})`)
      .setDescription(
        `> *${cocheFinal.descripcion}*\n\n` +
        `${SEP}\n` +
        `${getTierEmoji(cocheFinal.rareza)} **RAREZA:** ${r.nombre} [${r.grado}]\n` +
        `📉 **DROP RATE:** \`${r.prob}%\` (1 de ${enX})\n` +
        `${SEP}`
      )
      .addFields(
        {
          name: '🏎️ RENDIMIENTO EN PISTA',
          value: 
            `▫️ Aceleración: ${renderBar(scoreAcel)} \`${scoreAcel}/100\`\n` +
            `▫️ Vel. Máxima: ${renderBar(scoreVmax)} \`${scoreVmax}/100\`\n` +
            `${getPowerEmoji()} Potencia Neta: ${renderBar(scorePwr)} \`${scorePwr}/100\``,
          inline: false
        },
        {
          name: '⚙️ ESPECIFICACIONES',
          value: 
            `▫️ Motor: \`${finalCV} CV\`${bestMotor > 0 ? ` (+${Math.round(finalCV - cocheFinal.cv)})` : ''}\n` +
            `▫️ Peso: \`${fmtNum(cocheFinal.peso_kg)} KG\`\n` +
            `▫️ Tracción: \`${cocheFinal.traccion}\``,
          inline: true
        },
        {
            name: `${getTrophyEmoji()} BATTLE SCORE`,
            value: `\`\`\`fix\nRating: ${totalScore} pts\n\`\`\``,
            inline: true
        },
        {
          name: '💰 VALOR BASE',
          value: `🛒 Venta: **${fmtNum(r.creditos)} ${getMoneyEmoji()}**`,
          inline: true
        },
        {
          name: '🏠 TU GARAJE',
          value: posesion,
          inline: true
        },
        {
          name: '🆔 REFERENCIA',
          value: `\`#${cocheFinal.id.toString().padStart(3, '0')}\``,
          inline: true
        }
      )
      .setColor(COLORES[cocheFinal.rareza])
      .setImage(carUrl);

    await interaction.reply({ embeds: [embed], files: carFiles });
  },
};

