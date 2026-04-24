const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder 
} = require('discord.js');
const { COLOR_NEUTRO, SEP, FOOTER, getMoneyEmoji, getPowerEmoji, getTrophyEmoji, getTierEmoji } = require('../utils/constants');

const PAGINAS = {
    inicio: {
        title: '🚀 MANUAL DE OPERACIONES: CARDEX CENTRAL',
        icon: 'https://cdn-icons-png.flaticon.com/512/3592/3592259.png',
        desc: `Bienvenido a **Cardex**, el simulador definitivo de cultura automovilística y competición RPG.\n\n` +
              `🔹 **Objetivo**: Colecciona los +300 vehículos, crea tu banda (Clan), mejora tus máquinas y domina las calles.\n` +
              `🔹 **Sistema Dual**: Puedes usar comandos de barra **\`/\`** o el prefijo **\`?\`** (Ej: \`?perfil\`). Ambos funcionan igual.\n\n` +
              `📍 Usa el **Menú Desplegable** de abajo para explorar cada departamento de la ciudad.`,
        color: 0xEECC00,
        image: 'https://images.unsplash.com/photo-1603584173870-7634f1ecb25d?q=80&w=2000'
    },
    competicion: {
        title: '🏁 BOXES: COMPETICIÓN Y DUELOS',
        icon: 'https://cdn-icons-png.flaticon.com/512/716/716429.png',
        desc: `Domina el asfalto en diferentes disciplinas.\n\n` +
              `🔹 **\`?carrera\` (Solo/Bot)**: Corre contra la IA. La apuesta mínima vs Bot es de 1.000 cr.\n` +
              `🔹 **\`?carrera reto [usuario] [apuesta]\`**: Duelo directo contra otro jugador.\n` +
              `🔹 **Pink Slips (Apostar Coche)**: En retos PVP puedes apostar tu coche activo (\`/carrera reto apuesta:1000 rival:@user apostar_coche:true\`).\n` +
              `🔹 **Nigga-Tech Rival**: Un 15% de veces aparecerá un **Sleeper** (Bot modificado) con potencia extrema.`,
        color: 0xE67E22
    },
    rolls: {
        title: '💎 CONCESIONARIO: ROLLS Y RAREZAS',
        icon: 'https://cdn-icons-png.flaticon.com/512/4127/4127293.png',
        desc: `Tu colección empieza aquí con \`?roll\`.\n\n` +
              `🔹 **Rolls Diarios**: Tienes **50 rolls gratis** que se recargan cada día a las 00:00.\n` +
              `🔹 **Rolls Extra**: Se consiguen en desguaces o eventos. Se gastan **solo cuando se acaban los diarios**.\n\n` +
              `**TABLA DE RAREZAS (TIERS):**\n` +
              `${getTierEmoji(1, true)} C: Común | ${getTierEmoji(2, true)} B: Poco Común | ${getTierEmoji(3, true)} V: **Vintage**\n` +
              `${getTierEmoji(4, true)} A: Raro | ${getTierEmoji(5, true)} S: Épico | ${getTierEmoji(6, true)} SS: Legendario\n` +
              `${getTierEmoji(7, true)} SSS: Mítico | ${getTierEmoji(8, true)} ????: **Secreto**`,
        color: 0x3498DB
    },
    economia: {
        title: '🏪 MERCADO: ECONOMÍA Y TIENDA',
        icon: 'https://cdn-icons-png.flaticon.com/512/2489/2489756.png',
        desc: `Gestiona tu capital para escalar posiciones.\n\n` +
              `🔹 **\`?diario\`**: Recoge tus fondos diarios. Mantén la racha para ganar más.\n` +
              `🔹 **\`?tienda\`**: El HUB central donde puedes comprar packs de sobres y mejoras.\n` +
              `🔹 **Mercado P2P**: Compra o vende coches a otros jugadores en la sección Mercadillo de la tienda.\n` +
              `🔹 **\`?perfil\`**: Mira tu nivel, rango actual y saldo de créditos.`,
        color: 0x2ECC71
    },
    minijuegos: {
        title: '🚔 SUBMUNDO: LA FUGA Y DESGUACE',
        icon: 'https://cdn-icons-png.flaticon.com/512/2555/2555022.png',
        desc: `Dinero rápido con alto riesgo.\n\n` +
              `🔹 **\`?fuga jugar [apuesta]\`**: Arriesga tus créditos. Usa \`all\` o \`todo\` para un All-In sin límites de nivel.\n` +
              `🔹 **\`?desguace\`**: Explora zonas abandonadas para encontrar piezas raras y rolls extra.\n` +
              `🔹 **Ruleta Desguace**: Cada 12h puedes jugar un doble o nada con el botín del desguace.`,
        color: 0xE74C3C
    },
    clanes: {
        title: '🛡️ CONTROL TERRITORIAL: CLANES',
        icon: 'https://cdn-icons-png.flaticon.com/512/1066/1066371.png',
        desc: `No corras solo. Crea o únete a una Car Gang.\n\n` +
              `🔹 **\`?clan crear [Nombre] [Tag]\`**: Funda tu banda (Cuesta 50k).\n` +
              `🔹 **\`?clan unirse [Tag]\`**: Solicita unirte a un clan o únete directo si es público.\n` +
              `🔹 **\`?clan privado [true/false]\`**: Los líderes pueden cambiar si el clan requiere invitación.\n` +
              `🔹 **\`?clan invitar [@usuario]\`**: Envía una invitación directa a un piloto.\n` +
              `🔹 **\`?ranking clanes\`**: Mira quién domina el servidor por XP total.`,
        color: 0x1ABC9C
    },
    taller: {
        title: '🛠️ EL TALLER: MEJORAS DE RENDIMIENTO',
        icon: 'https://cdn-icons-png.flaticon.com/512/3062/3062331.png',
        desc: `Un coche de serie no gana carreras de alto nivel. Usa \`?tienda\` -> Taller.\n\n` +
              `🔹 **Mejoras (Lv 1-5)**: \n` +
              `  🚀 **Turbo**: Aumenta la velocidad punta y potencia bruta.\n` +
              `  ⚙️ **Motor**: Mejora los CV estáticos y eficiencia.\n` +
              `  🌊 **Gomas/Suspensión**: Mejora el agarre y paso por curva.\n\n` +
              `Usa \`/garaje\` para ver las piezas instaladas en tus coches.`,
        color: 0x7F8C8D
    },
    progresion: {
        title: '👑 REPUTACIÓN: RANGOS Y NIVELES',
        icon: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png',
        desc: `Tu prestigio define tu límite de apuestas.\n\n` +
              `🔹 **XP**: Consigue experiencia en carreras, fugas o misiones.\n` +
              `🔹 **Rangos**: Cada 5 niveles desbloqueas una **Licencia** superior (\`/perfil\`).\n` +
              `🔹 **\`?misiones\`**: 3 retos diarios únicos para ganar XP masivo rápido.\n` +
              `🔹 **\`?ranking\`**: Compite contra todos en Riqueza, Victorias, Colección o Nivel.`,
        color: 0x9B59B6
    }
};

