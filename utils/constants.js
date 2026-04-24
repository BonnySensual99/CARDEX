// ============================================================
// utils/constants.js
// Constantes compartidas por todos los módulos del bot.
// ============================================================

/** Colores hexadecimales por nivel de rareza */
const COLORES = {
  1: 0xADB5BD, // Platino Mate (Común)
  2: 0x20C997, // Turquesa Racing (Poco común)
  3: 0xCD7F32, // Bronce Bruñido (Vintage)
  4: 0x007BFF, // Azul Eléctrico (Raro)
  5: 0xA259FF, // Púrpura Royal (Épico)
  6: 0xFFD700, // Oro Puro (Legendario)
  7: 0xFF4D00, // Fuego Mítico (Mítico)
  8: 0xFF00FF, // Magenta Neón (Secreto)
};

/**
 * Metadatos completos de cada tier de rareza.
 *
 * Distribución de probabilidades (suma = 100):
 *  — Común: 45%
 *  — Poco común: 23% 
 *  — Clásico / Vintage: 15%
 *  — Raro: 9%        
 *  — Épico: 5%      
 *  — Legendario: 2.4% 
 *  — Mítico: 0.5%     
 *  — Secreto: 0.1%    (Extremadamente raro)
 *
 * creditos:    créditos obtenidos al reclamar un coche de esta rareza
 * multCarrera: multiplicador de fuerza en el sistema de carreras
 */
const RAREZA = {
  1: {
    nombre: 'Común',
    estrellas: '◆◇◇◇◇◇◇',
    barra: '▰▱▱▱▱▱▱',
    grado: 'C',
    asset: 'C.png',
    medalla: '⚪',
    icono: '⚪',
    prob: 44.00,
    creditos: 250,
    multCarrera: 1.00,
    frase: 'Sólido. Todo gran garaje empieza en algún sitio.',
    celebracion: '¡Bienvenido al garaje, piloto!',
  },
  2: {
    nombre: 'Poco común',
    estrellas: '◆◆◇◇◇◇◇',
    barra: '▰▰▱▱▱▱▱',
    grado: 'B',
    asset: 'B.png',
    medalla: '🟢',
    icono: '🟢',
    prob: 22.00,
    creditos: 650,
    multCarrera: 1.15,
    frase: 'Por encima de la media. No está nada mal.',
    celebracion: '¡Buen botín! Ese coche va directo al garaje.',
  },
  3: {
    nombre: 'Clásico / Vintage',
    estrellas: '◆◆◆◇◇◇◇',
    barra: '▰▰▰▱▱▱▱',
    grado: 'V',
    asset: 'vintage.png',
    medalla: '📜',
    icono: '📜',
    prob: 15.00,
    creditos: 1200,
    multCarrera: 1.30,
    frase: 'Una joya del pasado. Directo a la colección.',
    celebracion: '¡Elegancia pura! Un clásico entra en escena.',
  },
  4: {
    nombre: 'Raro',
    estrellas: '◆◆◆◆◇◇◇',
    barra: '▰▰▰▰▱▱▱',
    grado: 'A',
    asset: 'A.png',
    medalla: '🔵',
    icono: '🔵',
    prob: 9.00,
    creditos: 2500,
    multCarrera: 1.50,
    frase: '¡Este no cae todos los días! Un gran hallazgo.',
    celebracion: '¡Buena captura, piloto! Ese coche tiene historia.',
  },
  5: {
    nombre: 'Épico',
    estrellas: '◆◆◆◆◆◇◇',
    barra: '▰▰▰▰▰▱▱',
    grado: 'E',
    asset: 'E.gif',
    medalla: '💎',
    icono: '💎',
    prob: 6.00,
    creditos: 7500,
    multCarrera: 1.80,
    frase: 'TOP tier. Muy pocos lo tienen. Cuídalo bien.',
    celebracion: '💎 ¡Épico! Este coche marca la diferencia en cualquier garaje.',
  },
  6: {
    nombre: 'Legendario',
    estrellas: '◆◆◆◆◆◆◇',
    barra: '▰▰▰▰▰▰▱',
    grado: 'L',
    asset: 'L.gif',
    medalla: '👑',
    icono: '👑',
    prob: 3.40,
    creditos: 18000,
    multCarrera: 2.20,
    frase: '¡INCREÍBLE! Esto es rarísimo. Enhorabuena, piloto.',
    celebracion: '👑 ¡LEGENDARIO! Estás en la élite del servidor.',
  },
  7: {
    nombre: 'Mítico',
    estrellas: '◆◆◆◆◆◆◆',
    barra: '▰▰▰▰▰▰▰',
    grado: 'M',
    asset: 'M.gif',
    medalla: '🔥',
    icono: '🔥',
    prob: 0.50,
    creditos: 45000,
    multCarrera: 2.80,
    frase: '🔥 MÍTICO. Uno entre cien. El servidor debería aplaudirte.',
    celebracion: '🔥 MÍTICO. Esto no se ve todos los días. Sin palabras.',
  },
  8: {
    nombre: 'Secreto',
    estrellas: '◆◆◆◆◆◆◆',
    barra: '▰▰▰▰▰▰▰',
    grado: '????',
    asset: 'secret.gif',
    medalla: '🌈',
    icono: '🌈',
    prob: 0.10,
    creditos: 120000,
    multCarrera: 3.80,
    frase: '🌈 ¿ESTO EXISTE? Probabilidad casi cero. Eres una leyenda.',
    celebracion: '🌈 **S·E·C·R·E·T·O**. El servidor entero debería rendirte honores.',
  },
};


