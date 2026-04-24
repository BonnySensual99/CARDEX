// ============================================================
// commands/garaje.js
// Comando /garaje — Álbum de coleccionista interactivo con soporte para otros usuarios.
// ============================================================

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags
} = require('discord.js');

const {
    obtenerInventario,
    obtenerPerfil,
} = require('../database/db');
const { TIERS_DESC, COLORES, RAREZA,
    FOOTER, COLOR_NEUTRO, SEP,
    fmtNum, getTierEmoji, getMoneyEmoji, getPowerEmoji, getLockedEmoji, getUnlockedEmoji, getTrophyEmoji } = require('../utils/constants');
const { getCarImage } = require('../utils/images');
const coches = require('../data/coches.json');

const MAPA_COCHES = new Map(coches.map(c => [c.id, c]));
const TOTAL_CATALOGO = coches.length;
const ITEMS_POR_PAGINA = 15;

const CATALOGO_POR_RAREZA = {};
for (const c of coches) {
    if (!CATALOGO_POR_RAREZA[c.rareza]) CATALOGO_POR_RAREZA[c.rareza] = [];
    CATALOGO_POR_RAREZA[c.rareza].push(c);
}

/** Genera la fila del menú desplegable, incluyendo el ID del dueño del garaje */
function crearFilaSelect(targetId, rarezaSeleccionada = null) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(`garaje_filtro_${targetId}`)
        .setPlaceholder('Filtrar por rareza para ver el Álbum...');

    for (const tier of TIERS_DESC) {
        select.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(tier.nombre)
                .setEmoji(getTierEmoji(tier.rareza))
                .setValue(tier.rareza.toString())
                .setDefault(rarezaSeleccionada === tier.rareza.toString())
        );
    }
    return new ActionRowBuilder().addComponents(select);
}

/** Genera los botones de página, incluyendo el ID del dueño */
function crearFilaBotones(targetId, rareza, pagina) {
    const totalCoches = CATALOGO_POR_RAREZA[rareza]?.length || 0;
    const totalPaginas = Math.ceil(totalCoches / ITEMS_POR_PAGINA);

    if (totalPaginas <= 1) return null;

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`garaje_page_${targetId}_${rareza}_${pagina - 1}`)
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pagina <= 0),
        new ButtonBuilder()
            .setCustomId(`info_pag`)
            .setLabel(`Pág. ${pagina + 1} de ${totalPaginas}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`garaje_page_${targetId}_${rareza}_${pagina + 1}`)
            .setEmoji('➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pagina >= totalPaginas - 1)
    );
}

/** Genera un menú para interactuar con los coches de la página actual */
function crearFilaInteractiva(subLista, inventario, targetId) {
    const ownedIds = new Set(inventario.map(e => e.coche_id));
    const itemsOwned = subLista.filter(c => ownedIds.has(c.id));

    if (itemsOwned.length === 0) return null;

    const select = new StringSelectMenuBuilder()
        .setCustomId(`garaje_action_${targetId}`)
        .setPlaceholder('🔧 Gestionar vehículo de esta página...');

    itemsOwned.forEach(c => {
        select.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(`${c.marca} ${c.modelo} (#${c.id})`)
                .setDescription(`Equipar o ver detalles técnicos`)
                .setValue(c.id.toString())
        );
    });

    return new ActionRowBuilder().addComponents(select);
}

