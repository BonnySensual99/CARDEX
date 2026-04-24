// ============================================================
// commands/tienda.js
// Terminal Central de Gestión y Mercado Global - ADAPTADO A MYSQL
// ============================================================

const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const { getCarImage, getHubImage } = require('../utils/images');
const { COLORES, RAREZA, TIERS_DESC, FOOTER, COLOR_DIARIO, COLOR_ERROR, COLOR_EXITO, SEP, SEP_SLIM, fmtNum, getTierEmoji, getMoneyEmoji, getPowerEmoji } = require('../utils/constants');
const { 
    obtenerPerfil, sumarPieza, añadirCocheGaraje, sumarCreditos, restarCreditos, sumarExtraRolls,
    obtenerMercado, obtenerItemMercado, procesarCompraMercado, contarItemsMercado, obtenerInventario,
    publicarVenta, cancelarVenta, obtenerVehiculoInstancia, procesarContrato, subirMejoraVehiculo,
    verificarLimiteTienda, obtenerUltimosCoches, setCocheActivo
} = require('../database/db');
const { calcularNivel } = require('../utils/levels');
const coches = require('../data/coches.json');
const MAPA_COCHES = new Map(coches.map(c => [c.id, c]));

// --- INTERNAL HELPERS ---
function embedHome() {
    const { url: hubUrl, files: hubFiles } = getHubImage();
    const embed = new EmbedBuilder()
      .setAuthor({ name: 'CENTRAL DE OPERACIONES: CARDEX HUB', iconURL: 'https://cdn-icons-png.flaticon.com/512/3085/3085330.png' })
      .setTitle('SISTEMA INTEGRAL DE GESTIÓN DE PILOTOS')
      .setDescription(
        `Bienvenido a la terminal central de **Cardex**. Gestiona tu carrera y colección.\n\n` +
        `> *Selecciona una terminal en el menú inferior para iniciar operaciones oficiales.*`
      )
      .addFields(
        { name: '🏢 SEDE COMERCIAL', value: '`Concesionario`: Packs de vehículos nuevos.', inline: false },
        { name: '🔧 DEPARTAMENTO TÉCNICO', value: '`Taller`: Mejora de piezas y rendimiento.', inline: false },
        { name: '📜 OFICINA DE REGISTRO', value: '`Contratos`: Intercambio de modelos repetidos.', inline: false },
        { name: '🤝 MERCADO GLOBAL', value: '`Subastas`: Compra-venta entre jugadores.', inline: false },
        { name: '🏚️ SECTOR DESGUACE', value: '`Restauración`: Canjea piezas por coches únicos.', inline: false }
      )
      .setColor(0x2B2D31)
      .setImage(hubUrl)
      .setFooter({ text: 'CARDEX NET  ·  SISTEMA SEGURO' });

    return { embed, files: hubFiles };
}

async function embedConcesionario(userId) {
    const p = await obtenerPerfil(userId);
    const limite = await verificarLimiteTienda(userId, 10);
    
    return new EmbedBuilder()
    .setAuthor({ name: 'SHOWROOM: AUTOMOCIÓN DE ÉLITE', iconURL: 'https://cdn-icons-png.flaticon.com/512/3085/3085330.png' })
    .setTitle('ADQUISICIÓN DE VEHÍCULOS')
    .setDescription(
      `💳 **Tu Saldo:** ${fmtNum(p?.creditos ?? 0)} ${getMoneyEmoji()}\n` +
      `📅 **Límite Diario:** \`${limite.restantes}/10\` packs disponibles hoy.\n${SEP}`
    )
    .addFields(
      { name: '📦 Pack Estándar', value: `Tirada aleatoria completa.\n**15.000 ${getMoneyEmoji()}**`, inline: true },
      { name: '💎 Pack Épico', value: `Garantiza **S**+.\n**120.000 ${getMoneyEmoji()}**`, inline: true },
      { name: '👑 Pack Legendario', value: `Garantiza **SS**+.\n**500.000 ${getMoneyEmoji()}**`, inline: true },
      { name: '🔥 Pack Mítico', value: `Garantiza **SSS**+.\n**1.500.000 ${getMoneyEmoji()}**`, inline: true }
    )
    .setColor(COLOR_DIARIO)
    .setThumbnail('https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?q=80&w=1200');
}

