
/**
 * Utilidades para el sistema de niveles y rangos de pilotos.
 */

const RANGLOS = [
    { lvl: 1,   nombre: 'Novato 1',      color: '#95a5a6', emoji: '🔰', maxApuesta: 10000 },
    { lvl: 5,   nombre: 'Novato 2',      color: '#95a5a6', emoji: '🔰', maxApuesta: 25000 },
    { lvl: 10,  nombre: 'Amateur 1',     color: '#3498db', emoji: '🏎️', maxApuesta: 40000 },
    { lvl: 15,  nombre: 'Amateur 2',     color: '#3498db', emoji: '🏎️', maxApuesta: 60000 },
    { lvl: 20,  nombre: 'Profesional 1', color: '#2ecc71', emoji: '🏁', maxApuesta: 80000 },
    { lvl: 25,  nombre: 'Profesional 2', color: '#2ecc71', emoji: '🏁', maxApuesta: 100000 },
    { lvl: 30,  nombre: 'Experto 1',    color: '#f39c12', emoji: '🏆', maxApuesta: 125000 },
    { lvl: 35,  nombre: 'Experto 2',    color: '#f39c12', emoji: '🏆', maxApuesta: 150000 },
    { lvl: 40,  nombre: 'Veterano 1',   color: '#f1c40f', emoji: '🏅', maxApuesta: 200000 },
    { lvl: 45,  nombre: 'Veterano 2',   color: '#f1c40f', emoji: '🏅', maxApuesta: 250000 },
    { lvl: 50,  nombre: 'Maestro 1',    color: '#e67e22', emoji: '🎴', maxApuesta: 300000 },
    { lvl: 55,  nombre: 'Maestro 2',    color: '#e67e22', emoji: '🎴', maxApuesta: 350000 },
    { lvl: 60,  nombre: 'Elite 1',      color: '#9b59b6', emoji: '💎', maxApuesta: 400000 },
    { lvl: 65,  nombre: 'Elite 2',      color: '#9b59b6', emoji: '💎', maxApuesta: 500000 },
    { lvl: 70,  nombre: 'Campeón 1',    color: '#1abc9c', emoji: '🥇', maxApuesta: 600000 },
    { lvl: 75,  nombre: 'Campeón 2',    color: '#1abc9c', emoji: '🥇', maxApuesta: 700000 },
    { lvl: 80,  nombre: 'Icono 1',      color: '#34495e', emoji: '🌌', maxApuesta: 800000 },
    { lvl: 85,  nombre: 'Icono 2',      color: '#34495e', emoji: '🌌', maxApuesta: 900000 },
    { lvl: 90,  nombre: 'As del Volante 1', color: '#e74c3c', emoji: '🔥', maxApuesta: 1000000 },
    { lvl: 95,  nombre: 'As del Volante 2', color: '#e74c3c', emoji: '🔥', maxApuesta: 1250000 },
    { lvl: 100, nombre: 'Leyenda',      color: '#ffd700', emoji: '👑', maxApuesta: 1500000 },
];

/**
 * Calcula el nivel basado en la experiencia total.
 * Fórmula mejorada (más difícil): Nivel = floor(sqrt(exp / 500)) + 1
 */
function calcularNivel(exp) {
    if (!exp || exp <= 0) return 1;
    return Math.floor(Math.sqrt(exp / 150)) + 1;
}

/**
 * Calcula la experiencia necesaria para alcanzar el siguiente nivel.
 */
function expParaNivel(nivel) {
    if (nivel <= 1) return 0;
    return Math.pow(nivel - 1, 2) * 150;
}

/**
 * Obtiene el rango actual basado en el nivel.
 */
function obtenerRango(nivel) {
    let rangoActual = RANGLOS[0];
    for (const r of RANGLOS) {
        if (nivel >= r.lvl) rangoActual = r;
        else break;
    }
    return rangoActual;
}

/**
 * Genera una barra de progreso visual para la experiencia.
 */
function generarBarraExp(exp) {
    const lvl = calcularNivel(exp);
    const actualBase = expParaNivel(lvl);
    const sigBase = expParaNivel(lvl + 1);
    
    const expEnNivel = exp - actualBase;
    const expTotalNecesaria = sigBase - actualBase;
    
    const pct = Math.min(100, Math.max(0, (expEnNivel / expTotalNecesaria) * 100));
    const bloques = Math.round(pct / 10);
    
    const barra = '▰'.repeat(bloques) + '▱'.repeat(10 - bloques);
    return {
        barra,
        pct: Math.round(pct),
        actual: expEnNivel,
        total: expTotalNecesaria
    };
}

/**
 * Calcula la apuesta máxima permitida según el nivel.
 */
function calcularMaxApuesta(nivel) {
    const { esFinDeSemana } = require('./cooldowns');
    const rango = obtenerRango(nivel);
    const base = rango.maxApuesta || 10000;
    
    // Fines de semana: Apuesta máxima x2
    return esFinDeSemana() ? base * 2 : base;
}

module.exports = {
    calcularNivel,
    expParaNivel,
    obtenerRango,
    generarBarraExp,
    calcularMaxApuesta
};
