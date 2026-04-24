// ============================================================
// commands/eco.js
// Comando de gestión de economía para administradores.
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

const {
  sumarCreditos,
  restarCreditos,
  obtenerPerfil,
  sumarCreditosTodos,
  restarCreditosTodos,
} = require('../database/db');

const {
  COLOR_EXITO,
  COLOR_ERROR,
  COLOR_NEUTRO,
  getMoneyEmoji,
  fmtNum,
  SEP_SLIM,
} = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eco')
    .setDescription('Gestión de economía (Solo Admins).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('añadir')
        .setDescription('Añade créditos a un usuario.')
        .addUserOption(opt => opt.setName('usuario').setDescription('El usuario a quien dar créditos.').setRequired(true))
        .addIntegerOption(opt => opt.setName('cantidad').setDescription('Cantidad de créditos.').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('quitar')
        .setDescription('Quita créditos a un usuario.')
        .addUserOption(opt => opt.setName('usuario').setDescription('El usuario a quien quitar créditos.').setRequired(true))
        .addIntegerOption(opt => opt.setName('cantidad').setDescription('Cantidad de créditos.').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('añadir-todos')
        .setDescription('Añade créditos a TODOS los usuarios registrados.')
        .addIntegerOption(opt => opt.setName('cantidad').setDescription('Cantidad de créditos.').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('quitar-todos')
        .setDescription('Quita créditos a TODOS los usuarios registrados.')
        .addIntegerOption(opt => opt.setName('cantidad').setDescription('Cantidad de créditos.').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Establece los créditos de un usuario a una cantidad fija.')
        .addUserOption(opt => opt.setName('usuario').setDescription('El usuario a modificar.').setRequired(true))
        .addIntegerOption(opt => opt.setName('cantidad').setDescription('Nueva cantidad de créditos.').setRequired(true).setMinValue(0))
    )
    .addSubcommand(sub =>
      sub.setName('set-todos')
        .setDescription('Establece los créditos de TODOS los usuarios a una cantidad fija.')
        .addIntegerOption(opt => opt.setName('cantidad').setDescription('Nueva cantidad global de créditos.').setRequired(true).setMinValue(0))
    ),

  async execute(interaction) {
    const { options, guildId, member } = interaction;

    // Verificación manual de permisos (para soporte de prefijo ?)
    if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ 
        content: '❌ Solo los administradores pueden gestionar la economía.', 
        flags: MessageFlags.Ephemeral 
      });
    }

    let sub = options.getSubcommand();
    const targetUser = options.getUser('usuario');
    const cantidad = options.getInteger('cantidad');
    // Soporte seguro para detectar strings en modo prefijo o valores especiales
    const usuarioOpt = options.get('usuario');
    const targetStr = (typeof usuarioOpt?.value === 'string') ? usuarioOpt.value.toLowerCase() : null;

    // Soporte para modo Prefijo: ?eco set global 50000
    if (targetStr === 'global' || targetStr === 'all' || targetStr === 'todos') {
      if (sub === 'set') sub = 'set-todos';
      if (sub === 'añadir') sub = 'añadir-todos';
      if (sub === 'quitar') sub = 'quitar-todos';
    }

    if (sub === 'añadir') {
      if (!targetUser) return interaction.reply('❌ Debes mencionar a un usuario.');
      const { sumarCreditos, obtenerPerfil } = require('../database/db');
      await sumarCreditos(targetUser.id, guildId, cantidad);
      const perfil = await obtenerPerfil(targetUser.id);

      const embed = new EmbedBuilder()
        .setTitle('🪙 INYECCIÓN DE CRÉDITOS')
        .setDescription(`Se han añadido **${fmtNum(cantidad)}** ${getMoneyEmoji()} a ${targetUser}.\n\n${SEP_SLIM}\n**Saldo actual:** \`${fmtNum(perfil.creditos)}\` cr.`)
        .setColor(COLOR_EXITO)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'quitar') {
      if (!targetUser) return interaction.reply('❌ Debes mencionar a un usuario.');
      const { restarCreditos, obtenerPerfil } = require('../database/db');
      await restarCreditos(targetUser.id, guildId, cantidad);
      const perfil = await obtenerPerfil(targetUser.id);

      const embed = new EmbedBuilder()
        .setTitle('📉 RETIRADA DE CRÉDITOS')
        .setDescription(`Se han retirado **${fmtNum(cantidad)}** ${getMoneyEmoji()} a ${targetUser}.\n\n${SEP_SLIM}\n**Saldo actual:** \`${fmtNum(perfil.creditos)}\` cr.`)
        .setColor(COLOR_ERROR)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'añadir-todos') {
      const { sumarCreditosTodos } = require('../database/db');
      sumarCreditosTodos(cantidad);

      const embed = new EmbedBuilder()
        .setTitle('🌎 INYECCIÓN GLOBAL')
        .setDescription(`Se han añadido **${fmtNum(cantidad)}** ${getMoneyEmoji()} a **TODOS** los usuarios.\n\n${SEP_SLIM}\n*El Tesoro Real ha repartido riquezas.*`)
        .setColor(COLOR_EXITO)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'quitar-todos') {
      const { restarCreditosTodos } = require('../database/db');
      restarCreditosTodos(cantidad);

      const embed = new EmbedBuilder()
        .setTitle('📉 RECORTE GLOBAL')
        .setDescription(`Se han retirado **${fmtNum(cantidad)}** ${getMoneyEmoji()} a **TODOS** los usuarios.\n\n${SEP_SLIM}\n*Impuestos de emergencia aplicados.*`)
        .setColor(COLOR_ERROR)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'set') {
      if (!targetUser) return interaction.reply('❌ Debes mencionar a un usuario.');
      const { setCreditos, obtenerPerfil } = require('../database/db');
      setCreditos(targetUser.id, cantidad);
      const perfil = await obtenerPerfil(targetUser.id);

      const embed = new EmbedBuilder()
        .setTitle('⚖️ AJUSTE DE BALANCE')
        .setDescription(`El saldo de ${targetUser} ha sido fijado en **${fmtNum(cantidad)}** ${getMoneyEmoji()}.\n\n${SEP_SLIM}\n**Nuevo saldo:** \`${fmtNum(perfil.creditos)}\` cr.`)
        .setColor(COLOR_NEUTRO)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'set-todos') {
      const { setCreditosTodos } = require('../database/db');
      setCreditosTodos(cantidad);

      const embed = new EmbedBuilder()
        .setTitle('⚖️ AJUSTE GLOBAL')
        .setDescription(`El saldo de **TODOS** los usuarios ha sido fijado en **${fmtNum(cantidad)}** ${getMoneyEmoji()}.\n\n${SEP_SLIM}\n*El mercado ha sido reequilibrado.*`)
        .setColor(COLOR_NEUTRO)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  },
};
