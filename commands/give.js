// ============================================================
// commands/give.js
// Comando de administrador para otorgar vehículos (Debug/Test).
// Solo funciona vía prefijo '?' o Slash (si se registra).
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

const { añadirCocheGaraje, obtenerPerfil, setCocheActivo } = require('../database/db');
const { COLORES, RAREZA, FOOTER, COLOR_EXITO, COLOR_ERROR, SEP, fmtNum } = require('../utils/constants');
const { getCarImage } = require('../utils/images');
const coches = require('../data/coches.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('give')
    .setDescription('Otorgar un vehículo a un usuario (Admin)')
    .addIntegerOption(opt => 
      opt.setName('id')
         .setDescription('ID del vehículo')
         .setRequired(true))
    .addUserOption(opt => 
      opt.setName('usuario')
         .setDescription('Usuario que recibirá el coche'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const { member } = interaction;

    // Verificación manual de permisos (para soporte de prefijo ?)
    if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ 
        content: '❌ No tienes permisos para usar este comando de administración.', 
        flags: MessageFlags.Ephemeral 
      });
    }

    // 1. Obtener parámetros
    const cocheId = interaction.options.getInteger('id');
    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const guildId = interaction.guildId;

    // 2. Validar coche
    const coche = coches.find(c => c.id === cocheId);
    if (!coche) {
      return interaction.reply({ 
        content: `❌ El vehículo con ID \`#${cocheId}\` no existe en el catálogo.`, 
        flags: MessageFlags.Ephemeral 
      });
    }

    // 3. Añadir al garaje
    const res = await añadirCocheGaraje(targetUser.id, guildId, coche.id);
    
    // Auto-activar si no tiene ninguno
    const perfil = await obtenerPerfil(targetUser.id, guildId);
    if (!perfil?.coche_activo && res.inventarioId) {
      await setCocheActivo(targetUser.id, guildId, res.inventarioId);
    }

    // 4. Respuesta
    const r = RAREZA[coche.rareza];
    const { url: carUrl, files: carFiles } = getCarImage(coche);

    const embed = new EmbedBuilder()
      .setAuthor({ name: '🛠️ COMANDO DE ADMINISTRACIÓN: GIVE', iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
      .setTitle(`✅ Vehículo otorgado a ${targetUser.displayName}`)
      .setDescription(
        `Se ha inyectado un nuevo vehículo en la base de datos para el usuario.\n\n` +
        `🔹 **Vehículo:** ${coche.marca} ${coche.modelo} (${coche.anio})\n` +
        `🔹 **Categoría:** ${r.nombre} [${r.grado}]\n` +
        `🔹 **ID Catálogo:** \`#${coche.id}\`\n\n` +
        `*El coche ya está disponible en su /garaje.*`
      )
      .setThumbnail(carUrl)
      .setColor(COLORES[coche.rareza])
      .setFooter({ text: `${FOOTER}  ·  Sistema de Debug` })
      .setTimestamp();

    await interaction.reply({ 
      content: `📦 **[ADMIN]** Has entregado un **${coche.marca}** a ${targetUser.toString()}.`,
      embeds: [embed], 
      files: carFiles 
    });
  }
};
