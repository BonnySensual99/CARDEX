// ============================================================
// utils/cooldowns.js
// Sistema de cooldowns en memoria.
// Gestiona tanto los cooldowns de /roll como los de /carrera.
// ============================================================

// ── Detección de Fin de Semana (Sincronizado con España) ─────
function esFinDeSemana() {
  const { getSpainDate } = require('./constants');
  const dia = getSpainDate().getDay();
  return dia === 0 || dia === 6; // 0=Domingo, 6=Sábado
}

// ── Cooldowns Dinámicos (Fin de Semana reduce a la mitad) ─────
const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;

const COOLDOWNS_BASE = {
    carrera: 5 * MINUTO,
    fuga: 2 * MINUTO,
    desguace: 2 * HORA
};

function getCooldownMs(tipo) {
    const base = COOLDOWNS_BASE[tipo] || 5 * MINUTO;
    if (tipo === 'desguace') return base; // Desguace no reduce
    return esFinDeSemana() ? base / 2 : base;
}

// ── Cooldown del /roll ────────────────────────────────────────
// Día normal: 1:30 | Fin de semana: 1 Minuto (solicitado por usuario)
function getRollCooldown() {
  return esFinDeSemana() ? 1 * MINUTO : 90 * 1000;
}

const cooldowns = new Map();

function checkCooldown(guildId, userId) {
  const clave = `${guildId}_${userId}`;
  const ultimo = cooldowns.get(clave);
  if (!ultimo) return null;
  const restante = getRollCooldown() - (Date.now() - ultimo);
  return restante > 0 ? restante : null;
}

function setCooldown(guildId, userId) {
  cooldowns.set(`${guildId}_${userId}`, Date.now());
}

// ── Cooldown de /carrera ──────────────────────────────────────
const carreraCooldowns = new Map();

function checkCarreraCooldown(guildId, userId) {
  const clave = `carrera_${guildId}_${userId}`;
  const ultimo = carreraCooldowns.get(clave);
  if (!ultimo) return null;
  const restante = getCooldownMs('carrera') - (Date.now() - ultimo);
  return restante > 0 ? restante : null;
}

function setCarreraCooldown(guildId, userId) {
  carreraCooldowns.set(`carrera_${guildId}_${userId}`, Date.now());
}

// ── Cooldown de /fuga ─────────────────────────────────────────
const fugaCooldowns = new Map();

function checkFugaCooldown(guildId, userId) {
  const clave = `fuga_${guildId}_${userId}`;
  const ultimo = fugaCooldowns.get(clave);
  if (!ultimo) return null;
  const restante = getCooldownMs('fuga') - (Date.now() - ultimo);
  return restante > 0 ? restante : null;
}

function setFugaCooldown(guildId, userId) {
  fugaCooldowns.set(`fuga_${guildId}_${userId}`, Date.now());
}

// ── Cooldown de /desguace ─────────────────────────────────────
const desguaceCooldowns = new Map();

function checkDesguaceCooldown(guildId, userId) {
  const clave = `desguace_${guildId}_${userId}`;
  const ultimo = desguaceCooldowns.get(clave);
  if (!ultimo) return null;
  const restante = getCooldownMs('desguace') - (Date.now() - ultimo);
  return restante > 0 ? restante : null;
}

function setDesguaceCooldown(guildId, userId) {
  desguaceCooldowns.set(`desguace_${guildId}_${userId}`, Date.now());
}

function getMultiplicadorXP() {
    return esFinDeSemana() ? 2 : 1;
}

// ── Utilidad: formatear tiempo ────────────────────────────────
/**
 * Formatea milisegundos en un string legible.
 * Ejemplos: "4min 30s", "1h 2min", "45s"
 * @param {number} ms
 * @returns {string}
 */
function formatearTiempo(ms) {
  if (!ms || isNaN(ms)) return "0s";
  const totalSeg = Math.ceil(ms / 1000);
  const horas = Math.floor(totalSeg / 3600);
  const min = Math.floor((totalSeg % 3600) / 60);
  const seg = totalSeg % 60;

  if (horas > 0) return min > 0 ? `${horas}h ${min}min` : `${horas}h`;
  if (min > 0) return seg > 0 ? `${min}min ${seg}s` : `${min}min`;
  return `${seg}s`;
}

const COOLDOWN_MS = 90 * 1000;

module.exports = {
  checkCooldown,
  setCooldown,
  formatearTiempo,
  getRollCooldown,
  checkCarreraCooldown,
  setCarreraCooldown,
  checkFugaCooldown,
  setFugaCooldown,
  checkDesguaceCooldown,
  setDesguaceCooldown,
  getMultiplicadorXP,
  getCooldownMs,
  esFinDeSemana
};
