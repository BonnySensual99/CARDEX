// ============================================================
// utils/rollsActivos.js
// Gestiona la expiración automática de los botones de reclamo.
// Al expirar, edita el embed completo a estado "expirado".
// ============================================================

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { COLORES, RAREZA, FOOTER, SEP }                               = require('./constants');

const EXPIRY_MS = 120 * 1000; // 2 minutos
const timers    = new Map();   // rollId → Timeout

/**
 * Registra un roll activo y programa su expiración visual.
 */
function registrarExpiracion(rollId, interaction, coche) {
  const t = setTimeout(async () => {
    timers.delete(rollId);
    try {
      const r = RAREZA[coche.rareza];

      const embedExpirado = new EmbedBuilder()
        .setAuthor({
          name:    `🎲  Tirada de ${interaction.user.displayName}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
        })
        .setTitle(`${coche.marca} ${coche.modelo}`)
        .setDescription(
          `~~*${coche.descripcion}*~~\n\n` +
          `${SEP}\n` +
          `${r.medalla}  **${r.nombre}**  ·  \`${r.grado}\`  ·  ${r.estrellas}\n\n` +
          `> ⏰  **Nadie reclamó este coche a tiempo.**\n` +
          `> El **${coche.marca} ${coche.modelo}** ha desaparecido.`,
        )
        .addFields(
          { name: '🏭 Marca',    value: `~~${coche.marca}~~`,  inline: true },
          { name: '⚡ Potencia', value: `~~${coche.cv} cv~~`,  inline: true },
          { name: '📅 Año',      value: `~~${coche.anio}~~`,   inline: true },
        )
        .setColor(0x40444B)
        .setImage(coche.url_imagen)
        .setFooter({ text: `${FOOTER}  ·  Expirado` })
        .setTimestamp();

      const botonExpirado = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`expirado_${rollId}`)
          .setLabel('Expirado — nadie lo reclamó')
          .setEmoji('⏰')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
      );

      await interaction.editReply({ embeds: [embedExpirado], components: [botonExpirado] });
    } catch {
      // Mensaje borrado o bot reiniciado — ignorar
    }
  }, EXPIRY_MS);

  timers.set(rollId, t);
}

/**
 * Cancela el timer de expiración de un roll (se llama al reclamar).
 */
function cancelarExpiracion(rollId) {
  const t = timers.get(rollId);
  if (t) {
    clearTimeout(t);
    timers.delete(rollId);
  }
}

module.exports = { registrarExpiracion, cancelarExpiracion, EXPIRY_MS };
