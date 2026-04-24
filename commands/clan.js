// ============================================================
// commands/clan.js
// Sistema de Clanes / Car Gangs.
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

const {
  obtenerPerfil,
  restarCreditos,
  crearClan,
  unirseAClan,
  abandonarClan,
  obtenerClan,
  obtenerClanPorNombreOTag,
  obtenerMiembrosClan,
  getRankingClanes,
  cambiarEstadoClan,
  crearInvitacion,
  obtenerInvitacion,
  borrarInvitacion
} = require('../database/db');

const { COLOR_EXITO, COLOR_ERROR, COLOR_NEUTRO, SEP, FOOTER, fmtNum, getMoneyEmoji } = require('../utils/constants');

const CLAN_COST = 50000;
const MAX_MEMBERS = 15;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan')
    .setDescription('Gestión de Car Gangs y Clubs.')
    .addSubcommand(sub =>
      sub.setName('crear')
        .setDescription('Crea un nuevo clan (Coste: 50.000💰)')
        .addStringOption(opt => opt.setName('nombre').setDescription('Nombre del clan').setRequired(true))
        .addStringOption(opt => opt.setName('tag').setDescription('Etiqueta (3-4 letras)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('unirse')
        .setDescription('Solicita unirte a un clan')
        .addStringOption(opt => opt.setName('tag').setDescription('Tag del clan (Ej: NGG)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('salir')
        .setDescription('Abandona tu clan actual (Si eres líder, se disolverá)')
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Muestra información de un clan o usuario')
        .addStringOption(opt => opt.setName('busqueda').setDescription('Nombre, Tag o mención de usuario').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('lista')
        .setDescription('Muestra el ranking de los mejores clanes')
    )
    .addSubcommand(sub =>
      sub.setName('invitar')
        .setDescription('Invita a un piloto a tu clan (Solo líderes)')
        .addUserOption(opt => opt.setName('piloto').setDescription('Piloto a invitar').setRequired(true))
    )
    .addSubcommand(sub =>
       sub.setName('privado')
         .setDescription('Cambia la privacidad del clan (Solo líderes)')
         .addBooleanOption(opt => opt.setName('privado').setDescription('¿Deseas que el clan sea privado?').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (sub === 'crear') {
      const nombre = interaction.options.getString('nombre');
      const tagRaw = interaction.options.getString('tag');

      if (!nombre || !tagRaw) {
        return interaction.reply({ content: '❌ Debes especificar un **nombre** y un **tag** (Ej: `?clan crear LosNiggas NGG`).', flags: MessageFlags.Ephemeral });
      }
      const tag = tagRaw.toUpperCase();
      if (tag.length < 2 || tag.length > 5) {
        return interaction.reply({ content: '❌ El Tag debe tener entre 2 y 5 caracteres.', flags: MessageFlags.Ephemeral });
      }

      const perfil = await obtenerPerfil(userId);
      if (perfil.clan_id) return interaction.reply({ content: '❌ Ya perteneces a un clan.', flags: MessageFlags.Ephemeral });
      if (perfil.creditos < CLAN_COST) return interaction.reply({ content: `❌ Necesitas **${fmtNum(CLAN_COST)} ${getMoneyEmoji()}** para fundar un clan.`, flags: MessageFlags.Ephemeral });

      const res = await crearClan(nombre, tag, userId);
      if (!res.exito) return interaction.reply({ content: `❌ ${res.error}`, flags: MessageFlags.Ephemeral });

      await restarCreditos(userId, guildId, CLAN_COST);

      const embed = new EmbedBuilder()
        .setTitle(`🆕 CLAN FUNDADO: ${nombre} [${tag}]`)
        .setDescription(`${SEP}\n¡Felicidades <@${userId}>! Has fundado una nueva **Car Gang**.\n\nUsa \`/clan info\` para ver los detalles.`)
        .setColor(COLOR_EXITO)
        .setFooter({ text: FOOTER });

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'unirse') {
      const tagInput = interaction.options.getString('tag');
      const perfil = await obtenerPerfil(userId);

      if (perfil.clan_id) return interaction.reply({ content: '❌ Ya perteneces a un clan.', flags: MessageFlags.Ephemeral });

      const clan = await obtenerClanPorNombreOTag(tagInput);

      if (!clan) return interaction.reply({ content: '❌ No se ha encontrado ningún clan con ese tag.', flags: MessageFlags.Ephemeral });

      // Verificación de privacidad e invitación
      if (clan.privado === 1) {
          const invitacion = await obtenerInvitacion(clan.id, userId);
          if (!invitacion) {
              return interaction.reply({ 
                  content: `❌ El clan **${clan.nombre}** es privado. Necesitas que el líder te invite para unirte.`, 
                  flags: MessageFlags.Ephemeral 
              });
          }
          // Si tiene invitación, la borramos al unirse
          await borrarInvitacion(clan.id, userId);
      }

      const res = await unirseAClan(userId, clan.id);
      if (!res.exito) return interaction.reply({ content: `❌ ${res.error}`, flags: MessageFlags.Ephemeral });

      const embed = new EmbedBuilder()
        .setTitle(`🤝 NUEVO MIEMBRO: ${clan.nombre}`)
        .setDescription(`${SEP}\nTe has unido a **${clan.nombre} [${clan.tag}]**.\n\n¡A darlo todo en el asfalto!`)
        .setColor(COLOR_EXITO)
        .setFooter({ text: FOOTER });

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'salir') {
      const perfil = await obtenerPerfil(userId);
      if (!perfil.clan_id) return interaction.reply({ content: '❌ No perteneces a ningún clan.', flags: MessageFlags.Ephemeral });

      const clan = await obtenerClan(perfil.clan_id);
      const esLider = clan.lider_id === userId;

      await abandonarClan(userId);

      const msg = esLider 
        ? `🚨 El clan **${clan.nombre}** ha sido disuelto porque el líder lo ha abandonado.`
        : `💨 Has abandonado el clan **${clan.nombre}**.`;

      return interaction.reply({ content: msg });
    }

    if (sub === 'info') {
      let query = interaction.options.getString('busqueda');
      let clanId = null;

      if (!query) {
        const p = await obtenerPerfil(userId);
        clanId = p.clan_id;
      } else {
        // Intentar buscar por clan primero
        const clanBusqueda = await obtenerClanPorNombreOTag(query);
        if (clanBusqueda) {
          clanId = clanBusqueda.id;
        } else {
            // Intentar por usuario (si es una mención o ID)
            const mentionId = query.replace(/[<@!>]/g, '');
            const pBusqueda = await obtenerPerfil(mentionId);
            if (pBusqueda && pBusqueda.clan_id) {
                clanId = pBusqueda.clan_id;
            }
        }
      }

      if (!clanId) return interaction.reply({ content: '❌ No se encontró el clan o el usuario no pertenece a ninguno.', flags: MessageFlags.Ephemeral });

      const clan = await obtenerClan(clanId);
      const miembros = await obtenerMiembrosClan(clanId);
      const expTotal = miembros.reduce((acc, m) => acc + (m.exp || 0), 0);

      const embed = new EmbedBuilder()
        .setTitle(`🛡️ CLAN: ${clan.nombre} [${clan.tag}]`)
        .setDescription(
            `**Estado:** ${clan.privado === 1 ? '🔒 Privado' : '🔓 Público'}\n` +
            `**Líder:** <@${clan.lider_id}>\n` +
            `**Nivel:** \`${clan.nivel}\` | **Exp Total:** \`${fmtNum(expTotal)}\` XP\n` +
            `**Miembros:** \`${miembros.length} / ${MAX_MEMBERS}\`\n\n` +
            `${SEP}\n` +
            `**LISTA DE PILOTOS:**\n` +
            miembros.map((m, i) => `\`${i+1}.\` <@${m.usuario_id}> - \`${fmtNum(m.exp)}\` XP`).join('\n')
        )
        .setColor(COLOR_NEUTRO)
        .setFooter({ text: FOOTER });

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'lista') {
        const { obtenerRankingClanes } = require('../database/db');
        const clanes = await obtenerRankingClanes(10);
        if (clanes.length === 0) return interaction.reply({ content: 'No hay clanes registrados todavía.', flags: MessageFlags.Ephemeral });

        const embed = new EmbedBuilder()
            .setTitle('🏆 TOP CAR GANGS')
            .setDescription(
                clanes.map((c, i) => {
                    let medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : '🏁'));
                    return `${medal} **${c.nombre} [${c.tag}]**\n└ Pilotos: \`${c.miembros}\` | Exp: \`${fmtNum(c.exp_total)}\` XP`;
                }).join('\n\n')
            )
            .setColor(0xF1C40F)
            .setFooter({ text: FOOTER });

        return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'invitar') {
        const p = await obtenerPerfil(userId);
        if (!p.clan_id) return interaction.reply({ content: '❌ No perteneces a ningún clan.', flags: MessageFlags.Ephemeral });

        const clan = await obtenerClan(p.clan_id);
        if (clan.lider_id !== userId) return interaction.reply({ content: '❌ Solo el líder del clan puede enviar invitaciones.', flags: MessageFlags.Ephemeral });

        const target = interaction.options.getUser('piloto');
        if (target.id === userId) return interaction.reply({ content: '❌ No puedes invitarte a ti mismo.', flags: MessageFlags.Ephemeral });

        const res = await crearInvitacion(p.clan_id, target.id);
        if (!res) return interaction.reply({ content: '❌ Ya existe una invitación pendiente para este piloto.', flags: MessageFlags.Ephemeral });

        const embed = new EmbedBuilder()
            .setTitle('📧 INVITACIÓN ENVIADA')
            .setDescription(`Se ha enviado una invitación a **${target.displayName}** para unirse a **${clan.nombre}**.\n\nEl piloto ahora puede usar \`/clan unirse busqueda:${clan.tag}\`.`)
            .setColor(COLOR_EXITO)
            .setFooter({ text: FOOTER });

        return interaction.reply({ content: `<@${target.id}>`, embeds: [embed] });
    }

    if (sub === 'privado') {
        const p = await obtenerPerfil(userId);
        if (!p.clan_id) return interaction.reply({ content: '❌ No perteneces a ningún clan.', flags: MessageFlags.Ephemeral });

        const clan = await obtenerClan(p.clan_id);
        if (clan.lider_id !== userId) return interaction.reply({ content: '❌ Solo el líder del clan puede cambiar los ajustes.', flags: MessageFlags.Ephemeral });

        const privado = interaction.options.getBoolean('privado');
        await cambiarEstadoClan(p.clan_id, privado);

        return interaction.reply({ 
            content: `✅ El clan **${clan.nombre}** ahora es **${privado ? 'PRIVADO (Solo con invitación)' : 'PÚBLICO (Cualquiera puede unirse)'}**.` 
        });
    }
  },
};