function generarEmbedHelp(id = 'inicio') {
    const p = PAGINAS[id] || PAGINAS.inicio;
    return new EmbedBuilder()
        .setAuthor({ name: p.title, iconURL: p.icon })
        .setDescription(`${SEP}\n${p.desc}\n${SEP}`)
        .setColor(p.color || COLOR_NEUTRO)
        .setImage(p.image || null)
        .setTimestamp()
        .setFooter({ text: FOOTER });
}

function generarRowHelp() {
    const select = new StringSelectMenuBuilder()
        .setCustomId('ayuda_nav')
        .setPlaceholder('Explorar secciones del manual...')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Inicio').setValue('inicio').setEmoji('🏠'),
            new StringSelectMenuOptionBuilder().setLabel('Rolls y Catálogo').setValue('rolls').setEmoji('💎'),
            new StringSelectMenuOptionBuilder().setLabel('Competición').setValue('competicion').setEmoji('🏁'),
            new StringSelectMenuOptionBuilder().setLabel('Economía').setValue('economia').setEmoji('🏪'),
            new StringSelectMenuOptionBuilder().setLabel('Minijuegos').setValue('minijuegos').setEmoji('🚔'),
            new StringSelectMenuOptionBuilder().setLabel('Clanes / Bandas').setValue('clanes').setEmoji('🛡️'),
            new StringSelectMenuOptionBuilder().setLabel('Taller y Mejoras').setValue('taller').setEmoji('🛠️'),
            new StringSelectMenuOptionBuilder().setLabel('Progresión / Rango').setValue('progresion').setEmoji('👑')
        );
    return new ActionRowBuilder().addComponents(select);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ayuda')
    .setDescription('Manual de operaciones interactivo de Cardex.'),

  async execute(interaction) {
    await interaction.reply({ 
        embeds: [generarEmbedHelp('inicio')], 
        components: [generarRowHelp()] 
    });
  },

  async handleSelectMenu(interaction) {
      const val = interaction.values[0];
      await interaction.update({ 
          embeds: [generarEmbedHelp(val)], 
          components: [generarRowHelp()] 
      });
  }
};