async function embedDesguace(userId) {
    const p = await obtenerPerfil(userId);
    return new EmbedBuilder()
    .setAuthor({ name: 'SECTOR LIMITADO: EL DESGUACE', iconURL: 'https://cdn-icons-png.flaticon.com/512/1048/1048953.png' })
    .setTitle('📦 TALLER DE RESTAURACIÓN')
    .setDescription(
      `Utiliza las piezas (🧩) encontradas en el desguace para restaurar coches o canjear recursos.\n\n` +
      `🧩 **Tus Piezas:** **${p?.piezas || 0}**\n${SEP}`
    )
    .addFields(
      { name: `${getTierEmoji(8, true)} Restauración Secreta`, value: `Ensambla un **Secreto (R8)**.\n**Coste: 150 Piezas**`, inline: true },
      { name: `${getTierEmoji(7, true)} Restauración Mítica`, value: `Ensambla un **Mítico (SSS)**.\n**Coste: 50 Piezas**`, inline: true },
      { name: `${getTierEmoji(6, true)} Restauración Leg.`, value: `Ensambla un **Legendario (SS)**.\n**Coste: 30 Piezas**`, inline: true },
      { name: `${getTierEmoji(5, true)} Restauración Épica`, value: `Ensambla un **Épico (S)**.\n**Coste: 15 Piezas**`, inline: true },
      { name: '💰 Lavado Dinero', value: `Recibe **25.000 💰**.\n**Coste: 10 Piezas**`, inline: true },
      { name: '🔌 Inyección Vales', value: `Recibe **15 Rolls**.\n**Coste: 5 Piezas**`, inline: true }
    )
    .setColor(0xFFAA00)
    .setThumbnail('https://images.unsplash.com/photo-1549490349-8643362247b5?q=80&w=400');
}

function crearFilaCategorias() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('tienda_category_select').setPlaceholder('Navegar por las terminales...').addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Concesionario').setDescription('Compra de packs de coches').setEmoji('🏢').setValue('view_coches'),
            new StringSelectMenuOptionBuilder().setLabel('Taller').setDescription('Mejora tu coche activo').setEmoji('🔧').setValue('view_taller'),
            new StringSelectMenuOptionBuilder().setLabel('Contratos').setDescription('Intercambio de duplicados').setEmoji('📜').setValue('view_contratos'),
            new StringSelectMenuOptionBuilder().setLabel('Mercado').setDescription('Compra/Venta entre pilotos').setEmoji('🤝').setValue('view_mercado'),
            new StringSelectMenuOptionBuilder().setLabel('El Desguace').setDescription('Canje de piezas (Restauración)').setEmoji('🏚️').setValue('view_desguace')
        )
    );
}

// --- MERCADO P2P ---
async function embedMercado(viewerId, pagina = 0) {
    const LIMITE = 10;
    const items = await obtenerMercado(pagina, LIMITE);
    const total = await contarItemsMercado();
    const totalPaginas = Math.ceil(total / LIMITE);

    const lista = items.length > 0
        ? items.map((it, i) => {
            const c = MAPA_COCHES.get(it.coche_id);
            const r = RAREZA[c.rareza];
            const esMio = it.usuario_id === viewerId;
            const pos = (pagina * LIMITE) + i + 1;
            return `**${pos}. ${c.marca} ${c.modelo}** [${r.grado}]${esMio ? ' **(TUYO)**' : ''}\n` +
                   `> 🔧 \`M${it.motor || 0} T${it.turbo || 0} Trans${it.trans || 0}\`\n` +
                   `> 👤 <@${it.usuario_id}>  ·  💰 **${fmtNum(it.precio)} ${getMoneyEmoji()}**`;
          }).join('\n' + SEP_SLIM + '\n')
        : '*Parece que el mercado está vacío hoy...*';

    return new EmbedBuilder()
        .setAuthor({ name: 'MERCADO DE SEGUNDA MANO: CARSDAE TRADE', iconURL: 'https://cdn-icons-png.flaticon.com/512/3050/3050212.png' })
        .setTitle(`🤝 COMPRA-VENTA (Pág. ${pagina + 1}/${totalPaginas || 1})`)
        .setDescription(`### 🏦 Listado de Vehículos Disponibles:\n\n${lista}`)
        .setColor(0x00AAFF)
        .setFooter({ text: 'Selecciona una unidad en el menú inferior para comprar' });
}