/** Lista de tiers ordenada de mayor a menor rareza (útil para /garaje). */
const TIERS_DESC = Object.entries(RAREZA)
  .map(([nivel, datos]) => ({ rareza: Number(nivel), ...datos }))
  .sort((a, b) => b.rareza - a.rareza);

/** Circuitos disponibles para el sistema de carreras */
const CIRCUITOS = [
  { nombre: 'Circuito Urbano de Madrid', emoji: '🏙️', desc: 'Calles cerradas del centro histórico' },
  { nombre: 'Autopista A-4 Sur', emoji: '🛣️', desc: 'Recta infinita bajo el sol de Andalucía' },
  { nombre: 'Col de Turini', emoji: '🏔️', desc: 'Curvas míticas del Rally de Montecarlo' },
  { nombre: 'Circuito de Jerez', emoji: '🏁', desc: 'Asfalto profesional de F1 y MotoGP' },
  { nombre: 'Paseo Marítimo de Valencia', emoji: '🌊', desc: 'Velocidad con el Mediterráneo de fondo' },
  { nombre: 'Carretera de la Cabrera', emoji: '🏞️', desc: 'Curvas técnicas entre pinos y granito' },
  { nombre: 'Puerto de Pajares', emoji: '❄️', desc: 'Asfalto traicionero y niebla espesa' },
  { nombre: 'Circuito Callejero de Bilbao', emoji: '⚡', desc: 'Trazado urbano cargado de adrenalina' },
  { nombre: 'Sierra Nevada Night Race', emoji: '🌙', desc: 'Carreras nocturnas bajo las estrellas' },
  { nombre: 'Recta de Barajas', emoji: '✈️', desc: 'La pista más larga de Europa. Sin curvas.' },
  { nombre: 'Circuito del Jarama', emoji: '🏰', desc: 'Curvas clásicas cargadas de historia' },
  { nombre: 'Ascari Race Resort', emoji: '💎', desc: 'El trazado privado más exclusivo de España' },
  { nombre: 'Montjuïc Park Classics', emoji: '🏛️', desc: 'Subida mítica al corazón de Barcelona' },
  { nombre: 'Ruta del Flysch (Zumaia)', emoji: '🗿', desc: 'Curvas imposibles sobre acantilados prehistóricos' },
  { nombre: 'Desierto de Tabernas', emoji: '🏜️', desc: 'Calor extremo y visibilidad reducida por arena' },
  { nombre: 'Costa da Morte (Galicia)', emoji: '⛈️', desc: 'Asfalto mojado y viento lateral muy fuerte' },
  { nombre: 'MotorLand Aragón', emoji: '🏎️', desc: 'Tecnología punta y la recta de atrás más larga' },
  { nombre: 'Carretera de Sa Calobra', emoji: '🌀', desc: 'El nudo de corbata: 270 grados de pura técnica' },
  { nombre: 'Nürburgring Nordschleife', emoji: '🤮', desc: 'El Infierno Verde: 20km de agonía y gloria' },
  { nombre: 'El Teide Night Climb', emoji: '🌋', desc: 'Ascenso volcánico sobre las nubes de Tenerife' },
];


/** Footer estándar del bot */
const FOOTER = '🏎️  CARSDEX';

/** Colores de UI genéricos */
const COLOR_NEUTRO = 0x1A1B1F; // Fondo oscuro premium
const COLOR_ERROR = 0xFF4D4D;  // Rojo intenso
const COLOR_EXITO = 0x00FF9D;  // Verde neón
const COLOR_DIARIO = 0xFFD700; // Oro
const COLOR_CARRERA = 0xFF8C00;
const COLOR_PERFIL = 0x7000FF; // Deep Purple
const COLOR_RANKING = 0x00D4FF;

