// ============================================================
// commands/desguace.js
// Comando /desguace — Minijuego de exploración nocturna.
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
  sumarCreditos,
  sumarExtraRolls,
  sumarExp,
  sumarPieza,
  añadirCocheGaraje,
  restarCreditos,
  quitarCocheGarajeID,
  obtenerJackpot,
  sumarAlJackpot,
  reclamarJackpot,
  actualizarMision
} = require('../database/db');

const coches = require('../data/coches.json');

const {
  checkDesguaceCooldown,
  setDesguaceCooldown,
  formatearTiempo,
} = require('../utils/cooldowns');

const {
  COLOR_NEUTRO,
  COLOR_ERROR,
  COLOR_EXITO,
  SEP,
  SEP_SLIM,
  FOOTER,
  getMoneyEmoji,
  RAREZA,
  fmtNum,
  getTierEmoji,
  CLIMAS_DESGUACE,
} = require('../utils/constants');

const { getDesguaceImage } = require('../utils/images');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('desguace')
    .setDescription('Minijuego de extracción en el desguace.'),

  async execute(interaction) {
    const { user, guildId } = interaction;

    const restante = checkDesguaceCooldown(guildId, user.id);
    if (restante !== null) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle('🌙 DESGUACE CERRADO').setDescription(`Vuelve en **${formatearTiempo(restante)}**.`).setColor(COLOR_ERROR)],
        flags: MessageFlags.Ephemeral
      });
    }

    const climasArr = Object.values(CLIMAS_DESGUACE);
    const clima = climasArr[Math.floor(Math.random() * climasArr.length)];
    let intentos = (clima.id === 'gold') ? 8 : 6;
    let multiplier = (clima.id === 'rain') ? 1.5 : 1.0;

    const isEclipse = clima.id === 'eclipse';
    const isFog = clima.id === 'fog';

    const items = Array.from({ length: 25 }, () => {
        const rand = Math.random();
        
        // Ajustes porcentuales por clima
        const carChance = isEclipse ? 0.010 : 0.005;
        const jackpotChance = 0.010; // rand < 0.010
        const craneChance = 0.045;   // rand < 0.045
        const keyChance = 0.095;     // rand < 0.095
        const safeChance = 0.195;    // rand < 0.195
        const scrapChance = 0.620;   // rand < 0.620
        const rollsChance = 0.720;   // rand < 0.720
        const pieceChance = 0.820;   // rand < 0.820
        const dogChance = isFog ? 0.910 : 1.0; // En niebla el perro baja a 9% real (1.0 - 0.91)

        if (rand < carChance) return { type: 'car', emoji: '🏎️', color: ButtonStyle.Primary };
        if (rand < jackpotChance) return { type: 'jackpot', emoji: '💎', color: ButtonStyle.Primary };
        if (rand < craneChance) return { type: 'crane', emoji: '🏗️', color: ButtonStyle.Primary };
        if (rand < keyChance) return { type: 'key', emoji: '🔑', color: ButtonStyle.Primary };
        if (rand < safeChance) return { type: 'safe', emoji: '🔐', color: ButtonStyle.Secondary };
        
        // El scrap absorbe el resto si hay niebla (para que sume 1)
        if (rand < (isFog ? 0.710 : scrapChance)) return { type: 'scrap', emoji: '⚙️', color: ButtonStyle.Success, value: Math.floor(Math.random() * 1001) + 800 };
        
        if (rand < (isFog ? 0.810 : rollsChance)) return { type: 'rolls', emoji: '🎲', color: ButtonStyle.Primary, value: Math.floor(Math.random() * 5) + 3 };
        if (rand < (isFog ? 0.910 : pieceChance)) return { type: 'piece', emoji: '🧩', color: ButtonStyle.Primary };
        
        return { type: 'dog', emoji: '🐕', color: ButtonStyle.Danger };
    });

    const CAR_EMOJIS = ['🚗', '🚙', '🚐', '🏎️', '🚜', '🚓', '🚑', '🚚', '🚌', '🚛', '🚕', '🛺', '🚘', '🚔', '🚍', '🚲', '🛴', '🛵', '🏍️', '🏎️', '🛻', '🚐', '🚚', '🚛', '🚜'];
    const shuffledEmojis = [...CAR_EMOJIS].sort(() => Math.random() - 0.5);

    let acumuladoCreditos = 0;
    let acumuladoRolls = 0;
    let acumuladoPiezas = 0;
    let acumuladoXP = 0;
    let hallazgoCoche = null;
    let misionesCompletadasLog = [];
    let racha = 0;
    let revelados = new Array(25).fill(false);
    let bloqueados = new Array(25).fill(false);
    let finalizado = false;
    const sessionTools = { keys: 0 };

    function buildGridRows(disabled = false) {
        const rows = [];
        for (let i = 0; i < 5; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 5; j++) {
                const idx = i * 5 + j;
                const isBlocked = bloqueados[idx];
                const emoji = revelados[idx] ? items[idx].emoji : (isBlocked ? '🔒' : shuffledEmojis[idx]);
                const style = revelados[idx] ? items[idx].color : (isBlocked ? ButtonStyle.Danger : ButtonStyle.Secondary);

                row.addComponents(new ButtonBuilder().setCustomId(`seg_${idx}`).setEmoji(emoji).setStyle(style).setDisabled(revelados[idx] || disabled));
            }
            rows.push(row);
        }
        return rows;
    }

    const { url: imgUrl, files: imgFiles } = getDesguaceImage();



    let currentJackpot = await obtenerJackpot();

    const embed = new EmbedBuilder()
        .setAuthor({ name: `DESGUACE NOCTURNO: ${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
        .setTitle('🔦 SECTOR CENTRAL: ESCANEANDO...')
        .setDescription(`> *Analizando contenedores en busca de piezas...*\n\n${SEP_SLIM}`)
        .addFields(
            { 
                name: '🖥️ CONSOLA DE EXTRACCIÓN', 
                value: `\`\`\`py\n💰 Botín: ${fmtNum(0)} cr.\n🎲 Vales: 0\n🔦 Pases: ${intentos} / ${clima.id === 'gold' ? '8' : '6'}\n🌪️ Clima: ${clima.emoji} ${clima.nombre}\n\`\`\``, 
                inline: false 
            },
            { name: `🌤️ REPORTE: ${clima.nombre}`, value: `> *${clima.desc}*\n✨ **${clima.bonus}**`, inline: false },
            { name: '💎 POZO ACUMULADO (JACKPOT)', value: `> **${fmtNum(currentJackpot)}** cr.`, inline: false },
            { name: '🎒 EQUIPOS', value: `*Vacío*`, inline: true },
            { name: '🔥 COMBO', value: `\`x1.0\``, inline: true }
        )
        .setColor(0x00D9FF)
        .setFooter({ text: '💎 ¡Busca el DIAMANTE en los contenedores para llevarte el POZO ACUMULADO!' });

    if (imgUrl) embed.setThumbnail(imgUrl);

    const message = await interaction.reply({ embeds: [embed], components: buildGridRows(), files: imgFiles, fetchReply: true });
    const collector = message.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 420000 });

    collector.on('collect', async i => {
        if (finalizado) return;

        if (i.customId === 'gamble_yes' || i.customId === 'gamble_no') {
            if (i.customId === 'gamble_no') { finalizado = true; return showFinalSummary(i); }
            
            await i.deferUpdate();
            
            // 1. Decidir resultado REAL (50/50)
            const success = Math.random() < 0.5;
            
            // 2. Patrón Intercalado (Verde, Rojo, Verde, Rojo...)
            // Índices en el tablero (bordes): [0, 1, 2, 5, 8, 7, 6, 3]
            const mapIdx = [0, 1, 2, 5, 8, 7, 6, 3];
            const arrowIcons = ['↖️', '⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️'];
            const interleavedPattern = ['🟩', '🟥', '🟩', '🟥', '🟩', '🟥', '🟩', '🟥'];
            
            const gridOut = Array.from({length: 9}, () => '⬜');
            mapIdx.forEach((gIdx, idx) => gridOut[gIdx] = interleavedPattern[idx]);

            // 3. Calcular destino final de la flecha
            // Si success=true, debe caer en un índice PAR del patrón (0, 2, 4, 6 -> Verdes)
            // Si success=false, debe caer en un índice IMPAR (1, 3, 5, 7 -> Rojos)
            const posiblesDestinos = success ? [0, 2, 4, 6] : [1, 3, 5, 7];
            const finalPatternIdx = posiblesDestinos[Math.floor(Math.random() * posiblesDestinos.length)];
            
            // 4. Animación: 2 vueltas completas (16 pasos) + el destino final
            const totalSteps = 16 + finalPatternIdx;

            for (let f = 0; f <= totalSteps; f++) {
                const currentIconIdx = f % 8;
                gridOut[4] = arrowIcons[currentIconIdx];
                
                // Reducir la frecuencia de edición al principio para evitar rate limit
                // Solo editamos cada 2 pasos al principio, y cada paso al final para el suspense
                if (f < 12 && f % 2 !== 0) continue; 

                try {
                    await interaction.editReply({ 
                        embeds: [EmbedBuilder.from(i.message.embeds[0]).setTitle('🎰 RULETA: GIRANDO...') ],
                        components: build3x3Rows(gridOut) 
                    });
                } catch (e) { break; }
                // La ruleta va frenando un poquito al final
                const delay = f > 12 ? 1000 : 600;
                await new Promise(r => setTimeout(r, delay)); 
            }

            // Pequeña pausa final para que se vea bien el resultado
            await new Promise(r => setTimeout(r, 1200));

            if (success) {
                // Bono de Créditos (x2.5 total)
                const bonusCr = Math.floor(acumuladoCreditos * 1.5); 
                acumuladoCreditos += bonusCr;
                await sumarCreditos(user.id, guildId, bonusCr);

                // Duplicar Vales (Rolls)
                const bonusRolls = acumuladoRolls; // Esto duplica lo que ya tenía
                acumuladoRolls += bonusRolls;
                await sumarExtraRolls(user.id, bonusRolls);

                // Duplicar Piezas (🧩)
                const bonusPiezas = acumuladoPiezas; // Esto duplica lo que ya tenía
                acumuladoPiezas += bonusPiezas;
                if (bonusPiezas > 0) await sumarPieza(user.id, bonusPiezas);
            } else {
                if (acumuladoCreditos > 0) {
                    await sumarAlJackpot(acumuladoCreditos); 
                    await restarCreditos(user.id, guildId, acumuladoCreditos);
                }
                if (acumuladoRolls > 0) await sumarExtraRolls(user.id, -acumuladoRolls);
                if (acumuladoPiezas > 0) await sumarPieza(user.id, -acumuladoPiezas);
                if (hallazgoCoche?.instId) {
                    await quitarCocheGarajeID(hallazgoCoche.instId);
                    // Si el coche encontrado había sido activado automáticamente, limpiarlo
                    const { setCocheActivo, obtenerPerfil } = require('../database/db');
                    const perfilActual = await obtenerPerfil(user.id);
                    if (perfilActual?.coche_activo === hallazgoCoche.instId) {
                        await setCocheActivo(user.id, guildId, null);
                    }
                }

                acumuladoCreditos = 0; acumuladoRolls = 0; acumuladoPiezas = 0; hallazgoCoche = null;
            }
            finalizado = true;
            return showFinalSummary(null);
        }

        const chosenIdx = parseInt(i.customId.split('_')[1]);
        const wasBlocked = bloqueados[chosenIdx];

        if (!revelados[chosenIdx] && !wasBlocked) intentos--;
        
        // Deferimos inmediatamente para evitar el error "Unknown Interaction" si el proceso DB tarda > 3s
        try { await i.deferUpdate(); } catch (e) { return; }

        let discoveryLog = [];

        const procesarHallazgo = async (idx, isAuto = false) => {
            if (revelados[idx] && !isAuto) return;
            revelados[idx] = true;
            const item = items[idx];
            let msg = '';

            if (item.type === 'scrap') {
                const val = Math.floor(item.value * multiplier * (1 + racha * 0.1));
                acumuladoCreditos += val; await sumarCreditos(user.id, guildId, val);
                const xp = Math.round(10 * require('../utils/cooldowns').getMultiplicadorXP());
                acumuladoXP += xp; await sumarExp(user.id, guildId, 10); // +10 XP por chatarra
                msg = `# ⚙️ +${fmtNum(val)} cr.`;
                racha++;
            } else if (item.type === 'rolls') {
                let val = item.value;
                if (clima.id === 'radiation') val *= 2;
                acumuladoRolls += val; await sumarExtraRolls(user.id, val);
                const xp = Math.round(25 * require('../utils/cooldowns').getMultiplicadorXP());
                acumuladoXP += xp; await sumarExp(user.id, guildId, 25); // +25 XP por vales
                msg = `# 🎲 +${val} VALES`;
            } else if (item.type === 'car') {
                const pool = coches.filter(c => c.rareza >= 4);
                const { obtenerUltimosCoches } = require('../database/db');
                const recientes = await obtenerUltimosCoches(user.id, 10);
                
                let car = pool[Math.floor(Math.random() * pool.length)];
                // Protección de duplicados para rarezas altas
                if (recientes.includes(car.id)) {
                    const posibles = pool.filter(c => !recientes.includes(c.id));
                    if (posibles.length > 0) car = posibles[Math.floor(Math.random() * posibles.length)];
                }

                const res = await añadirCocheGaraje(user.id, guildId, car.id); 
                hallazgoCoche = { ...car, instId: res.inventarioId };
                const xp = Math.round(200 * require('../utils/cooldowns').getMultiplicadorXP());
                acumuladoXP += xp; await sumarExp(user.id, guildId, 200); // 200 XP por coche
                msg = `# 🏎️ ¡HALLAZGO!\n> **${car.marca} ${car.modelo}**`;
            } else if (item.type === 'dog') {
                racha = 0; const pen = clima.id === 'blood' ? 3 : 1; 
                if (!isAuto) { /* Ya se restó turnos arriba */ } else { intentos -= pen; }
                let pLossMsg = '';
                if (intentos <= 0 && acumuladoPiezas > 0) {
                    acumuladoPiezas--; await sumarPieza(user.id, -1);
                    pLossMsg = '\n⚠️ **¡Pieza 🧩 perdida!**';
                }
                msg = `# 🚨 ¡ATAQUE!\n> **-${pen} pases**${pLossMsg}`;
            } else if (item.type === 'key') {
                sessionTools.keys++; intentos++; msg = `# 🗝️ ¡LLAVE!`;
            } else if (item.type === 'jackpot') {
                const botinPozo = await reclamarJackpot();
                currentJackpot = 50000; // El pozo se resetea
                acumuladoCreditos += botinPozo; await sumarCreditos(user.id, guildId, botinPozo);
                msg = `# 💎 ¡JACKPOT!\n> **+${fmtNum(botinPozo)}** cr.`;
            } else if (item.type === 'crane') {
                msg = `# 🏗️ ¡GRÚA ACTIVADA!`;
                const r = Math.floor(idx / 5); const c = idx % 5;
                const isRow = Math.random() > 0.5;
                const sweep = isRow ? [0,1,2,3,4].map(v => r*5 + v) : [0,5,10,15,20].map(v => v + c);
                for (const nextIdx of sweep) {
                    if (nextIdx === idx || revelados[nextIdx]) continue;
                    if (items[nextIdx].type === 'crane') {
                         revelados[nextIdx] = true; 
                    } else {
                         await procesarHallazgo(nextIdx, true);
                    }
                }
            } else if (item.type === 'safe') {
                if (sessionTools.keys > 0) {
                    sessionTools.keys--; const loot = 50000; acumuladoCreditos += loot; await sumarCreditos(user.id, guildId, loot);
                    bloqueados[idx] = false; msg = `# 💰 CAJA ABIERTA\n> **+${fmtNum(loot)}** cr.`;
                } else {
                    revelados[idx] = false; bloqueados[idx] = true; 
                    msg = `# 🔐 BLOQUEADA\n> **Necesitas una Llave 🗝️**`;
                }
            } else if (item.type === 'piece') {
                acumuladoPiezas++; 
                const compl = await sumarPieza(user.id, 1); 
                intentos++; 
                const xp = Math.round(50 * require('../utils/cooldowns').getMultiplicadorXP());
                acumuladoXP += xp; await sumarExp(user.id, guildId, 50); // 50 XP por pieza
                msg = `# 🧩 PIEZA (+1🔋)`;
                misionesCompletadasLog.push(...compl);
            }

            if (msg) discoveryLog.push(msg);
        };

        await procesarHallazgo(chosenIdx);

        const nEmbed = EmbedBuilder.from(embed)
            .setDescription(`${discoveryLog.join('\n') || '> *Extrayendo...*'}\n\n${SEP_SLIM}`)
            .setFooter({ text: '💎 El Pozo aumenta cuando alguien pierde en la ruleta.' })
            .setFields(
                { name: '🖥️ CONSOLA DE EXTRACCIÓN', value: `\`\`\`py\n💰 Botín: ${fmtNum(acumuladoCreditos)} cr.\n🎲 Vales: ${acumuladoRolls}\n🔦 Pases: ${intentos} / ${clima.id === 'gold' ? '8' : '6'}\n🌪️ Clima: ${clima.emoji} ${clima.nombre}\n\`\`\``, inline: false },
                { name: `🌤️ REPORTE: ${clima.nombre}`, value: `> *${clima.desc}*\n✨ **${clima.bonus}**`, inline: false },
                { name: '💎 JACKPOT DISPONIBLE', value: `> **${fmtNum(currentJackpot)}** cr.`, inline: true },
                { name: '🎒 EQUIPOS', value: sessionTools.keys > 0 ? `🔑 Llaves x${sessionTools.keys}` : `*Vacío*`, inline: true },
                { name: '🔥 COMBO', value: `\`x${(1 + racha * 0.1).toFixed(1)}\``, inline: true }
            );

        // Actualizamos para que el usuario vea el resultado del último click
        // Si no quedan intentos, desactivamos la cuadrícula mientras esperamos
        await i.editReply({ embeds: [nEmbed], components: buildGridRows(intentos <= 0) });

        // Si se acabaron los pases, esperamos un poco y mostramos la ruleta
        if (intentos <= 0 && !finalizado) {
            await new Promise(r => setTimeout(r, 2500));
            
            const listadoRiesgo = [
                `💰 **Créditos**: \`${fmtNum(acumuladoCreditos)}\``,
                `🎲 **Vales**: \`${acumuladoRolls}\``,
                `🧩 **Piezas**: \`${acumuladoPiezas}\``
            ];
            if (hallazgoCoche) listadoRiesgo.push(`🏎️ **Vehículo**: \`${hallazgoCoche.marca} ${hallazgoCoche.modelo}\``);

            const rEmbed = new EmbedBuilder()
                .setAuthor({ name: `DESGUACE NOCTURNO: ${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
                .setTitle('⚖️ ÚLTIMO ALIENTO: ¿DOBLE O NADA?')
                .setDescription(`# 🎰 RULETA DE DESTINO\n¿Arriesgas el botín acumulado? (50/50)\n\n> 🟩 **Ganas**: Multiplicador **x2.5** de créditos y **DUPLICAS** piezas/vales.\n> 🟥 **Pierdes**: **TODO**. Tu botín irá al **JACKPOT** global 💎.\n\n${SEP_SLIM}`)
                .setColor(0xFFAA00)
                .addFields({ name: '⚠️ BOTÍN EN RIESGO', value: listadoRiesgo.join('\n'), inline: false });

            if (acumuladoCreditos > 50000) rEmbed.setFooter({ text: '🔥 ¡ESTÁS ARRIESGANDO UN GRAN BOTÍN!' });

            if (imgUrl) rEmbed.setThumbnail(imgUrl);

            return interaction.editReply({ 
                embeds: [rEmbed], 
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('gamble_yes').setLabel('🎰 JUGAR TODO').setStyle(ButtonStyle.Danger), 
                        new ButtonBuilder().setCustomId('gamble_no').setLabel('📦 RETIRARSE').setStyle(ButtonStyle.Success)
                    )
                ] 
            });
        }
    });

    function build3x3Rows(em) {
        const rows = [];
        for (let i = 0; i < 3; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 3; j++) {
                const id = i * 3 + j;
                row.addComponents(new ButtonBuilder().setCustomId(`r_${id}`).setEmoji(em[id]).setStyle(id === 4 ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(true));
            }
            rows.push(row);
        }
        return rows;
    }

    async function showFinalSummary(it) {
        const fEmbed = new EmbedBuilder()
            .setAuthor({ name: `REPORTE DE EXTRACCIÓN: ${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setTitle(acumuladoCreditos > 0 ? '✅ EXTRACCIÓN COMPLETADA' : '🚨 MISIÓN FALLIDA')
            .setDescription(`**RESUMEN DE CARGA:**\n${SEP_SLIM}`)
            .setColor(acumuladoCreditos > 0 ? COLOR_EXITO : COLOR_ERROR)
            .setFields(
                { name: '💰 Botín Total', value: `\`${fmtNum(acumuladoCreditos)}\` cr.`, inline: true },
                { name: '🎲 Rolls', value: `\`${acumuladoRolls}\` r.`, inline: true },
                { name: '🧩 Piezas/XP', value: `\`${acumuladoPiezas}\` p. / \`+${acumuladoXP}\` XP`, inline: true }
            );

        if (hallazgoCoche) {
            const rData = RAREZA[hallazgoCoche.rareza];
            fEmbed.addFields({ 
                name: '🏎️ Vehículo Hallado', 
                value: `**${hallazgoCoche.marca} ${hallazgoCoche.modelo}**\n${getTierEmoji(hallazgoCoche.rareza)} \`${rData.nombre}\`\n🆔 \`${hallazgoCoche.id}\` | ⚡ \`${hallazgoCoche.cv}\` CV`, 
                inline: false 
            });
        } 

        if (misionesCompletadasLog.length > 0) {
            // Eliminar duplicados si los hay
            const únicas = [...new Map(misionesCompletadasLog.map(m => [m.id, m])).values()];
            fEmbed.addFields({
                name: '🎯 ¡MISIONES COMPLETADAS!',
                value: únicas.map(m => `✅ **${m.desc}**\n🎁 Recompensa: \`${fmtNum(m.recompensa_cr)} 💰\``).join('\n'),
                inline: false
            });
        }

        fEmbed.setFooter({ text: 'Volverás en 2 horas.' });
        
        if (imgUrl) fEmbed.setThumbnail(imgUrl);
        setDesguaceCooldown(guildId, user.id);
        if (it) await it.update({ embeds: [fEmbed], components: [] });
        else await interaction.editReply({ embeds: [fEmbed], components: [] });
        collector.stop();
    }
  }
};