async function embedMisVentas(userId) {
    const allMarket = await obtenerMercado(0, 50);
    const items = allMarket.filter(it => it.usuario_id === userId);
    const lista = items.length > 0
        ? items.map(it => {
            const c = MAPA_COCHES.get(it.coche_id);
            return `• **${c.marca} ${c.modelo}** (#${it.coche_id})\n` +
                   `> 🔧 \`M${it.motor || 0} T${it.turbo || 0} Trans${it.trans || 0}\` · **${fmtNum(it.precio)} ${getMoneyEmoji()}**`;
        }).join('\n')
        : '*No tienes ningún coche a la venta actualmente.*';

    return new EmbedBuilder()
        .setAuthor({ name: 'TUS ANUNCIOS ACTIVOS', iconURL: 'https://cdn-icons-png.flaticon.com/512/3050/3050212.png' })
        .setDescription(`Aquí puedes gestionar los coches que tienes publicados en el mercado global:\n\n${lista}`)
        .setColor(0xFFAA00);
}

async function crearFilaMercado(viewerId, pagina = 0) {
    const allMarket = await obtenerMercado(pagina, 10);
    const items = allMarket.filter(it => it.usuario_id !== viewerId);
    if (items.length === 0) return null;

    const select = new StringSelectMenuBuilder().setCustomId('tienda_buy_mercado_select').setPlaceholder('🛒 Selecciona un coche para comprar...');
    items.forEach(it => {
        const c = MAPA_COCHES.get(it.coche_id);
        select.addOptions(new StringSelectMenuOptionBuilder().setLabel(`${c.marca} ${c.modelo} (#${it.coche_id})`).setDescription(`[M${it.motor || 0} T${it.turbo || 0}] · Precio: ${fmtNum(it.precio)} ${getMoneyEmoji()}`).setValue(String(it.id)));
    });
    return new ActionRowBuilder().addComponents(select);
}

async function crearFilaPaginacionMercado(pagina = 0) {
    const totalCount = await contarItemsMercado();
    const totalPaginas = Math.ceil(totalCount / 10);
    if (totalPaginas <= 1) return null;

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tienda_market_page_${pagina - 1}`).setLabel('Anterior').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(pagina <= 0),
        new ButtonBuilder().setCustomId(`tienda_market_page_${pagina + 1}`).setLabel('Siguiente').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(pagina >= totalPaginas - 1)
    );
}

async function crearFilaCancelarVentas(userId) {
    const allMarket = await obtenerMercado(0, 100);
    const items = allMarket.filter(it => it.usuario_id === userId);
    if (items.length === 0) return null;
    const select = new StringSelectMenuBuilder().setCustomId('tienda_market_cancel_select').setPlaceholder('❌ Selecciona un anuncio para cancelar...');
    items.forEach(it => {
        const c = MAPA_COCHES.get(it.coche_id);
        select.addOptions(new StringSelectMenuOptionBuilder().setLabel(`${c.marca} ${c.modelo} (#${it.coche_id})`).setDescription(`Recuperar coche (Precio: ${fmtNum(it.precio)} ${getMoneyEmoji()})`).setValue(String(it.id)));
    });
    return new ActionRowBuilder().addComponents(select);
}

function crearFilaAccionesMercado(actual = null) {
    const select = new StringSelectMenuBuilder()
        .setCustomId('tienda_market_action_select')
        .setPlaceholder('⚙️ Opciones de Mercado...')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Comprar Vehículos').setDescription('Ver subastas activas').setEmoji('🛒').setValue('buy').setDefault(actual === 'buy'),
            new StringSelectMenuOptionBuilder().setLabel('Mis Anuncios').setDescription('Gestionar o cancelar tus ventas').setEmoji('📄').setValue('mine').setDefault(actual === 'mine')
        );

    const btnVender = new ButtonBuilder()
        .setCustomId('tienda_market_sell_trigger_modal')
        .setLabel('Publicar Coche')
        .setEmoji('🏷️')
        .setStyle(ButtonStyle.Success);

    return [new ActionRowBuilder().addComponents(select), new ActionRowBuilder().addComponents(btnVender)];
}

// --- TALLER ---
const PRECIOS_BASE = [
  10000, 25000, 65000, 150000, 400000,
  1000000, 1800000, 3200000, 5500000, 8000000,
  12000000, 18000000, 26000000, 38000000, 55000000
];

function getStageLimits(stage) {
    return { minLvl: (stage - 1) * 5, maxLvl: stage * 5 };
}

