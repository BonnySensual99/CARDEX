// ============================================================
// commands/perfil.js
// Comando /perfil [@usuario] — ficha completa del piloto con diseño premium.
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
  obtenerInventario,
  obtenerPerfil,
  obtenerTotalModelos,
  fechaPrimerCoche,
  verificarLimiteRolls,
  obtenerClan
} = require('../database/db');
const { COLORES, RAREZA, TIERS_DESC,
  FOOTER, COLOR_NEUTRO, SEP_SLIM,
  COLOR_PERFIL, SEP, fmtNum, getMoneyEmoji, getTierEmoji, getTierURL, getPowerEmoji, getTrophyEmoji, getModifiedCV } = require('../utils/constants');
const { getCarImage } = require('../utils/images');
const { calcularNivel, obtenerRango, generarBarraExp, calcularMaxApuesta } = require('../utils/levels');
const coches = require('../data/coches.json');

const MAPA_COCHES = new Map(coches.map(c => [c.id, c]));
const TOTAL_CATALOGO = coches.length;

/** Formatea una fecha ISO a formato legible */
function formatFecha(isoStr) {
  if (!isoStr) return 'Recién llegado';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch { return 'Sin datos'; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Consulta tu licencia de piloto: créditos, estadísticas y colección.')
    .addUserOption(opt =>
      opt
        .setName('piloto')
        .setDescription('Piloto del que consultar el perfil')
        .setRequired(false),
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('piloto') ?? interaction.user;
    const userId = target.id;
    const guildId = interaction.guildId;

    const perfil = await obtenerPerfil(userId, guildId);
    const inventario = await obtenerInventario(userId, guildId);
    const totalModelos = await obtenerTotalModelos(userId, guildId);
    const primeraFech = await fechaPrimerCoche(userId, guildId);

    // Sin actividad
    if (inventario.length === 0 && !perfil?.creditos && !perfil?.victorias) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`📇  Licencia no emitida: ${target.displayName}`)
            .setDescription(
              '> Este piloto aún no ha registrado actividad en el circuito.\n' +
              '> ¡Usa **/roll** para obtener tu primer coche y empezar!',
            )
            .setColor(COLOR_NEUTRO)
            .setFooter({ text: FOOTER }),
        ],
      });
    }

    // Estadísticas
    const creditos = perfil?.creditos ?? 0;
    const victorias = perfil?.victorias ?? 0;
    const derrotas = perfil?.derrotas ?? 0;
    const expTotales = perfil?.exp ?? 0;
    const rollsTotales = perfil?.rolls_totales ?? 0;

    // Cálculos de nivel
    const nivelActual = calcularNivel(expTotales);
    const rangoActual = obtenerRango(nivelActual);
    const progresoExp = generarBarraExp(expTotales);
    const maxApuestaNvl = calcularMaxApuesta(nivelActual);
    const limiteRolls = await verificarLimiteRolls(userId);
    const rollsQuedan = limiteRolls.restantes ?? 0;

    const totalCarreras = victorias + derrotas;
    const winRate = totalCarreras > 0 ? Math.round((victorias / totalCarreras) * 100) : 0;
    const pctColeccion = Math.round((totalModelos / TOTAL_CATALOGO) * 100);

    // Desglose de rarezas coleccionadas
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
    const unicosId = new Set();
    for (const e of inventario) {
      if (!unicosId.has(e.coche_id)) {
        unicosId.add(e.coche_id);
        const c = MAPA_COCHES.get(e.coche_id);
        if (c) counts[c.rareza]++;
      }
    }
    const breakdownStr = Object.keys(counts)
      .reverse()
      .map(r => `${getTierEmoji(Number(r), true)} \`${counts[r]}\``)
      .join('  ');

    // Hallar mejor coche
    const rarezaMax = Math.max(...Array.from(unicosId).map(id => MAPA_COCHES.get(id)?.rareza || 0));
    const mejorCoche = Array.from(unicosId)
      .map(id => MAPA_COCHES.get(id))
      .filter(c => c.rareza === rarezaMax)
      .sort((a, b) => b.cv - a.cv)[0];

    // Coche activo actual
    const { obtenerVehiculoInstancia } = require('../database/db');
    const instanciaActiva = await obtenerVehiculoInstancia(perfil?.coche_activo, userId);
    const cocheActivo = instanciaActiva ? MAPA_COCHES.get(instanciaActiva.coche_id) : null;

    // Visual: Barras de progreso premium
    const barEmpty = '░';
    const barFull = '█';
    const renderBar = (pct) => barFull.repeat(Math.round(pct / 10)) + barEmpty.repeat(10 - Math.round(pct / 10));

    const rankClan = perfil?.clan_id ? await obtenerClan(perfil.clan_id) : null;
    const clanTag = rankClan ? `[${rankClan.tag}] ` : '';

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `LICENCIA DE PILOTO: ${rangoActual.nombre.toUpperCase()}`,
        iconURL: getMoneyEmoji(true),
      })
      .setTitle(`📇 EXTRACCIÓN DE DATOS: ${clanTag}${target.displayName.toUpperCase()}`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 512 }))
      .setColor(rangoActual.color)
      .setDescription(
        `### ${rangoActual.emoji} **Nivel ${nivelActual} · ${rangoActual.nombre}**\n` +
        `> Experiencia: \`${fmtNum(progresoExp.actual)} / ${fmtNum(progresoExp.total)} XP\`\n` +
        `> \`${progresoExp.barra}\` **${progresoExp.pct}%**\n` +
        `${SEP_SLIM}`
      )
      .addFields(
        {
          name: `${getMoneyEmoji()} Economía y Recursos`,
          value: `> Créditos: **${fmtNum(creditos)} ${getMoneyEmoji()}**\n` +
                 `> Apuesta Máx: **${fmtNum(maxApuestaNvl)} ${getMoneyEmoji()}**\n` +
                 `> Disponibles: **${limiteRolls.normales} / 50** 🎲${limiteRolls.extras > 0 ? ` _(+${limiteRolls.extras} 💎)_` : ''}\n` +
                 `> Piezas de Desguace: **${perfil.piezas || 0}** 🧩\n` +
                 `> Rolls totales: **${fmtNum(rollsTotales)}** 🔄`,
          inline: false
        },
        {
          name: `${getTrophyEmoji()} Desempeño en Pista`,
          value:
            `> Victorias: **${victorias}** | Derrotas: **${derrotas}**\n` +
            `> Éxito: \`${winRate}%\` ${renderBar(winRate)}`,
          inline: true
        },
        {
          name: '📦 Garaje y Colección',
          value:
            `> Modelos: **${totalModelos}** / **${TOTAL_CATALOGO}**\n` +
            `> Progreso: \`${pctColeccion}%\` ${renderBar(pctColeccion)}`,
          inline: true
        },
        {
          name: '💎 DESGLOSE POR RAREZAS',
          value: breakdownStr || '> *Ningún vehículo en el garaje*',
          inline: false
        },
        { name: SEP_SLIM, value: '\u200b', inline: false },
        {
          name: 'Vehículo en Pista',
          value: cocheActivo
            ? `${getTierEmoji(cocheActivo.rareza, true)} **${cocheActivo.marca} ${cocheActivo.modelo}**\n` +
              `\`${RAREZA[cocheActivo.rareza].grado}\` · ${getPowerEmoji()} \`${getModifiedCV(cocheActivo.cv, instanciaActiva)} CV\`\n` +
              `⚖️ \`${fmtNum(Math.round(cocheActivo.peso_kg * (1 - (instanciaActiva.peso * 0.03))))} kg\``
            : '❌ *Sin coche asignado*\nUsa `/activo` para elegir uno.',
          inline: true
        },
        {
          name: 'Mayor Hallazgo',
          value: mejorCoche
            ? `${getTierEmoji(mejorCoche.rareza, true)} **${mejorCoche.marca} ${mejorCoche.modelo}**\n` +
              `\`${RAREZA[mejorCoche.rareza].grado}\` · ${getPowerEmoji()} \`${mejorCoche.cv} CV\``
            : 'Nada destacable aún',
          inline: true
        }
      );

    const targetCoche = cocheActivo || mejorCoche;
    const carFiles = [];
    if (targetCoche) {
      const { url: carUrl, files: imgs } = getCarImage(targetCoche);
      if (carUrl) {
        embed.setThumbnail(carUrl);
        carFiles.push(...imgs);
      }
    }

    await interaction.reply({ embeds: [embed], files: carFiles });
  },
};

