// ============================================================
// commands/admin.js
// Comandos de administración general para arreglar perfiles.
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

const { obtenerPerfil, sumarExp, sumarCreditos } = require('../database/db');
const { expParaNivel, calcularNivel } = require('../utils/levels');
const { COLOR_EXITO, COLOR_ERROR, FOOTER } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Herramientas de administración del servidor.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('set_nivel')
         .setDescription('Fuerza un nivel específico para un usuario.')
         .addUserOption(opt => opt.setName('usuario').setDescription('Usuario objetivo').setRequired(true))
         .addIntegerOption(opt => opt.setName('nivel').setDescription('Nivel a establecer').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('dar_dinero')
         .setDescription('Otorga créditos a un usuario.')
         .addUserOption(opt => opt.setName('usuario').setDescription('Usuario objetivo').setRequired(true))
         .addIntegerOption(opt => opt.setName('cantidad').setDescription('Cantidad de créditos').setRequired(true))
    ),

  async execute(interaction) {
    const { member } = interaction;
    if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ 
        content: '❌ No tienes permisos para usar este comando.', 
        flags: MessageFlags.Ephemeral 
      });
    }

    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('usuario');
    const guildId = interaction.guildId;

    if (sub === 'set_nivel') {
        const nuevoNivel = interaction.options.getInteger('nivel');
        if (nuevoNivel < 1 || nuevoNivel > 100) {
            return interaction.reply({ content: '❌ El nivel debe estar entre 1 y 100.', flags: MessageFlags.Ephemeral });
        }

        const expNecesaria = expParaNivel(nuevoNivel);
        const perfilActual = await obtenerPerfil(targetUser.id, guildId);
        
        // Calculamos cuánta exp le falta (o sobra) para alcanzar exactamente la base de ese nivel
        const difExp = expNecesaria - (perfilActual.exp || 0);
        
        if (difExp !== 0) {
            await sumarExp(targetUser.id, guildId, difExp);
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: '🛠️ MODO ADMINISTRADOR' })
            .setTitle(`✅ Nivel modificado: ${targetUser.displayName}`)
            .setDescription(`Se ha ajustado la experiencia del usuario para que su nivel base sea **${nuevoNivel}**.\n*(Exp. ajustada: ${difExp > 0 ? '+' : ''}${difExp})*`)
            .setColor(COLOR_EXITO)
            .setFooter({ text: FOOTER });

        return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'dar_dinero') {
        const cantidad = interaction.options.getInteger('cantidad');
        await sumarCreditos(targetUser.id, guildId, cantidad);

        const embed = new EmbedBuilder()
            .setAuthor({ name: '🛠️ MODO ADMINISTRADOR' })
            .setTitle(`✅ Créditos inyectados: ${targetUser.displayName}`)
            .setDescription(`Se han añadido **${cantidad}** créditos al banco del usuario.`)
            .setColor(COLOR_EXITO)
            .setFooter({ text: FOOTER });

        return interaction.reply({ embeds: [embed] });
    }
  }
};
