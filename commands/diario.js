// ============================================================
// commands/diario.js
// Comando /diario — recompensa diaria con sistema de racha (streak).
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const {
  obtenerPerfil,
  puedeReclamarDiario,
  reclamarDiario,
}                           = require('../database/db');
const { FOOTER, COLOR_DIARIO,
        COLOR_ERROR, SEP, SEP_SLIM,
        fmtNum, getMoneyEmoji, getPowerEmoji }            = require('../utils/constants');
const { formatearTiempo }   = require('../utils/cooldowns');

// Recompensa base
const DIARIO_BASE  = 3000; 

const FRASES_DIARIO = [
  '¡El garaje no se construye en un día, piloto!',
  'Cada crédito cuenta. ¡Sigue así!',
  'Un día más al volante. ¡A por ese legendario!',
  '¡La constancia gana las carreras!',
  'El motor está caliente. ¡A por ello!',
  '¡Otro día, otra oportunidad de brillar!',
  'Los grandes pilotos nunca se rinden. Tú tampoco.',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('diario')
    .setDescription('Cobra tu recompensa diaria de créditos. ¡Mantén tu racha para ganar más!'),

  async execute(interaction) {
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;

    const { puede, restante } = await puedeReclamarDiario(userId);

    if (!puede) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name:    `SUMINISTRO EN ESPERA`,
              iconURL: 'https://cdn-icons-png.flaticon.com/512/3563/3563395.png',
            })
            .setTitle('⏳  Vuelve más tarde')
            .setDescription(
              `> Los fondos diarios están en proceso de transferencia.\n` +
              `> Tiempo restante: **${formatearTiempo(restante)}**\n` +
              `> El suministro se renueva cada día a medianoche.`
            )
            .setColor(COLOR_ERROR)
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Calcular racha antes de reclamar para el previo
    const perfilPre = await obtenerPerfil(userId);
    const rachaPre  = perfilPre.racha || 0;
    
    // El bonus de racha: 1000 por día de racha (máximo día 10)
    const bonusRacha = Math.min(rachaPre * 1000, 10000);
    const bonusAleatorio = Math.floor(Math.random() * 1001); // 0-1000 extra
    const total = DIARIO_BASE + bonusRacha + bonusAleatorio;
    
    const { nuevaRacha, levelUp } = await reclamarDiario(userId, null, total);
    const frase = FRASES_DIARIO[Math.floor(Math.random() * FRASES_DIARIO.length)];

    const perfil = await obtenerPerfil(userId);
    const nuevoBalance = perfil?.creditos ?? total;

    // Visual: Barra de racha (máximo 7 días visuales)
    const renderRacha = (r) => {
        const full = '🔥';
        const empty = '○';
        const display = Math.min(r, 7);
        return full.repeat(display) + empty.repeat(7 - display);
    };

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `SUMINISTRO DIARIO: DÍA ${nuevaRacha}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTitle(`${getMoneyEmoji()} ¡Fondos Transferidos!`)
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/2489/2489756.png')
      .setDescription(
        `### **+${fmtNum(total)} ${getMoneyEmoji()}**\n` +
        `> *"${frase}"*\n` +
        `${SEP_SLIM}`
      )
      .addFields(
        {
          name: '📊 Desglose de Inversión',
          value:
            `▫️ Pago Base: **${fmtNum(DIARIO_BASE)}**\n` +
            `▫️ Bonus Racha: **+${fmtNum(bonusRacha)}**\n` +
            `▫️ Incentivo: **+${fmtNum(bonusAleatorio)}**`,
          inline: true,
        },
        {
          name: '🔥 Tu Racha',
          value: `\`${renderRacha(nuevaRacha)}\`\n**${nuevaRacha} días** seguidos`,
          inline: true,
        },
        {
          name: '💳 Balance Total',
          value: `${getMoneyEmoji()} **${fmtNum(nuevoBalance)}** créditos`,
          inline: false,
        }
      )
      .setColor(COLOR_DIARIO);

    if (levelUp?.subio) {
        embed.addFields({
            name: '🆙 ¡SUBIDA DE NIVEL!',
            value: `¡Has alcanzado el **Nivel ${levelUp.nivelNuevo}**!\n💰 Recompensa: **+${fmtNum(levelUp.recompensa)} 💰**`,
            inline: false
        });
        embed.setColor(0xF1C40F);
    }

    embed.setFooter({ text: `Mantén la racha para maximizar beneficios  ·  ${FOOTER}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