async function embedTaller(userId, guildId, stage = 1) {
    const p = await obtenerPerfil(userId);
    const instancia = await obtenerVehiculoInstancia(p?.coche_activo, userId);
    const coche = instancia ? MAPA_COCHES.get(instancia.coche_id) : null;
    if (!coche) return { embed: new EmbedBuilder().setTitle('⚠️ Taller Cerrado').setDescription('Selecciona un coche activo primero con `/activo`.').setColor(COLOR_ERROR), files: [] };
    
    const MULT_RAREZA = { 1: 1, 2: 1.1, 3: 1.2, 4: 1.4, 5: 1.8, 6: 2.6, 7: 4.5, 8: 8 };
    const mult = MULT_RAREZA[coche.rareza] || 1;
    const calcPrecio = (lvl) => lvl >= 15 ? 'MAX' : fmtNum(Math.round(PRECIOS_BASE[lvl] * mult));
    
    const { minLvl, maxLvl } = getStageLimits(stage);
    const getProgresoStr = (lvl) => {
        if (lvl >= maxLvl) return `\`▰▰▰▰▰\` (5/5) MAX`;
        if (lvl < minLvl) return `\`▱▱▱▱▱\` (0/5) Req S${stage-1}`;
        const pLvl = lvl - minLvl;
        return `\`${'▰'.repeat(pLvl)}${'▱'.repeat(5-pLvl)}\` (${pLvl}/5)`;
    };
    
    const { url: carUrl, files: carFiles } = getCarImage(coche);
    const fPrice = (lvl) => lvl >= maxLvl ? 'MAX' : (lvl < minLvl ? '🔒' : `${calcPrecio(lvl)} ${getMoneyEmoji()}`);

    const embed = new EmbedBuilder()
      .setAuthor({ name: `CENTRO TÉCNICO — STAGE ${stage}`, iconURL: 'https://cdn-icons-png.flaticon.com/512/3061/3061858.png' })
      .setTitle(`MEJORAS: ${coche.marca} ${coche.modelo}`)
      .setDescription(`💳 **Saldo:** ${fmtNum(p?.creditos ?? 0)} ${getMoneyEmoji()}\n${SEP}`)
      .addFields(
        { name: `🚀 Motor`, value: `${getProgresoStr(instancia.motor || 0)}\n**${fPrice(instancia.motor || 0)}**`, inline: true },
        { name: `💨 Turbo`, value: `${getProgresoStr(instancia.turbo || 0)}\n**${fPrice(instancia.turbo || 0)}**`, inline: true },
        { name: `⚙️ Transmisión`, value: `${getProgresoStr(instancia.trans || 0)}\n**${fPrice(instancia.trans || 0)}**`, inline: true },
        { name: `📐 Suspensión`, value: `${getProgresoStr(instancia.susp || 0)}\n**${fPrice(instancia.susp || 0)}**`, inline: true },
        { name: `🛑 Frenos`, value: `${getProgresoStr(instancia.frenos || 0)}\n**${fPrice(instancia.frenos || 0)}**`, inline: true },
        { name: `🛞 Gomas`, value: `${getProgresoStr(instancia.gomas || 0)}\n**${fPrice(instancia.gomas || 0)}**`, inline: true },
        { name: `⚖️ Reducción Peso`, value: `${getProgresoStr(instancia.peso || 0)}\n**${fPrice(instancia.peso || 0)}**`, inline: true }
      )
      .setThumbnail(carUrl).setColor(COLORES[coche.rareza]);
    return { embed, files: carFiles };
}

function crearFilaStageTaller(stage = 1) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('tienda_stage_select').setPlaceholder(`📍 Mostrando: STAGE ${stage}`).addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Stage 1').setDescription('Mejoras Lvl 1 - 5').setEmoji('🔧').setValue('stage_1').setDefault(stage === 1),
            new StringSelectMenuOptionBuilder().setLabel('Stage 2').setDescription('Mejoras Lvl 6 - 10').setEmoji('⚡').setValue('stage_2').setDefault(stage === 2),
            new StringSelectMenuOptionBuilder().setLabel('Stage 3').setDescription('Mejoras Lvl 11 - 15').setEmoji('🔥').setValue('stage_3').setDefault(stage === 3)
        )
    );
}