/** Separador visual para embeds */
/** Separador visual para embeds */
const SEP = '┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓';
const SEP_SLIM = '─────────────── ◆ ───────────────';

/**
 * Formatea un número al estilo español: 12345 → "12.345"
 * @param {number} n
 * @returns {string}
 */
function fmtNum(n) {
  if (n === null || n === undefined) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Calcula la fuerza de un coche en carrera basándose en datos técnicos y el circuito.
 * @param {object} coche - Objeto coche del catálogo
 * @param {object} circuito - Objeto del circuito actual
 * @returns {number}
 */
function calcularFuerza(coche, circuito = {}, mejoras = { motor: 0, turbo: 0, trans: 0, susp: 0, frenos: 0, gomas: 0 }) {
  const mult = RAREZA[coche.rareza].multCarrera;

  // 1. Potencia base ajustada por rareza y MEJORAS DE MOTOR Y TURBO
  // Cada nivel de motor añade un 5% y cada nivel de turbo un 2% extra a la potencia base
  const boostPotencia = 1 + (mejoras.motor * 0.05) + (mejoras.turbo * 0.02);
  let fuerza = coche.cv * mult * boostPotencia;

  // 2. Bonus por tipo de circuito + MEJORAS ESPECÍFICAS
  const nombreCir = (circuito.nombre || '').toLowerCase();

  // Circuitos de VELOCIDAD (Mejoras: TURBO)
  if (nombreCir.includes('autopista') || nombreCir.includes('recta') || nombreCir.includes('jerez')) {
    const boostTurbo = 1 + (mejoras.turbo * 0.10);
    fuerza += (coche.velocidad_maxima * 0.5 * boostTurbo);
  }

  // Circuitos de AGILIDAD/CURVAS (Mejoras: SUSPENSIÓN Y FRENOS)
  if (nombreCir.includes('col de') || nombreCir.includes('cabrera') || nombreCir.includes('pajares')) {
    const boostManejo = (mejoras.susp * 30) + (mejoras.frenos * 20);
    const bonusPeso = Math.max(-300, (1500 - (coche.peso_kg || 1200)) * 0.15); // Clamp penalización
    fuerza += (bonusPeso + boostManejo);
  }

  // Circuitos URBANOS (Aceleración) (Mejoras: TRANSMISIÓN)
  if (nombreCir.includes('urbano') || nombreCir.includes('callejero') || nombreCir.includes('marítimo')) {
    const boostTrans = 1 + (mejoras.trans * 0.08);
    const bonusAcel = Math.max(-400, (8 - coche.aceleracion_0_100) * 20) * boostTrans; // Clamp penalización
    fuerza += bonusAcel;
  }

  // Garantía de potencia mínima antes de multiplicadores finales
  fuerza = Math.max(100, fuerza);

  // Bonus Gomas (Agarre general - Multiplicador de tracción)
  fuerza *= (1 + (mejoras.gomas * 0.02));

  // 3. Factor de Consistencia (92%–108%) - Variabilidad para permitir sorpresas mecánicas
  const luck = 0.92 + Math.random() * 0.16;

  return Math.round(fuerza * luck);
}

/**
 * Genera un comentario basado en el margen de victoria.
 * @param {number} margen - Porcentaje (0-100)
 * @param {boolean} esSorpresa - Si el ganador tenía menor rareza
 * @returns {string}
 */
function comentarioCarrera(margen, esSorpresa) {
  if (esSorpresa) return '🎲 **¡SORPRESA!** El favorito cayó contra todo pronóstico.';
  if (margen < 3) return '🫀 ¡Fotografía de meta! Solo milésimas los separaron.';
  if (margen < 10) return '⚡ Carrera muy ajustada. El ganador lo sudó hasta el final.';
  if (margen < 25) return '🚀 Victoria clara en una buena disputa.';
  return '💪 ¡Dominante! No hubo color en la pista hoy.';
}

/**
 * Obtiene el emoji visual para un Tier. 
 * Prioriza los emojis personalizados subidos al servidor.
 * @param {number} rarezaLevel
 * @param {boolean} single - Si es true, solo devuelve un emoji (útil para spinners/UIs compactas)
 */
function getTierEmoji(rarezaLevel, single = false) {
  const r = RAREZA[rarezaLevel];
  if (!r) return '⚪';

  let emoji = r.medalla;
  if (global.EMOJIS_TIER) {
    const key = (rarezaLevel === 8) ? 'Tiersecret' : `Tier${r.grado}`;
    emoji = global.EMOJIS_TIER[key] || r.medalla;
  }

  return emoji;
}

/** Obtiene el emoji dinámico para el dinero. */
function getMoneyEmoji() { return global.EMOJIS_TIER?.Money || '💰'; }

/** Obtiene el emoji dinámico para la potencia. */
function getPowerEmoji() { return global.EMOJIS_TIER?.Power || '⚡'; }

/** Obtiene el emoji dinámico para ítems bloqueados. */
function getLockedEmoji() { return global.EMOJIS_TIER?.Locked || '🔒'; }

/** Obtiene el emoji dinámico para ítems desbloqueados. */
function getUnlockedEmoji() { return global.EMOJIS_TIER?.Unlocked || '✅'; }

/** Obtiene el emoji dinámico para el trofeo de victorias. */
const getTrophyEmoji = () => global.EMOJIS_TIER?.Trophy || '🏆';

/** Definiciones de climas para el desguace */
const CLIMAS_DESGUACE = {
  clear: {
    id: 'clear',
    nombre: 'Despejado',
    emoji: '☀️',
    desc: 'Visibilidad perfecta. Todo está tranquilo.',
    bonus: 'Sin efectos adicionales.'
  },
  rain: {
    id: 'rain',
    nombre: 'Tormenta',
    emoji: '⛈️',
    desc: 'La lluvia oculta tus pasos y el ruido.',
    bonus: '¡+50% de créditos por botín! 💰'
  },
  blood: {
    id: 'blood',
    nombre: 'Luna de Sangre',
    emoji: '🌑',
    desc: 'Los perros están más agresivos y hambrientos.',
    bonus: 'Peligro: Los perros quitan 3 pases (en vez de 1). 🐕'
  },
  gold: {
    id: 'gold',
    nombre: 'Fortuna',
    emoji: '✨',
    desc: 'Un brillo dorado emana de los contenedores.',
    bonus: 'Suerte: Inicias con 8 pases de linterna (en vez de 6). 🔦'
  },
  fog: {
    id: 'fog',
    nombre: 'Niebla',
    emoji: '🌫️',
    desc: 'La visibilidad es nula, pero el silencio es absoluto.',
    bonus: 'Sigilo: Los perros son menos propensos a aparecer (-50%). 🐕'
  },
  eclipse: {
    id: 'eclipse',
    nombre: 'Eclipse',
    emoji: '🌑',
    desc: 'La oscuridad es total. Los tesoros brillan más.',
    bonus: 'Misticismo: Los vehículos (🏎️) tienen el doble de probabilidad.'
  },
  radiation: {
    id: 'radiation',
    nombre: 'Radiación',
    emoji: '☢️',
    desc: 'El aire está cargado de energía inestable.',
    bonus: 'Carga: Los Vales (🎲) encontrados se multiplican x2.'
  }
};

module.exports = {
  COLORES,
  RAREZA,
  TIERS_DESC,
  CIRCUITOS,
  CLIMAS_DESGUACE,
  FOOTER,
  COLOR_NEUTRO,
  COLOR_ERROR,
  COLOR_EXITO,
  COLOR_DIARIO,
  COLOR_CARRERA,
  COLOR_PERFIL,
  COLOR_RANKING,
  SEP,
  SEP_SLIM,
  fmtNum,
  getTierEmoji,
  getMoneyEmoji,
  getPowerEmoji,
  getLockedEmoji,
  getUnlockedEmoji,
  getTrophyEmoji,
  calcularFuerza,
  comentarioCarrera,
  /** Utility logger for production diagnostics */
  LOGGER: {
      info:  (msg) => console.log(`${chalk.blue('[INFO]')} ${msg}`),
      warn:  (msg) => console.log(`${chalk.yellow('[WARN]')} ${msg}`),
      error: (msg) => console.log(`${chalk.red('[ERROR]')} ${msg}`),
      db:    (msg) => console.log(`${chalk.magenta('[DB]')} ${msg}`),
      ok:    (msg) => console.log(`${chalk.green('[OK]')} ${msg}`),
  },

  /**
   * Obtiene la fecha/hora actual ajustada a España (CET/CEST)
   * @returns {Date}
   */
  getSpainDate: () => {
      return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  },

  /**
   * Obtiene el string de fecha YYYY-MM-DD actual en España
   */
  getFechaHoySpain: () => {
      const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
      return d.toISOString().split('T')[0];
  }
};
