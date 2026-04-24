// ============================================================
// commands/activo.js
// Comando /activo — ver o cambiar el coche de carrera activo.
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const {
  obtenerInventario,
  obtenerPerfil,
  setCocheActivo,
}                           = require('../database/db');
const { COLORES, RAREZA,
        FOOTER, COLOR_NEUTRO,
        COLOR_EXITO, SEP, getTierEmoji, getPowerEmoji }  = require('../utils/constants');
const { getCarImage, getTierIcon }       = require('../utils/images');
const coches                = require('../data/coches.json');

const MAPA_COCHES = new Map(coches.map(c => [c.id, c]));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('activo')
    .setDescription('Gestiona tu vehículo principal para las carreras.')
    .addStringOption(opt =>
      opt
        .setName('coche')
        .setDescription('Coche de tu garaje para activar (deja vacío para ver el actual)')
        .setRequired(false)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    const query      = interaction.options.getFocused().toLowerCase().trim();
    const inventario = await obtenerInventario(interaction.user.id, interaction.guildId);

    const resultados = inventario
      .map(instancia => ({
          instancia,
          modelo: MAPA_COCHES.get(instancia.coche_id)
      }))
      .filter(entry => entry.modelo)
      .filter(entry => {
        const m = entry.modelo;
        const i = entry.instancia;
        return !query ||
          m.marca.toLowerCase().includes(query) ||
          m.modelo.toLowerCase().includes(query) ||
          String(m.id).includes(query); // Permitir buscar por ID de Garaje (#63)
      })
      .sort((a, b) => b.modelo.rareza - a.modelo.rareza || b.modelo.cv - a.modelo.cv)
      .slice(0, 25)
      .map(entry => {
          const m = entry.modelo;
          const i = entry.instancia;
          const labelMejoras = (i.motor > 0 || i.turbo > 0) ? ` [Stage ${i.motor + i.turbo}]` : '';
          return {
            name:  `${RAREZA[m.rareza].icono} [#${m.id}] ${m.marca} ${m.modelo}${labelMejoras}`,
            value: String(m.id), // Enviamos el ID de catálogo
          };
      });

    await interaction.respond(resultados);
  },

  async execute(interaction) {
    const userId   = interaction.user.id;
    const guildId  = interaction.guildId;
    const instIdStr = interaction.options.getString('coche');

    // ── MOSTRAR COCHE ACTUAL ──────────────────────────────────
    if (!instIdStr) {
      const { obtenerVehiculoInstancia } = require('../database/db');
      const perfil      = await obtenerPerfil(userId, guildId);
      const instancia   = await obtenerVehiculoInstancia(perfil?.coche_activo, userId);
      const cocheActivo = instancia ? MAPA_COCHES.get(instancia.coche_id) : null;

      if (!cocheActivo) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setAuthor({
                name:    `BOXES: ${interaction.user.displayName}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
              })
              .setTitle('🏎️  Sin vehículo activo')
              .setDescription(
                '> Actualmente no tienes un coche configurado para competir.\n' +
                '> Selecciona uno usando `/activo coche:<nombre>`.'
              )
              .setColor(COLOR_NEUTRO)
              .setFooter({ text: FOOTER }),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }

      const r = RAREZA[cocheActivo.rareza];
      const boost = 1 + (instancia.motor * 0.05);
      const finalCV = Math.round(cocheActivo.cv * boost);

      const { url: carUrl, files: carFiles } = getCarImage(cocheActivo);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name:    `VEHÍCULO EN PISTA: ${interaction.user.displayName}`,
              iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
            })
            .setTitle(`${cocheActivo.marca} ${cocheActivo.modelo}`)
            .setDescription(
              `*${cocheActivo.descripcion}*\n\n` +
              `${SEP}\n` +
              `${getTierEmoji(cocheActivo.rareza)}  **${r.nombre}**  ·  \`${r.grado}\`  ·  ${r.estrellas}\n` +
              `> ⚙️ **Mejoras:** Motor [Lvl ${instancia.motor}] | Turbo [Lvl ${instancia.turbo}] | Peso [Lvl ${instancia.peso}] | Gomas [Lvl ${instancia.gomas}]`,
            )
            .addFields(
              { name: '🏭 Marca',    value: `**${cocheActivo.marca}**`,  inline: true },
              { name: `${getPowerEmoji()} Potencia`, value: `**${finalCV} CV**${instancia.motor > 0 ? ` (+${Math.round(finalCV - cocheActivo.cv)})` : ''}`, inline: true },
              { name: '🆔 ID',        value: `\`#${cocheActivo.id}\``,    inline: true },
            )
            .setColor(COLORES[cocheActivo.rareza])
            .setImage(carUrl)
            .setFooter({ text: `${FOOTER}  ·  Este coche competirá en /carrera` }),
        ],
        files: carFiles
      });
    }

    // ── CAMBIAR COCHE ───────────────────────────────────────
    const inputId = parseInt(instIdStr, 10);
    if (isNaN(inputId)) {
        return interaction.reply({ content: '❌ ID no válido. Usa un número del catálogo.', flags: MessageFlags.Ephemeral });
    }

    const inv = await obtenerInventario(userId, guildId);
    let instancia = null;

    // Buscar SOLO por ID de Catálogo (lo que el usuario ve en el garaje)
    const coincidencias = inv.filter(i => i.coche_id === inputId);

    if (coincidencias.length > 0) {
        // Seleccionamos la mejor unidad (más mejorada) de ese modelo
        instancia = coincidencias.sort((a,b) => (b.motor+b.turbo+b.peso+b.gomas) - (a.motor+a.turbo+a.peso+a.gomas))[0];
    }

    if (!instancia) {
      const cocheCatalogo = MAPA_COCHES.get(inputId);
      const nombreCoche = cocheCatalogo ? `**${cocheCatalogo.marca} ${cocheCatalogo.modelo}**` : `con ID \`#${inputId}\``;

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌  Coche no disponible')
            .setDescription(`> No tienes el ${nombreCoche} en tu garaje.\n> Consíguelo en el \`/roll\` o cómpralo en la \`/tienda\`.`)
            .setColor(0xED4245),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const coche = MAPA_COCHES.get(instancia.coche_id);
    await setCocheActivo(userId, guildId, instancia.id);

    const r = RAREZA[coche.rareza];
    const footerExtra = ''; 

    const boost = 1 + (instancia.motor * 0.05);
    const finalCV = Math.round(coche.cv * boost);

    const { url: carUrl, files: carFiles } = getCarImage(coche);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setAuthor({
            name:    `CONFIGURACIÓN ACTUALIZADA`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
          })
          .setTitle('✅  Listo para la Carrera')
          .setDescription(
            `> Se ha asignado el **${coche.marca} ${coche.modelo}** (#${coche.id}) como tu vehículo principal.\n\n` +
            `${SEP}\n` +
            `${getTierEmoji(coche.rareza)}  **${r.nombre}**  ·  \`${r.grado}\`  ·  ${r.estrellas}`
          )
          .addFields(
            { name: '🏭 Marca',    value: `**${coche.marca}**`, inline: true },
            { name: '📅 Año',      value: `**${coche.anio}**`,  inline: true },
            { name: `${getPowerEmoji()} Potencia`, value: `**${finalCV} CV**${instancia.motor > 0 ? ` (+${Math.round(finalCV - coche.cv)})` : ''}`, inline: true },
          )
          .setColor(COLOR_EXITO)
          .setImage(carUrl)
          .setFooter({ text: `Usa /carrera para probarlo en pista  ·  ${FOOTER}` })
      ],
      files: carFiles
    });
  },
};
