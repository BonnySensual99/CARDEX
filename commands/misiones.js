const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  MessageFlags 
} = require('discord.js');
const { 
  obtenerProgresoMisiones 
} = require('../database/db');
const { 
  COLOR_NEUTRO, 
  SEP, 
  FOOTER, 
  getMoneyEmoji, 
  fmtNum 
} = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('misiones')
    .setDescription('📋 Consulta tus misiones diarias y recompensas.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const misiones = await obtenerProgresoMisiones(userId);

    if (misiones.length === 0) {
      return interaction.reply({
        content: '❌ No hay misiones disponibles hoy. Contacta con soporte.',
        flags: MessageFlags.Ephemeral
      });
    }

    const { getSpainDate } = require('../utils/constants');

    // Calcular tiempo restante para medianoche (España CEST/CET Centralizado)
    const ahora = getSpainDate();
    
    const mañana = new Date(ahora);
    mañana.setHours(24, 0, 0, 0);
    const msRestantes = mañana.getTime() - ahora.getTime();
    
    const horas = Math.floor(msRestantes / (1000 * 60 * 60));
    const minutos = Math.floor((msRestantes % (1000 * 60 * 60)) / (1000 * 60));

    const embed = new EmbedBuilder()
      .setAuthor({ 
        name: 'ASIGNACIONES DIARIAS: CARSDAE HQ', 
        iconURL: 'https://cdn-icons-png.flaticon.com/512/3592/3592259.png' 
      })
      .setTitle('📋 OBJETIVOS DE HOY')
      .setDescription(
        `Completa estos retos antes de que termine el día para recibir bonificaciones de carrera.\n` +
        `⏳ **Reset en:** \`${horas}h ${minutos}m\`\n${SEP}`
      )
      .setColor(0x3498DB)
      .setFooter({ text: `${FOOTER}  ·  Misiones Automáticas` });

    misiones.forEach((m, i) => {
      const porcentaje = Math.min(100, Math.floor((m.progreso / m.objetivo) * 100));
      const lleno = Math.floor(porcentaje / 10);
      const barra = `\`${'▰'.repeat(lleno)}${'▱'.repeat(10 - lleno)}\` ${porcentaje}%`;
      
      const estado = m.completada ? '✅ **COMPLETADA**' : barra;
      const premio = `💰 **${fmtNum(m.recompensa_cr)}** | ✨ **${m.recompensa_xp} XP**`;

      embed.addFields({
        name: `${i + 1}. ${m.desc}`,
        value: `${estado}\n🎁 Recompensa: ${premio}\n${SEP}`,
        inline: false
      });
    });

    return interaction.reply({ embeds: [embed] });
  }
};