async function crearFilaBotonesTaller(userId, guildId, stage = 1) {
    const p = await obtenerPerfil(userId);
    const m = await obtenerVehiculoInstancia(p?.coche_activo, userId);
    if (!m) return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('x').setLabel('---').setStyle(ButtonStyle.Secondary).setDisabled(true))];
    
    const { minLvl, maxLvl } = getStageLimits(stage);
    const b = (id, e, l) => {
        const type = id.split('_')[2];
        const lvl = m[type] || 0;
        const isDisabled = lvl >= maxLvl || lvl < minLvl;
        return new ButtonBuilder()
            .setCustomId(`${id}_${stage}`)
            .setEmoji(e)
            .setLabel(l)
            .setStyle(isDisabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(isDisabled);
    };
    
    return [
        new ActionRowBuilder().addComponents(b('tienda_up_motor','🚀','Motor'), b('tienda_up_turbo','💨','Turbo'), b('tienda_up_trans','⚙️','Trans')), 
        new ActionRowBuilder().addComponents(b('tienda_up_susp','📐','Susp'), b('tienda_up_frenos','🛑','Frenos'), b('tienda_up_gomas','🛞','Gomas')),
        new ActionRowBuilder().addComponents(b('tienda_up_peso','⚖️','Peso'))
    ];
}

// --- OTROS HELPERS ---
async function embedContratos(userId) {
    const inv = await obtenerInventario(userId);
    const conteo = {};
    inv.forEach(i => { if (i.coche_id) conteo[i.coche_id] = (conteo[i.coche_id] || 0) + 1; });
    const elegibles = Object.entries(conteo).filter(([id, count]) => count >= 6);
    const lista = elegibles.length ? elegibles.map(([id, c]) => `• **${MAPA_COCHES.get(Number(id)).marca}** (${c} copias)`).join('\n') : '*Ninguno*';
    return new EmbedBuilder().setTitle('🧾 CONTRATOS').setDescription(`Entregar 5 iguales por 1 de mayor rareza.\n\n${lista}`).setColor(0xFFAA00);
}

async function crearFilaContratos(userId) {
    const inv = await obtenerInventario(userId);
    const conteo = {};
    inv.forEach(i => { if (i.coche_id) conteo[i.coche_id] = (conteo[i.coche_id] || 0) + 1; });
    const elegibles = Object.entries(conteo).filter(([id, count]) => count >= 6);
    if (!elegibles.length) return null;
    const select = new StringSelectMenuBuilder().setCustomId('tienda_contract_exec').setPlaceholder('Elegir modelo...');
    elegibles.slice(0,25).forEach(([id]) => { const c = MAPA_COCHES.get(Number(id)); select.addOptions(new StringSelectMenuOptionBuilder().setLabel(c.marca).setValue(String(c.id))); });
    return new ActionRowBuilder().addComponents(select);
}

function crearFilaBotonesCoches() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tienda_buy_1').setLabel('Estándar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tienda_buy_4').setLabel('Épico').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tienda_buy_5').setLabel('Legendario').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('tienda_buy_6').setLabel('Mítico').setStyle(ButtonStyle.Danger)
  );
}

function crearFilaDesguace() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('tienda_desguace_exchange').setPlaceholder('¿Qué quieres restaurar?').addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Restaurar Secreto (R8)').setDescription('Coche SECRET (150 Piezas)').setEmoji(getTierEmoji(8, true)).setValue('res_r8'),
            new StringSelectMenuOptionBuilder().setLabel('Restaurar Mítico (R7)').setDescription('Coche SSS (50 Piezas)').setEmoji(getTierEmoji(7, true)).setValue('res_r7'),
            new StringSelectMenuOptionBuilder().setLabel('Restaurar Legendario (R6)').setDescription('Coche SS (30 Piezas)').setEmoji(getTierEmoji(6, true)).setValue('res_r6'),
            new StringSelectMenuOptionBuilder().setLabel('Restaurar Épico (R5)').setDescription('Coche S (15 Piezas)').setEmoji(getTierEmoji(5, true)).setValue('res_r5'),
            new StringSelectMenuOptionBuilder().setLabel('Canjear 25.000 💰').setDescription('Créditos (10 Piezas)').setEmoji('💰').setValue('res_money'),
            new StringSelectMenuOptionBuilder().setLabel('Canjear 15 Rolls').setDescription('Suministros (5 Piezas)').setEmoji('🔌').setValue('res_rolls')
        )
    );
}