function crearEmbedResumen(targetUser, perfil, inventario) {
    const modelosUnicos = new Set(inventario.map(e => e.coche_id)).size;
    const pctColeccion = Math.round((modelosUnicos / TOTAL_CATALOGO) * 100);
    const bloquesFull = Math.min(10, Math.round(pctColeccion / 10));
    const barraProgreso = '▰'.repeat(bloquesFull) + '▱'.repeat(10 - bloquesFull);

    // Desglose por rareza
    const counts = {}; // { rarity: { unique: Set, total: 0 } }
    TIERS_DESC.forEach(t => counts[t.rareza] = { unique: new Set(), total: 0 });

    for (const e of inventario) {
        const c = MAPA_COCHES.get(e.coche_id);
        if (c && counts[c.rareza]) {
            counts[c.rareza].unique.add(c.id);
            counts[c.rareza].total++;
        }
    }

    const desglose = TIERS_DESC.map(t => {
        const data = counts[t.rareza];
        return `${getTierEmoji(t.rareza)} ${t.nombre}: ${data.unique.size} únicos (${data.total} copias)`;
    }).join('\n');

    return new EmbedBuilder()
        .setAuthor({ name: `Garaje de ${targetUser.displayName}`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
        .setTitle('📊 ESTADO DE LA COLECCIÓN')
        .setDescription(
            `${getTrophyEmoji()} **Progreso Global:** \`${pctColeccion}%\`\n` +
            `\`${barraProgreso}\`  (${modelosUnicos} / ${TOTAL_CATALOGO})\n\n` +
            `💰 **Créditos:** ${fmtNum(perfil?.creditos ?? 0)} ${getMoneyEmoji()}\n\n` +
            `### 📦 Inventario por Rareza\n${desglose}`
        )
        .setColor(COLOR_NEUTRO);
}

function crearEmbedAlbum(targetUser, rarezaNivel, inventario, pagina = 0) {
    const tier = RAREZA[rarezaNivel];
    const baseCoches = CATALOGO_POR_RAREZA[rarezaNivel] || [];
    const conteo = {};
    const maxMotor = {}; // Para mostrar el mejor nivel de motor que tenga el usuario en este modelo
    for (const e of inventario) {
        conteo[e.coche_id] = (conteo[e.coche_id] || 0) + 1;
        maxMotor[e.coche_id] = Math.max(maxMotor[e.coche_id] || 0, e.motor || 0);
    }

    // Ordenar por CV (considerando motor si se posee) descendente
    const cochesDelTier = [...baseCoches].sort((a, b) => {
        const cvA = a.cv * (1 + (maxMotor[a.id] || 0) * 0.05);
        const cvB = b.cv * (1 + (maxMotor[b.id] || 0) * 0.05);
        return cvB - cvA;
    });

    const obtenidosCount = Object.keys(conteo).filter(id => {
        const c = MAPA_COCHES.get(Number(id));
        return c && c.rareza === parseInt(rarezaNivel);
    }).length;
    const totalCount = cochesDelTier.length;

    const subLista = cochesDelTier.slice(pagina * ITEMS_POR_PAGINA, (pagina + 1) * ITEMS_POR_PAGINA);

    const lineas = subLista.map(c => {
        const copias = (conteo[c.id] || 0);
        const tiene = copias > 0;
        const emoji = tiene ? getUnlockedEmoji() : getLockedEmoji();
        const nombre = tiene ? `**${c.marca} ${c.modelo}** \`[x${copias}]\`` : `*~~${c.marca} ${c.modelo}~~*`;

        // Calcular CV con la mejor versión que tengas
        const motorLvl = (maxMotor[c.id] || 0);
        const boost = 1 + (motorLvl * 0.05);
        const finalCV = Math.round(c.cv * boost);
        const info = `ID: \`#${c.id}\` · ${getPowerEmoji()} ${finalCV} CV${motorLvl > 0 ? ` (+${Math.round(finalCV - c.cv)})` : ''}`;

        return `${emoji} ${nombre}\n╰─ ${info}`;
    });

    return new EmbedBuilder()
        .setAuthor({ name: `📚 Álbum de ${targetUser.displayName}`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
        .setTitle(`${getTierEmoji(rarezaNivel)} Catálogo: ${tier.nombre.toUpperCase()}`)
        .setDescription(`Has conseguido **${obtenidosCount}** de **${totalCount}**\n\n` + lineas.join('\n'))
        .setColor(COLORES[rarezaNivel])
        .setFooter({ text: `${FOOTER}` });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('garaje')
        .setDescription('Muestra el garaje y catálogo de un usuario.')
        .addUserOption(opt => opt.setName('usuario').setDescription('El usuario cuyo garaje quieres ver')),

    async execute(interaction) {
        const targetUser = interaction.options?.getUser('usuario') || interaction.user;
        const inventario = await obtenerInventario(targetUser.id, interaction.guildId);
        const perfil = await obtenerPerfil(targetUser.id, interaction.guildId);

        const embed = crearEmbedResumen(targetUser, perfil, inventario);
        await interaction.reply({ embeds: [embed], components: [crearFilaSelect(targetUser.id)] });
    },

    async handleSelectMenu(interaction, args) {
        if (interaction.customId.startsWith('garaje_action_')) return this.handleAction(interaction, args);

        const targetId = args[1]; // garaje_filtro_ID
        const rarezaSeleccionada = interaction.values[0];
        const targetUser = await interaction.client.users.fetch(targetId);
        const inventario = await obtenerInventario(targetId, interaction.guildId);

        // Obtener sublista para la fila interactiva
        const baseCoches = CATALOGO_POR_RAREZA[rarezaSeleccionada] || [];
        const maxMotor = {};
        for (const e of inventario) maxMotor[e.coche_id] = Math.max(maxMotor[e.coche_id] || 0, e.motor || 0);
        const cochesOrdenados = [...baseCoches].sort((a, b) => {
            const cvA = a.cv * (1 + (maxMotor[a.id] || 0) * 0.05);
            const cvB = b.cv * (1 + (maxMotor[b.id] || 0) * 0.05);
            return cvB - cvA;
        });
        const subLista = cochesOrdenados.slice(0, ITEMS_POR_PAGINA);

        const embed = crearEmbedAlbum(targetUser, rarezaSeleccionada, inventario, 0);
        const filaBotones = crearFilaBotones(targetId, rarezaSeleccionada, 0);
        const filaInteractiva = crearFilaInteractiva(subLista, inventario, targetId);

        const componentes = [crearFilaSelect(targetId, rarezaSeleccionada)];
        if (filaInteractiva) componentes.push(filaInteractiva);
        if (filaBotones) componentes.push(filaBotones);

        await interaction.update({ embeds: [embed], components: componentes });
    },

    async handleButton(interaction, args) {
        // args: [ "garaje", "page", targetId, rareza, numPagina ] O [ "garaje", "exec", action, cocheId ]
        if (args[1] === 'exec') return this.handleExec(interaction, args[2], args[3]);

        const targetId = args[2];
        const rareza = args[3];
        const pagina = parseInt(args[4]);
        const targetUser = await interaction.client.users.fetch(targetId);
        const inventario = await obtenerInventario(targetId, interaction.guildId);

        // Calcular sublista para la fila interactiva
        const baseCoches = CATALOGO_POR_RAREZA[rareza] || [];
        const maxMotor = {};
        for (const e of inventario) maxMotor[e.coche_id] = Math.max(maxMotor[e.coche_id] || 0, e.motor || 0);
        const cochesOrdenados = [...baseCoches].sort((a, b) => {
            const cvA = a.cv * (1 + (maxMotor[a.id] || 0) * 0.05);
            const cvB = b.cv * (1 + (maxMotor[b.id] || 0) * 0.05);
            return cvB - cvA;
        });
        const subLista = cochesOrdenados.slice(pagina * ITEMS_POR_PAGINA, (pagina + 1) * ITEMS_POR_PAGINA);

        const embed = crearEmbedAlbum(targetUser, rareza, inventario, pagina);
        const filaBotones = crearFilaBotones(targetId, rareza, pagina);
        const filaInteractiva = crearFilaInteractiva(subLista, inventario, targetId);

        const componentes = [crearFilaSelect(targetId, rareza)];
        if (filaInteractiva) componentes.push(filaInteractiva);
        if (filaBotones) componentes.push(filaBotones);

        await interaction.update({ embeds: [embed], components: componentes });
    },

    async handleAction(interaction, args) {
        const targetId = args[1]; // garaje_action_ID
        const cocheId = interaction.values[0];
        const coche = MAPA_COCHES.get(Number(cocheId));

        if (interaction.user.id !== targetId) {
            // Si otro usuario está mirando el garaje, solo puede ver info
            const infoCmd = require('./info');
            const customInt = Object.create(interaction);
            customInt.options = { getString: () => cocheId };
            return infoCmd.execute(customInt);
        }

        const { url: carUrl, files: carFiles } = getCarImage(coche);

        const embed = new EmbedBuilder()
            .setTitle(`🛠️ Gestión: ${coche.marca} ${coche.modelo}`)
            .setDescription(`¿Qué deseas hacer con tu **${coche.marca} ${coche.modelo}**?`)
            .setColor(COLORES[coche.rareza])
            .setThumbnail(carUrl);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`garaje_exec_active_${cocheId}`)
                .setLabel('Equipar (Activar)')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`garaje_exec_info_${cocheId}`)
                .setLabel('Ver Ficha Técnica')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [embed], components: [row], files: carFiles, flags: MessageFlags.Ephemeral });
    },

    async handleExec(interaction, action, cocheId) {
        if (action === 'active') {
            const activoCmd = require('./activo');
            const customInt = Object.create(interaction);
            customInt.options = { getString: () => cocheId };
            customInt.reply = async (params) => {
                if (interaction.deferred || interaction.replied) return interaction.followUp({ ...params, flags: MessageFlags.Ephemeral });
                return interaction.reply({ ...params, flags: MessageFlags.Ephemeral });
            };
            await activoCmd.execute(customInt);
        } else {
            const infoCmd = require('./info');
            const customInt = Object.create(interaction);
            customInt.options = { getString: () => cocheId };
            customInt.reply = async (params) => {
                if (interaction.deferred || interaction.replied) return interaction.followUp({ ...params, flags: MessageFlags.Ephemeral });
                return interaction.reply({ ...params, flags: MessageFlags.Ephemeral });
            };
            await infoCmd.execute(customInt);
        }
    }
};


