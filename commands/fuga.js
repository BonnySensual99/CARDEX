// ============================================================
// commands/fuga.js
// Minijuego "La Fuga" — Estilo Crash (Multiplicador ascendente)
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const { getFugaImage } = require('../utils/images');

const { 
  obtenerPerfil, 
  restarCreditos, 
  sumarCreditos, 
  sumarExp, 
  registrarFugaResultado,
  actualizarMision,
  obtenerHistorialFuga 
} = require('../database/db');
const { COLOR_NEUTRO, COLOR_ERROR, COLOR_EXITO, SEP_SLIM, FOOTER, fmtNum, getMoneyEmoji } = require('../utils/constants');
const { calcularNivel, calcularMaxApuesta } = require('../utils/levels');
const { checkFugaCooldown, setFugaCooldown, esFinDeSemana, formatearTiempo } = require('../utils/cooldowns');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fuga')
    .setDescription('🚔 ¡Escapa de la policía y multiplica tu apuesta!')
    .addSubcommand(sub => 
      sub.setName('jugar')
         .setDescription('Inicia un intento de fuga')
         .addStringOption(option =>
           option.setName('apuesta')
             .setDescription('Cantidad o "max"')
             .setRequired(true))
    )
    .addSubcommand(sub =>
       sub.setName('stats')
          .setDescription('Muestra tus estadísticas de fuga')
          .addUserOption(opt => opt.setName('piloto').setDescription('Ver stats de otro piloto'))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'stats') return this.handleStats(interaction);

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    // Cooldown
    const tiempoRestante = checkFugaCooldown(guildId, userId);
    if (tiempoRestante) {
        return interaction.reply({
            content: `⏳ Debes esperar **${formatearTiempo(tiempoRestante)}** para volver a fugarte.`,
            ephemeral: true
        });
    }

    const perfil = await obtenerPerfil(userId);
    const level = calcularNivel(perfil.exp || 0);
    const maxApuestaNivel = calcularMaxApuesta(level);
    const misCreditos = perfil.creditos || 0;
    
    // Límite global: 250k (Protección de economía)
    const MAX_FUGA_LIMIT = 500000;

    let apuestaStr = "";
    if (sub === 'jugar') {
      apuestaStr = interaction.options.getString('apuesta');
    } else {
      apuestaStr = interaction.options?.getString('apuesta') || "0";
    }

    let apuesta = 0;
    const str = (apuestaStr || "0").toLowerCase();

    let isAllIn = false;
    const allKeywords = ['all', 'todo', 'toda', 'full'];

    if (allKeywords.includes(str)) {
        apuesta = Math.min(misCreditos, MAX_FUGA_LIMIT); // Incluso All-In tiene tope de seguridad
        isAllIn = true;
    } else if (str === 'max') {
        apuesta = Math.min(misCreditos, maxApuestaNivel, MAX_FUGA_LIMIT);
    } else {
        apuesta = parseInt(apuestaStr);
    }

    if (!apuesta || isNaN(apuesta) || apuesta < 100) {
      return interaction.reply({
        content: `❌ Debes apostar una cantidad válida (Mínimo 100 ${getMoneyEmoji()}).`,
        ephemeral: true
      });
    }

    if (apuesta > MAX_FUGA_LIMIT) {
        return interaction.reply({
            content: `❌ La apuesta máxima en La Fuga es de **${fmtNum(MAX_FUGA_LIMIT)} ${getMoneyEmoji()}** por motivos de seguridad económica.`,
            ephemeral: true
        });
    }

    // Si no es All-In, respetamos el límite de nivel
    if (!isAllIn && apuesta > maxApuestaNivel) {
        return interaction.reply({
            content: `❌ Tu nivel (**Lv. ${level}**) solo te permite apostar un máximo de **${fmtNum(maxApuestaNivel)} ${getMoneyEmoji()}**. Para apostar el máximo permitido usa \`all\`.`,
            ephemeral: true
        });
    }

    if (misCreditos < apuesta) {
        return interaction.reply({
          content: `❌ No tienes suficientes créditos. Tienes **${fmtNum(misCreditos)} ${getMoneyEmoji()}**.`,
          ephemeral: true
        });
    }

    // Activar cooldown al empezar
    setFugaCooldown(guildId, userId);

    // 3. Deducción inicial
    await restarCreditos(userId, guildId, apuesta);

    // 4. Configuración del juego (Lógica de Fuga)
    let multiplicador = 1.0;
    let step = 0;
    const intervalTime = 1000; // Actualización cada 1 segundo
    let finalizado = false;

    // Fórmula balanceada (94% RTP). Crash point puede ser 1.0 (Instantáneo).
    // Sin límite de multiplicador máximo para permitir premios legendarios.
    const r = Math.random();
    const crashPoint = parseFloat((0.94 / (1 - r)).toFixed(2));

    // Curva de crecimiento acelerado (cuanto más sube, más rápido crece)
    const getNextMultiplier = (current, s) => {
      // El factor de crecimiento empieza en 1.08 y sube 0.006 por cada segundo
      const tasaCrecimiento = 1.08 + (s * 0.006);
      return parseFloat((current * tasaCrecimiento).toFixed(2));
    };



    const getVisuals = (m, s) => {
      const bars = 12;
      const pos = Math.min(Math.floor(s / 1.5), bars);
      const circuit = '—'.repeat(pos) + '🏎️💨' + '—'.repeat(Math.max(0, bars - pos));
      return `\`${circuit}\` 🚔🚁`;
    };



    // 6. Embed inicial (Persecución)
    const createPursuitEmbed = (m, s) => {
      const ganancia = Math.floor(apuesta * m);
      const emoji = m < 2 ? '🟢' : (m < 5 ? '🟡' : (m < 15 ? '🟠' : (m < 50 ? '🔴' : '💀')));
      
      return new EmbedBuilder()
        .setAuthor({ 
          name: `📡 RADAR: ${interaction.user.displayName}`, 
          iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
        })
        .setTitle(`${emoji} ${m.toFixed(2)}x — ${fmtNum(ganancia)} ${getMoneyEmoji()}`)
        .setDescription(
            `> ${getVisuals(m, s)}\n` +
            `💸 **APUESTA:** ${fmtNum(apuesta)} ${getMoneyEmoji()}`
        )
        .setColor(COLOR_NEUTRO)
        .setFooter({ text: `${FOOTER} • INTENTO DE FUGA EN CURSO` });
    };

    const botonSaltar = new ButtonBuilder()
      .setCustomId(`fuga_saltar_${userId}`)
      .setLabel('🛑 SALTAR Y COBRAR BOTÍN')
      .setStyle(ButtonStyle.Danger);

    const fila = new ActionRowBuilder().addComponents(botonSaltar);

    const mainMsg = await interaction.reply({
      embeds: [createPursuitEmbed(multiplicador, step)],
      components: [fila],
      fetchReply: true
    });

    // 6. Collector de interacciones
    const collector = mainMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 600000 // 10 minutos máx
    });

    const gameLoop = async () => {
      if (finalizado) return;

      await new Promise(r => setTimeout(r, intervalTime));
      if (finalizado) return;

      step++;

      // ¿Ha llegado al punto de Crash? (Determinista)
      const proximoMult = getNextMultiplier(multiplicador, step - 1);
      
      if (crashPoint < proximoMult) {
        // ⏳ GRACE PERIOD DE 300ms
        // Esperamos antes de confirmar el crash por si el jugador pulsó el botón
        // justo en este instante y la petición está en tránsito hacia el bot.
        await new Promise(r => setTimeout(r, 300));
        if (finalizado) return; // ¡El jugador pulsó a tiempo! El collector gestiona su victoria.

        finalizado = true;
        collector.stop('crash');
        const resLvl = await registrarFugaResultado(userId, crashPoint, -apuesta, false);
        
        // Si hubiera saltado el paso anterior, habría ganado esto
        const gananciaQueHubiera = Math.floor(apuesta * multiplicador);
        const beneficioQueHubiera = gananciaQueHubiera - apuesta;
        
        const embedArresto = new EmbedBuilder()
          .setAuthor({ name: '💥 SISTEMA COMPROMETIDO', iconURL: 'https://cdn-icons-png.flaticon.com/512/2555/2555022.png' })
          .setTitle('🚨 ¡BARRICADA POLICIAL DETECTADA!')
          .setDescription(
            `### ❌ TRANSMISIÓN INTERRUMPIDA\n` +
            `\`\`\`diff\n` +
            `- CRASH EN: [ ${crashPoint.toFixed(2)}x ]\n` +
            `\`\`\`\n` +
            `💀 **PERDISTE:** \`${fmtNum(apuesta)}\` ${getMoneyEmoji()}\n\n` +
            `> El helicóptero te localizó y no pudiste saltar a tiempo. Estás bajo arresto.\n` +
            `${SEP_SLIM}`
          )
          .addFields(
            {
              name: '💡 ¿Qué habría pasado si saltas antes?',
              value: `> Si hubieras saltado un paso antes (**${multiplicador.toFixed(2)}x**), habrías cobrado **${fmtNum(gananciaQueHubiera)}** ${getMoneyEmoji()} y ganado **+${fmtNum(Math.max(0, beneficioQueHubiera))}** ${getMoneyEmoji()}.`,
              inline: false
            }
          )
          .setImage('attachment://arrest.png')
          .setColor(COLOR_ERROR)
          .setFooter({ text: `${FOOTER} • UNIDAD ARRESTADA • +${Math.round(25 * (require('../utils/cooldowns').getMultiplicadorXP()))} XP` });

        if (resLvl?.subio) {
            embedArresto.addFields({
                name: '🆙 ¡SUBIDA DE NIVEL!',
                value: `¡Has alcanzado el **Nivel ${resLvl.nivelNuevo}**!\n💰 Recompensa: **+${fmtNum(resLvl.recompensa)} 💰**`,
                inline: false
            });
        }

        try { 
            const { url: urlArrest } = getFugaImage('arrest');
            await interaction.editReply({ 
                embeds: [embedArresto.setImage(urlArrest)], 
                components: [],
                files: [],
                attachments: [] 
            }); 
        } catch (err) { 
            const { url: urlArrest } = getFugaImage('arrest');
            await interaction.channel.send({ embeds: [embedArresto.setImage(urlArrest)] }).catch(() => {});
        }
        return;
      }

      multiplicador = proximoMult;
      
      await interaction.editReply({ 
        embeds: [createPursuitEmbed(multiplicador, step)],
        components: [fila],
        attachments: [] // Prevenir imágenes flotantes durante el juego
      }).catch(() => {});
      
      gameLoop();
    };

    collector.on('collect', async i => {
      if (i.user.id !== userId) {
        return i.reply({ content: '❌ Esta no es tu fuga.', ephemeral: true });
      }

      await i.deferUpdate();
      finalizado = true;
      collector.stop('success');
      
      const gananciaTotal = Math.floor(apuesta * multiplicador);
      await sumarCreditos(userId, guildId, gananciaTotal);
      const resLvl = await registrarFugaResultado(userId, multiplicador, gananciaTotal - apuesta, true);

      // ── GESTIÓN DE MISIONES ─────────────────────────
      const complWin = await actualizarMision(userId, 'FUGA_WIN', 1);
      const complMult = await actualizarMision(userId, 'FUGA_MULT', Math.floor(multiplicador));
      const misionesCompletadas = [...complWin, ...complMult];

      const embedExito = new EmbedBuilder()
        .setAuthor({ name: '🏁 FUGA CONFIRMADA', iconURL: 'https://cdn-icons-png.flaticon.com/512/1162/1162456.png' })
        .setTitle('✅ ¡DURANTE EL RASTREO TE PERDIERON!')
        .setDescription(
          `### 💰 BOTÍN ASEGURADO\n` +
          `💰 **GANANCIA:** \`${fmtNum(gananciaTotal)}\` ${getMoneyEmoji()}\n` +
          `🔥 **MULTIP:** \`${multiplicador.toFixed(2)}x\`\n\n` +
          `> Has logrado despistar a las unidades y has escondido el coche. El dinero ya está en tu cuenta.\n` +
          `${SEP_SLIM}`
        )
        .addFields(
          {
            name: crashPoint <= multiplicador
              ? '🤯 ¡SALISTE JUST A TIEMPO!'
              : '🎲 ¿Sabes hasta dónde podría haber llegado?',
            value: crashPoint <= multiplicador
              ? `> El multiplicador habría crasheado en **${crashPoint.toFixed(2)}x** — ¡saliste exactamente a tiempo!`
              : `> El crash estaba programado en **${crashPoint.toFixed(2)}x** — podrías haber llegado hasta ahí y ganar **${fmtNum(Math.floor(apuesta * crashPoint))}** ${getMoneyEmoji()}.`,
            inline: false
          }
        )
        .setImage('attachment://success.png')
        .setColor(COLOR_EXITO)
        .setFooter({ text: `${FOOTER} • INTENTO DE FUGA EXITOSO • +${Math.round(150 * (require('../utils/cooldowns').getMultiplicadorXP()))} XP` });

      if (misionesCompletadas.length > 0) {
          embedExito.addFields({
              name: '🎯 ¡MISIONES COMPLETADAS!',
              value: misionesCompletadas.map(m => `✅ **${m.desc}**\n🎁 Recompensa: \`${fmtNum(m.recompensa_cr)} 💰\` y \`${m.recompensa_xp} XP\``).join('\n'),
              inline: false
          });
      }

      if (resLvl?.subio) {
          embedExito.addFields({
              name: '🆙 ¡SUBIDA DE NIVEL!',
              value: `¡Has alcanzado el **Nivel ${resLvl.nivelNuevo}**!\n💰 Recompensa: **+${fmtNum(resLvl.recompensa)} 💰**`,
              inline: false
          });
      }

      try { 
          const { url: urlSuccess } = getFugaImage('success');
          await interaction.editReply({ 
              embeds: [embedExito.setImage(urlSuccess)], 
              components: [],
              files: [],
              attachments: []
          }); 
      } catch (err) {
          try { await interaction.editReply({ embeds: [embedExito], components: [], files: [fileSuccess], attachments: [] }); } catch { }
      }
    });

    // Iniciar bucle
    gameLoop();
  },

  async handleStats(interaction) {
      const target = interaction.options.getUser('piloto') || interaction.user;
      const p = await obtenerPerfil(target.id);
      const host = await obtenerHistorialFuga(target.id, 10);

      const total = (p.fuga_ganado || 0) + (p.fuga_perdido || 0);
      const winrate = total > 0 ? ((p.fuga_ganado / total) * 100).toFixed(1) : 0;

      const historyStr = host.length > 0 
        ? host.map(h => {
            const timestamp = h.fecha ? Math.floor(new Date(h.fecha).getTime() / 1000) : 0;
            const time = timestamp > 0 ? `<t:${timestamp}:R>` : '*Fecha no registrada*';
            return `${h.resultado === 1 ? '✅' : '❌'} \`${Number(h.mult).toFixed(2)}x\` | **${h.ganancia >= 0 ? '+' : ''}${fmtNum(h.ganancia)}** | ${time}`;
        }).join('\n')
        : '*No hay expedientes recientes...*';

      const embed = new EmbedBuilder()
        .setAuthor({ name: `HISTORIAL DE FUGA: ${target.displayName}`, iconURL: target.displayAvatarURL({ dynamic: true }) })
        .setTitle('🚔 EXPEDIENTE DELICTIVO')
        .setDescription(`${SEP_SLIM}\n### 📊 ESTADÍSTICAS TOTALES\n` +
            `🏁 **Partidas:** \`${total}\` | 📈 **Winrate:** \`${winrate}%\`\n` +
            `💰 **Max Ganancia:** \`${fmtNum(p.fuga_max_ganancia || 0)}\` ${getMoneyEmoji()}\n` +
            `📈 **Total Ganado:** \`${fmtNum(p.fuga_total_ganado || 0)}\` ${getMoneyEmoji()}\n` +
            `💸 **Total Perdido:** \`${fmtNum(p.fuga_total_perdido || 0)}\` ${getMoneyEmoji()}\n` +
            `🔥 **Max Multiplicador:** \`${Number(p.fuga_max_mult || 0).toFixed(2)}x\`\n\n` +
            `### 📜 ÚLTIMOS 10 REGISTROS\n${historyStr}\n${SEP_SLIM}`)
        .setColor(COLOR_NEUTRO)
        .setFooter({ text: FOOTER });

      return interaction.reply({ embeds: [embed] });
  },
};