// --- MODULE EXPORT ---
module.exports = {
  data: new SlashCommandBuilder().setName('tienda').setDescription('Terminal central del Cardex Hub.'),
  
  embedHome,
  crearFilaCategorias,

  async execute(interaction) {
    const { embed, files } = embedHome();
    await interaction.deferReply({ ephemeral: true });
    await interaction.channel.send({ embeds: [embed], files, components: [crearFilaCategorias()] });
    await interaction.editReply({ content: '✅ HUB de Operaciones cargado correctamente.' });
  },

  async handleSelectMenu(interaction) {
      const { customId, values, user, guildId } = interaction;
      if (customId === 'tienda_category_select') {
          const view = values[0];
          if (view === 'view_coches') await interaction.reply({ embeds: [await embedConcesionario(user.id)], components: [crearFilaBotonesCoches()], ephemeral:true });
          else if (view === 'view_desguace') await interaction.reply({ embeds: [await embedDesguace(user.id)], components: [crearFilaDesguace()], ephemeral:true });
          else if (view === 'view_contratos') await interaction.reply({ embeds: [await embedContratos(user.id)], components: (await crearFilaContratos(user.id))?[(await crearFilaContratos(user.id))]:[], ephemeral:true });
          else if (view === 'view_taller') {
              const { embed, files } = await embedTaller(user.id, guildId, 1);
              await interaction.reply({ embeds: [embed], files, components: [crearFilaStageTaller(1), ...(await crearFilaBotonesTaller(user.id, guildId, 1))], ephemeral:true });
          }
          else if (view === 'view_mercado') {
              await interaction.reply({ embeds: [await embedMercado(user.id, 0)], components: crearFilaAccionesMercado(), ephemeral:true });
          }
          await interaction.message.edit({ components: [crearFilaCategorias()] }).catch(()=>{});
      }
      else if (customId === 'tienda_stage_select') {
          const stage = parseInt(values[0].split('_')[1]);
          const { embed, files } = await embedTaller(user.id, guildId, stage);
          await interaction.update({ embeds: [embed], files, components: [crearFilaStageTaller(stage), ...(await crearFilaBotonesTaller(user.id, guildId, stage))] });
      }
      else if (customId === 'tienda_market_action_select') return this.handleMarketAction(interaction);
      else if (customId === 'tienda_buy_mercado_select') return this.handleMarketBuy(interaction);
      else if (customId === 'tienda_market_cancel_select') return this.handleMarketCancel(interaction);
      else if (customId === 'tienda_desguace_exchange') return this.handleDesguaceExchange(interaction);
      else if (customId === 'tienda_contract_exec') return this.handleContract(interaction);
  },

  async handleMarketAction(interaction) {
      const action = interaction.values[0];
      const { user } = interaction;
      const components = [...crearFilaAccionesMercado(action)];
      
      if (action === 'buy') {
          const fMenu = await crearFilaMercado(user.id, 0);
          const fPag = await crearFilaPaginacionMercado(0);
          if (fMenu) components.push(fMenu);
          if (fPag) components.push(fPag);
          await interaction.update({ embeds: [await embedMercado(user.id, 0)], components });
      }
      else {
          const fMine = await crearFilaCancelarVentas(user.id);
          if (fMine) components.push(fMine);
          await interaction.update({ embeds: [await embedMisVentas(user.id)], components });
      }
  },

  async handleMarketSellModal(interaction) {
      const inputId = parseInt(interaction.fields.getTextInputValue('car_id_input'));
      const precio = parseInt(interaction.fields.getTextInputValue('price_input'));
      const userId = interaction.user.id;

      if (isNaN(inputId) || isNaN(precio) || precio <= 0) return interaction.reply({ content: '❌ Introduce valores válidos.', ephemeral: true });

      const inv = await obtenerInventario(userId);
      const copias = inv.filter(i => i.coche_id === inputId);
      if (copias.length === 0) return interaction.reply({ content: `❌ No tienes el coche #$${inputId}.`, ephemeral: true });

      const inst = copias.sort((a,b) => ((a.motor||0)+(a.turbo||0)+(a.trans||0))-((b.motor||0)+(b.turbo||0)+(b.trans||0)))[0];
      const p = await obtenerPerfil(userId);
      if (p?.coche_activo === inst.id) return interaction.reply({ content: '❌ No puedes vender tu coche activo.', ephemeral: true });

      const res = await publicarVenta(userId, interaction.guildId, inst.id, precio);
      if (!res.exito) return interaction.reply({ content: `❌ ${res.error}`, ephemeral: true });

      const c = MAPA_COCHES.get(inst.coche_id);
      await interaction.reply({ content: `✅ ¡**${c.marca}** publicado por **${fmtNum(precio)} 💰**!`, ephemeral: true });
  },

  async handleMarketBuy(interaction) {
      await interaction.deferUpdate();
      const mId = parseInt(interaction.values[0]);
      const res = await procesarCompraMercado(interaction.user.id, interaction.guildId, mId);
      if (!res.exito) return interaction.followUp({ content: `❌ ${res.error}`, ephemeral: true });
      const c = MAPA_COCHES.get(res.cocheId);
      await interaction.editReply({ content: `✅ Comprado: **${c.marca} ${c.modelo}** por **${fmtNum(res.precio)} 💰**`, embeds: [], components: [] });
  },

  async handleMarketCancel(interaction) {
      await cancelarVenta(interaction.user.id, parseInt(interaction.values[0]));
      await interaction.update({ content: '✅ Cancelado.', embeds: [], components: [] });
  },

  async handleDesguaceExchange(interaction) {
      const choice = interaction.values[0];
      const { user, guildId } = interaction;
      const p = await obtenerPerfil(user.id);
      const piezas = p?.piezas || 0;
      let needed = 0;
      let opcionTipo = '';

      if (choice === 'res_r8') { needed = 150; opcionTipo = 'coche'; }
      else if (choice === 'res_r7') { needed = 50; opcionTipo = 'coche'; }
      else if (choice === 'res_r6') { needed = 30; opcionTipo = 'coche'; }
      else if (choice === 'res_r5') { needed = 15; opcionTipo = 'coche'; }
      else if (choice === 'res_rolls') { needed = 5; opcionTipo = 'rolls'; }
      else if (choice === 'res_money') { needed = 10; opcionTipo = 'creditos'; }

      if (piezas < needed) return interaction.reply({ content: `❌ Necesitas **${needed} 🧩**.`, ephemeral: true });
      
      await sumarPieza(user.id, -needed);

      if (opcionTipo === 'coche') {
          let rareza = 0;
          if (choice === 'res_r8') rareza = 8;
          if (choice === 'res_r7') rareza = 7;
          if (choice === 'res_r6') rareza = 6;
          if (choice === 'res_r5') rareza = 5;

          const pool = coches.filter(c => c.rareza === rareza);
          const recientes = await obtenerUltimosCoches(user.id, 10);
          let cocheElegido = pool[Math.floor(Math.random() * pool.length)];
          if (recientes.includes(cocheElegido.id)) {
              const posibles = pool.filter(c => !recientes.includes(c.id));
              if (posibles.length > 0) cocheElegido = posibles[Math.floor(Math.random() * posibles.length)];
          }
          const res = await añadirCocheGaraje(user.id, guildId, cocheElegido.id);
          if (!p?.coche_activo && res.inventarioId) await setCocheActivo(user.id, guildId, res.inventarioId);

          const { url: carUrl, files: carFiles } = getCarImage(cocheElegido);
          const embed = new EmbedBuilder().setTitle(`¡${cocheElegido.marca} Restaurado!`).setImage(carUrl).setColor(COLORES[cocheElegido.rareza]);
          await interaction.reply({ embeds: [embed], files: carFiles, ephemeral: true });
      } else if (opcionTipo === 'rolls') {
          await sumarExtraRolls(user.id, 15);
          await interaction.reply({ content: '✅ +15 Rolls añadidos.', ephemeral: true });
      } else if (opcionTipo === 'creditos') {
          await sumarCreditos(user.id, guildId, 25000);
          await interaction.reply({ content: `✅ +${fmtNum(25000)} créditos añadidos.`, ephemeral: true });
      }
      await interaction.message.edit({ embeds: [await embedDesguace(user.id)], components: [crearFilaDesguace()] }).catch(() => {});
  },

  async handleContract(interaction) {
      await interaction.deferUpdate();
      const userId = interaction.user.id;
      const cId = parseInt(interaction.values[0]);
      const res = await procesarContrato(userId, interaction.guildId, cId);
      if (!res.exito) return interaction.followUp({ content: 'No se pudo procesar.', ephemeral: true });
      await restarCreditos(userId, null, 10000);
      const targetRareza = MAPA_COCHES.get(cId).rareza + 1;
      const pool = coches.filter(c => c.rareza === targetRareza);
      const recientes = await obtenerUltimosCoches(userId, 10);
      let nuevo = pool[Math.floor(Math.random() * pool.length)];
      if (recientes.includes(nuevo.id)) {
          const posibles = pool.filter(c => !recientes.includes(c.id));
          if (posibles.length > 0) nuevo = posibles[Math.floor(Math.random() * posibles.length)];
      }
      await añadirCocheGaraje(userId, interaction.guildId, nuevo.id);
      await interaction.editReply({ content: `✅ Trade-up: **${nuevo.marca} ${nuevo.modelo}**`, embeds: [], components: [] });
  },

  async handleUpgrade(interaction, type) {
      const stage = parseInt(interaction.customId.split('_')[3] || 1);
      const p = await obtenerPerfil(interaction.user.id);
      const m = await obtenerVehiculoInstancia(p?.coche_activo, interaction.user.id);
      const mults = { 1: 1, 2: 1.1, 3: 1.2, 4: 1.4, 5: 1.8, 6: 2.6, 7: 4.5, 8: 8 };
      const lvlActual = m[type] || 0;
      if (lvlActual >= 15) return interaction.reply({ content: 'Máximo nivel alcanzado.', ephemeral: true });
      const precio = Math.round(PRECIOS_BASE[lvlActual] * mults[MAPA_COCHES.get(m.coche_id).rareza]);
      if (p.creditos < precio) return interaction.reply({ content: `❌ Necesitas ${fmtNum(precio)} 💰.`, ephemeral: true });
      await restarCreditos(interaction.user.id, null, precio);
      await subirMejoraVehiculo(m.id, type);
      const { embed, files } = await embedTaller(interaction.user.id, interaction.guildId, stage);
      await interaction.update({ embeds: [embed], files, components: [crearFilaStageTaller(stage), ...(await crearFilaBotonesTaller(interaction.user.id, interaction.guildId, stage))] });
  },

  async handleButton(interaction) {
      const { customId, user, guildId } = interaction;
      if (customId.startsWith('tienda_buy_')) {
          const p = await obtenerPerfil(user.id);
          const rMinMap = { '1': 1, '4': 5, '5': 6, '6': 7 };
          const pMap = { '1': 15000, '4': 120000, '5': 500000, '6': 1500000 };
          const type = customId.split('_')[2];
          const precio = pMap[type];
          const rMin = rMinMap[type];

          if (p.creditos < precio) return interaction.reply({ content: '❌ Créditos insuficientes.', ephemeral: true });
          const limite = await verificarLimiteTienda(user.id, 10);
          if (limite.restantes <= 0) return interaction.reply({ content: '❌ Límite diario alcanzado.', ephemeral: true });

          await restarCreditos(user.id, guildId, precio);
          const elegibles = coches.filter(c => c.rareza >= rMin);
          const coche = elegibles[Math.floor(Math.random() * elegibles.length)];
          await añadirCocheGaraje(user.id, guildId, coche.id);

          const { url, files } = getCarImage(coche);
          const embed = new EmbedBuilder().setTitle('¡Pack Adquirido!').setDescription(`Has obtenido un **${coche.marca} ${coche.modelo}**`).setImage(url).setColor(COLORES[coche.rareza]);
          await interaction.reply({ embeds: [embed], files, ephemeral: true });
      }
      else if (customId.startsWith('tienda_up_')) return this.handleUpgrade(interaction, customId.split('_')[2]);
      else if (customId.startsWith('tienda_market_page_')) {
          const pag = parseInt(customId.split('_')[3]);
          const components = [...crearFilaAccionesMercado('buy'), await crearFilaMercado(user.id, pag), await crearFilaPaginacionMercado(pag)];
          await interaction.update({ embeds: [await embedMercado(user.id, pag)], components });
      }
      else if (customId === 'tienda_market_sell_trigger_modal') return this.handleMarketSellTrigger(interaction);
  },

  async handleMarketSellTrigger(interaction) {
      const modal = new ModalBuilder().setCustomId('tienda_market_sell_modal_global').setTitle('Publicar Venta');
      modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('car_id_input').setLabel('ID del Vehículo').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('price_input').setLabel('Precio').setStyle(TextInputStyle.Short).setRequired(true))
      );
      await interaction.showModal(modal);
  }
};
