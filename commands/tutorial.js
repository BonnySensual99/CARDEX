// ============================================================
// commands/tutorial.js
// Comando administrativo para desplegar la guía de inicio.
// ============================================================

const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ChannelType 
} = require('discord.js');

const { 
    SEP, 
    COLOR_NEUTRO, 
    getMoneyEmoji, 
    getPowerEmoji, 
    getTrophyEmoji 
} = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-tutorial')
        .setDescription('Despliega la guía de inicio premium para nuevos jugadores.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption(opt => 
            opt.setName('canal')
                .setDescription('Canal donde se enviará el tutorial.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),

    async execute(interaction) {
        const canal = interaction.options.getChannel('canal') || interaction.channel;

        const embed = new EmbedBuilder()
            .setTitle('🚀 BIENVENIDO A CARDEX: HIGH PERFORMANCE ROLEPLAY')
            .setDescription(
                `Has entrado en la red clandestina de coleccionismo y carreras más grande del servidor. Aquí no solo se conduce, se sobrevive.\n\n` +
                `### 1️⃣ PRIMEROS PASOS\n` +
                `Para empezar tu carrera, necesitas tu primer vehículo:\n` +
                `• Usa **\`?roll\`** o **\`/roll\`** para obtener tu primer coche aleatorio.\n` +
                `• Usa **\`?perfil\`** para ver tus estadísticas y tu licencia de piloto.\n` +
                `• Usa **\`?garaje\`** para gestionar tu colección y equipar coches.\n\n` +
                `### 2️⃣ ECONOMÍA Y PRESTIGIO\n` +
                `Sin dinero no hay gasolina. Mantén tu cuenta saneada:\n` +
                `• **\`?diario\`**: Recoge tus fondos diarios. Crucial para progresar.\n` +
                `• **\`?misiones\`**: Retos diarios que otorgan gran cantidad de XP y créditos.\n` +
                `• **\`?tienda\`**: El HUB central para comprar sobres, piezas y coches de otros.\n\n` +
                `### 3️⃣ UNIÓN TERRITORIAL (CLANES)\n` +
                `No corras solo. Las bandas dominan la ciudad:\n` +
                `• **\`?clan crear [Nombre] [Tag]\`**: Funda tu banda (Cuesta 50k).\n` +
                `• **\`?clan unirse [Tag]\`**: Busca un clan por su tag y solicita entrar.\n` +
                `• **\`?clan privado [true/false]\`**: Decide si cualquiera puede entrar.\n` +
                `• Mira **\`?ranking clanes\`** para ver quién manda en la ciudad.\n\n` +
                `### 🏎️ CONSEJOS DE VETERANO\n` +
                `> 💡 **Equipa tu coche**: Tras conseguir un coche en el roll, equípalo en el garaje.\n` +
                `> 💡 **Taller**: Instala un **Turbo** en la tienda para no quedarte atrás.\n` +
                `> 💡 **Dualidad**: Puedes usar **\`?\`** o **\`/\`** para todos los comandos.\n\n` +
                `${SEP}\n` +
                `*¿Tienes dudas? Usa \`?ayuda\` para ver el manual interactivo de la ciudad.*`
            )
            .setColor(0x00FFBB)
            .setImage('https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=2000')
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/3592/3592259.png')
            .setFooter({ text: 'Cardex OS v2.1 | Manual de Supervivencia Urbana' });

        try {
            await canal.send({ embeds: [embed] });
            await interaction.reply({ content: `✅ Tutorial enviado con éxito a ${canal}.`, ephemeral: true });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: '❌ No he podido enviar el mensaje. Revisa mis permisos en ese canal.', ephemeral: true });
        }
    }
};
