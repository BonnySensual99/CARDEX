// ============================================================
// commands/ranking.js
// Comando /ranking — Rework interactivo con diseño premium.
// ============================================================

const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');

const {
  obtenerRankingCreditos,
  obtenerRankingXP,
  obtenerRankingVictorias,
  obtenerRankingColeccion,
  obtenerRankingClanes,
  getPosicionPersonal,
}                              = require('../database/db');
const { TIERS_DESC, FOOTER, COLOR_RANKING, SEP, fmtNum, getMoneyEmoji, getPowerEmoji, getTierEmoji, getTrophyEmoji } = require('../utils/constants');
const coches = require('../data/coches.json');

const MAPA_COCHES = new Map(coches.map(c => [c.id, c]));
const TOTAL_CATALOGO = coches.length;
const MEDALLAS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const { calcularNivel, obtenerRango } = require('../utils/levels');

function crearFilaBotones(tipoActivo) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ranking_creditos')
            .setLabel('Ricos')
            .setEmoji(getMoneyEmoji())
            .setStyle(tipoActivo === 'creditos' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('ranking_victorias')
            .setLabel('Pilotos')
            .setEmoji(getTrophyEmoji())
            .setStyle(tipoActivo === 'victorias' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('ranking_coleccion')
            .setLabel('Colección')
            .setEmoji('📦')
            .setStyle(tipoActivo === 'coleccion' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('ranking_exp')
            .setLabel('Nivel')
            .setEmoji(getPowerEmoji())
            .setStyle(tipoActivo === 'exp' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('ranking_clanes')
            .setLabel('Clanes')
            .setEmoji('🛡️')
            .setStyle(tipoActivo === 'clanes' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );
}

async function generarEmbedRanking(tipo, guildId, executorId) {
    let filas = [];
    let titulo, color, info;

    if (tipo === 'creditos') {
        filas = await obtenerRankingCreditos(10);
        titulo = `${getMoneyEmoji()} CAPITALISTAS`;
        color = 0xF1C40F;
        info = `Clasificación por créditos en cuenta`;
    } else if (tipo === 'victorias') {
        filas = await obtenerRankingVictorias(10);
        titulo = `${getTrophyEmoji()} LEYENDAS`;
        color = 0x3498DB;
        info = 'Victorias totales en circuitos oficiales';
    } else if (tipo === 'coleccion') {
        filas = await obtenerRankingColeccion(10);
        titulo = '📦 COLECCIONISTAS';
        color = 0x2ECC71;
        info = `Modelos únicos registrados de ${TOTAL_CATALOGO}`;
    } else if (tipo === 'exp') {
        filas = await obtenerRankingXP(10);
        titulo = `${getPowerEmoji()} ÉLITE`;
        color = 0x9B59B6;
        info = `Clasificación por prestigio y experiencia`;
    } else {
        filas = await obtenerRankingClanes(10);
        titulo = '🛡️ CAR GANGS';
        color = 0xBDC3C7;
        info = 'Los clanes más prestigiosos por nivel y XP total';
    }

    const { pos, total } = (tipo === 'clanes') ? { pos: '?', total: '?' } : await getPosicionPersonal(executorId, tipo);

    if (filas.length === 0) {
        return new EmbedBuilder()
            .setTitle(titulo)
            .setDescription('```\nSin registros en el radar todavía...\n```')
            .setColor(color);
    }

    const lineas = filas.map((f, i) => {
        const medallaPos = MEDALLAS[i] || `\`${i+1}.\``;
        const mention = `<@${f.usuario_id}>`;
        
        let valor = '';

        if (tipo === 'creditos') {
            valor = `💰 ${fmtNum(f.creditos)} cr.`;
        } else if (tipo === 'victorias') {
            const v = f.victorias || 0;
            const d = f.derrotas || 0;
            const totalVal = v + d;
            const wr = totalVal > 0 ? Math.round((v / totalVal) * 100) : 0;
            valor = `🏆 ${v} victorias  •  \`${wr}% WR\``;
        } else if (tipo === 'coleccion') {
            const idList = (f.ids || '').split(',').map(Number);
            const counts = {};
            for (const cid of idList) {
                const c = MAPA_COCHES.get(cid);
                if (c) counts[c.rareza] = (counts[c.rareza] || 0) + 1;
            }
            const rarezasStr = [1, 2, 3, 4, 5, 6, 7, 8]
                .map(r => `${getTierEmoji(r, true)} \`${counts[r] || 0}\``)
                .join(' ');
            valor = `📦 ${f.modelos} modelos\núnicos / ${TOTAL_CATALOGO}\n┕ ${rarezasStr}`;
        } else if (tipo === 'exp') {
            const lvl = calcularNivel(f.exp);
            const rango = obtenerRango(lvl);
            valor = `${rango.emoji} ${rango.nombre} (Lvl ${lvl})  •  \`${fmtNum(f.exp)}\` XP`;
        } else if (tipo === 'clanes') {
            return `${medallaPos} ${f.nombre} [${f.tag}]\n┕ Pilotos: ${f.miembros} | Exp: ${fmtNum(f.exp_total)} XP`;
        }

        return `${medallaPos} ${mention}\n┕ ${valor}`;
    });

    return new EmbedBuilder()
        .setTitle(`🏆 Hall de la Fama: ${titulo}`)
        .setDescription(
            `> *${info}*\n` +
            `${SEP}\n\n` +
            lineas.join('\n\n') +
            `\n\n${SEP}`
        )
        .setColor(color)
        .setFooter({ text: `📍 Tu posición actual en esta categoría: #${pos} de ${total} pilotos` })
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112946.png')
        .setTimestamp();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Muestra el Hall de la Fama del servidor.'),

    async execute(interaction) {
        const embed = await generarEmbedRanking('creditos', interaction.guildId, interaction.user.id);
        await interaction.reply({ 
            embeds: [embed], 
            components: [crearFilaBotones('creditos')] 
        });
    },

    async handleButton(interaction, tipo) {
        const map = {
            'ranking_creditos': 'creditos',
            'ranking_victorias': 'victorias',
            'ranking_coleccion': 'coleccion',
            'ranking_exp': 'exp',
            'ranking_clanes': 'clanes'
        };
        const realTipo = map[tipo] || tipo;
        const embed = await generarEmbedRanking(realTipo, interaction.guildId, interaction.user.id);
        await interaction.update({ 
            embeds: [embed], 
            components: [crearFilaBotones(realTipo)] 
        });
    }
};
