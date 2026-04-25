/**
 * database/db.js - MOTOR PROFESIONAL MYSQL (Wispbyte)
 * Refactorizado para máxima velocidad y concurrencia.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool de conexiones para evitar saturar el servidor
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 50, // Aumentado para soportar más usuarios simultáneos
    queueLimit: 0,
    connectTimeout: 10000 // 10 segundos de timeout para evitar cuelgues
});
 
// Caché en memoria para perfiles (Optimización de velocidad)
const CACHE_PERFILES = new Map();
const CACHE_TTL = 5000; // 5 segundos de gracia

// --- INICIALIZACIÓN ---
async function inicializarDB() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ [DATABASE] Conexión con Wispbyte establecida correctamente.');
        connection.release();
    } catch (err) {
        console.error('❌ [DATABASE] Error al conectar con Wispbyte:', err.message);
        throw err;
    }
}

// --- HELPERS INTERNOS ---
async function query(sql, params) {
    const [rows] = await pool.execute(sql, params);
    return rows;
}

// --- FUNCIONES DE PERFIL ---
async function obtenerPerfil(usuarioId) {
    const ahora = Date.now();
    
    // 1. Intentar desde caché
    if (CACHE_PERFILES.has(usuarioId)) {
        const entry = CACHE_PERFILES.get(usuarioId);
        if (ahora - entry.timestamp < CACHE_TTL) {
            return entry.data;
        }
    }

    // 2. Si no está o caducó, ir a la DB
    const rows = await query('SELECT * FROM perfiles WHERE usuario_id = ?', [usuarioId]);
    
    let profile = null;
    if (rows.length === 0) {
        await query('INSERT INTO perfiles (usuario_id, creditos, exp, piezas, rolls_disponibles) VALUES (?, 10000, 0, 0, 50)', [usuarioId]);
        const newRows = await query('SELECT * FROM perfiles WHERE usuario_id = ?', [usuarioId]);
        profile = newRows[0];
    } else {
        profile = rows[0];
    }

    // 3. Guardar en caché y retornar
    CACHE_PERFILES.set(usuarioId, { data: profile, timestamp: ahora });
    return profile;
}

async function sumarCreditos(usuarioId, guildId, cantidad) {
    await query('UPDATE perfiles SET creditos = creditos + ? WHERE usuario_id = ?', [cantidad, usuarioId]);
    CACHE_PERFILES.delete(usuarioId);
}

async function restarCreditos(usuarioId, guildId, cantidad) {
    await query('UPDATE perfiles SET creditos = creditos - ? WHERE usuario_id = ?', [cantidad, usuarioId]);
    CACHE_PERFILES.delete(usuarioId);
}

async function sumarExp(usuarioId, guildId, cantidad) {
    await query('UPDATE perfiles SET exp = exp + ? WHERE usuario_id = ?', [cantidad, usuarioId]);
    CACHE_PERFILES.delete(usuarioId);
}

async function sumarPieza(usuarioId, cantidad) {
    await query('UPDATE perfiles SET piezas = piezas + ? WHERE usuario_id = ?', [cantidad, usuarioId]);
    CACHE_PERFILES.delete(usuarioId);
    return await actualizarMision(usuarioId, 'DESGUACE_PIEZA', cantidad);
}

async function sumarExtraRolls(usuarioId, cantidad) {
    await query('UPDATE perfiles SET rolls_extra = rolls_extra + ? WHERE usuario_id = ?', [cantidad, usuarioId]);
}

// --- FUNCIONES DE GARAJE ---
async function añadirCocheGaraje(usuarioId, guildId, cocheId) {
    const [result] = await pool.execute(
        'INSERT INTO inventario (usuario_id, guild_id, coche_id, reclamado_en) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [usuarioId, guildId, cocheId]
    );
    return { exito: true, inventarioId: result.insertId };
}

async function obtenerInventario(usuarioId) {
    return await query('SELECT * FROM inventario WHERE usuario_id = ? ORDER BY id DESC', [usuarioId]);
}

async function obtenerVehiculoInstancia(instanciaId, userId) {
    if (!instanciaId) return null;
    const rows = await query('SELECT * FROM inventario WHERE id = ? AND usuario_id = ?', [instanciaId, userId]);
    return rows[0] || null;
}

async function setCocheActivo(usuarioId, guildId, instanciaId) {
    await query('UPDATE perfiles SET coche_activo = ? WHERE usuario_id = ?', [instanciaId, usuarioId]);
}

async function subirMejoraVehiculo(instanciaId, tipo) {
    // Validar tipo de mejora permitido
    const allowed = ['motor', 'turbo', 'trans', 'susp', 'frenos', 'gomas', 'peso'];
    if (!allowed.includes(tipo)) return;
    await query(`UPDATE inventario SET ${tipo} = IFNULL(${tipo}, 0) + 1 WHERE id = ?`, [instanciaId]);
}

// --- MINIJUEGOS ---
async function registrarFugaResultado(usuarioId, mult, ganancia, esVictoria) {
    await query(
        'INSERT INTO fuga_historial (usuario_id, resultado, mult, ganancia, fecha) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [usuarioId, esVictoria ? 1 : 0, mult, ganancia]
    );
    // Actualizar acumulados en perfil
    if (esVictoria) {
        await query('UPDATE perfiles SET fuga_total_ganado = fuga_total_ganado + ?, fuga_max_ganancia = GREATEST(fuga_max_ganancia, ?), fuga_max_mult = GREATEST(fuga_max_mult, ?), fuga_ganado = fuga_ganado + 1 WHERE usuario_id = ?', [ganancia, ganancia, mult, usuarioId]);
        await actualizarMision(usuarioId, 'FUGA_WIN', 1);
        await actualizarMision(usuarioId, 'FUGA_MULT', mult);
    } else {
        await query('UPDATE perfiles SET fuga_total_perdido = fuga_total_perdido + ?, fuga_perdido = fuga_perdido + 1 WHERE usuario_id = ?', [Math.abs(ganancia), usuarioId]);
    }

    // XP y Level Up
    const xpGanada = esVictoria ? 150 : 25;
    const p = await obtenerPerfil(usuarioId);
    const nivelAnterior = Math.floor(Math.sqrt(p.exp / 150)) + 1;
    
    await sumarExp(usuarioId, null, xpGanada);
    
    const pNuevo = await obtenerPerfil(usuarioId);
    const nivelNuevo = Math.floor(Math.sqrt(pNuevo.exp / 150)) + 1;
    
    if (nivelNuevo > nivelAnterior) {
        const recompensa = nivelNuevo * 5000;
        await sumarCreditos(usuarioId, null, recompensa);
        return { subio: true, nivelNuevo, recompensa };
    }
    return { subio: false };
}

async function obtenerHistorialFuga(usuarioId, limite = 5) {
    return await query('SELECT * FROM fuga_historial WHERE usuario_id = ? ORDER BY id DESC LIMIT ?', [usuarioId, limite]);
}

async function registrarCarreraResultado(usuarioId, rivalId, apuesta, ganancia, esVictoria) {
    await query(
        'INSERT INTO carrera_historial (usuario_id, rival_id, apuesta, ganancia, resultado, fecha) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [usuarioId, rivalId, apuesta, ganancia, esVictoria ? 1 : 0]
    );
    if (esVictoria) {
        await query('UPDATE perfiles SET carrera_total_ganado = carrera_total_ganado + ?, victorias = victorias + ?, carrera_max_ganancia = GREATEST(carrera_max_ganancia, ?) WHERE usuario_id = ?', [ganancia, 1, ganancia, usuarioId]);
        await actualizarMision(usuarioId, 'CARRERA_WIN', 1);
    } else {
        await query('UPDATE perfiles SET carrera_total_perdido = carrera_total_perdido + ?, derrotas = derrotas + ? WHERE usuario_id = ?', [Math.abs(ganancia), 1, usuarioId]);
    }
}

async function registrarVictoria(usuarioId) {
    const xpGanada = 250;
    const p = await obtenerPerfil(usuarioId);
    const nivelAnterior = Math.floor(Math.sqrt(p.exp / 150)) + 1;
    
    await sumarExp(usuarioId, null, xpGanada);
    
    const pNuevo = await obtenerPerfil(usuarioId);
    const nivelNuevo = Math.floor(Math.sqrt(pNuevo.exp / 150)) + 1;
    
    if (nivelNuevo > nivelAnterior) {
        const recompensa = nivelNuevo * 5000;
        await sumarCreditos(usuarioId, null, recompensa);
        return { subio: true, nivelNuevo, recompensa };
    }
    return { subio: false };
}

async function registrarDerrota(usuarioId) {
    const xpGanada = 50;
    const p = await obtenerPerfil(usuarioId);
    const nivelAnterior = Math.floor(Math.sqrt(p.exp / 150)) + 1;
    
    await sumarExp(usuarioId, null, xpGanada);
    
    const pNuevo = await obtenerPerfil(usuarioId);
    const nivelNuevo = Math.floor(Math.sqrt(pNuevo.exp / 150)) + 1;
    
    if (nivelNuevo > nivelAnterior) {
        const recompensa = nivelNuevo * 5000;
        await sumarCreditos(usuarioId, null, recompensa);
        return { subio: true, nivelNuevo, recompensa };
    }
    return { subio: false };
}

async function obtenerHistorialCarrera(usuarioId, limite = 10) {
    return await query('SELECT * FROM carrera_historial WHERE usuario_id = ? ORDER BY id DESC LIMIT ?', [usuarioId, limite]);
}

async function transferirCoche(instanciaId, nuevoOwnerId, guildId) {
    await query('UPDATE inventario SET usuario_id = ? WHERE id = ?', [nuevoOwnerId, instanciaId]);
}

// --- ROLLS Y LÍMITES ---
async function verificarLimiteRolls(usuarioId, guildId) {
    const p = await obtenerPerfil(usuarioId);
    const ahora = Date.now();
    const tiempoReset = 90 * 60 * 1000; // 90 min

    let disponibles = p.rolls_disponibles;
    let extras = p.rolls_extra || 0;

    if (!p.u_comando || (ahora - p.u_comando > tiempoReset)) {
        await query('UPDATE perfiles SET rolls_disponibles = 50, u_comando = ? WHERE usuario_id = ?', [ahora, usuarioId]);
        disponibles = 50;
    }

    const total = disponibles + extras;

    return { 
        puede: total > 0, 
        normales: disponibles,
        extras: extras,
        restantes: total, 
        resetEn: tiempoReset - (ahora - p.u_comando) 
    };
}

async function incrementarRolls(usuarioId, guildId) {
    const p = await obtenerPerfil(usuarioId);
    if (p.rolls_disponibles > 0) {
        await query('UPDATE perfiles SET rolls_disponibles = rolls_disponibles - 1, rolls_totales = rolls_totales + 1 WHERE usuario_id = ?', [usuarioId]);
    } else {
        await query('UPDATE perfiles SET rolls_extra = rolls_extra - 1, rolls_totales = rolls_totales + 1 WHERE usuario_id = ?', [usuarioId]);
    }
}

async function registrarRoll(rollId, guildId, cocheId) {
    await query('INSERT INTO rolls_activos (roll_id, guild_id, coche_id) VALUES (?, ?, ?)', [rollId, guildId, cocheId]);
}

async function obtenerUltimosCoches(usuarioId, limite = 10) {
    const rows = await query('SELECT coche_id FROM inventario WHERE usuario_id = ? ORDER BY id DESC LIMIT ?', [usuarioId, limite]);
    return rows.map(r => r.coche_id);
}

// --- RANKINGS ---
async function obtenerRankingXP(limite = 10) {
    return await query('SELECT usuario_id, exp FROM perfiles ORDER BY exp DESC LIMIT ?', [limite]);
}

async function obtenerRankingCreditos(limite = 10) {
    return await query('SELECT usuario_id, creditos FROM perfiles ORDER BY creditos DESC LIMIT ?', [limite]);
}

// --- CLANES (Básico) ---
async function obtenerClan(clanId) {
    const rows = await query('SELECT * FROM clanes WHERE id = ?', [clanId]);
    return rows[0] || null;
}

// --- MISIONES ---
/**
 * Asegura que el usuario tenga exactamente 3 misiones asignadas para el día de hoy.
 * Si no las tiene, las elige aleatoriamente y las inicializa en la base de datos.
 */
async function asegurarAsignacionMisiones(usuarioId) {
    const hoy = new Date().toISOString().split('T')[0];
    
    // 1. Consultar misiones ya asignadas para hoy
    const asignadas = await query('SELECT mission_id FROM misiones_progreso WHERE usuario_id = ? AND fecha = ?', [usuarioId, hoy]);
    
    if (asignadas.length > 0) {
        // Limpieza de seguridad: Si por un error previo tiene más de 3, nos quedamos solo con las 3 primeras
        if (asignadas.length > 3) {
            const keepers = asignadas.slice(0, 3).map(a => a.mission_id);
            await query('DELETE FROM misiones_progreso WHERE usuario_id = ? AND fecha = ? AND mission_id NOT IN (?, ?, ?)', 
                [usuarioId, hoy, keepers[0], keepers[1], keepers[2]]);
            return keepers;
        }
        return asignadas.map(a => a.mission_id);
    }

    // 2. Si no hay, elegir 3 aleatorias de la lista maestra
    const misionesData = require('../data/misiones.json');
    const elegidas = [];
    const pool = [...misionesData];

    for (let i = 0; i < 3 && pool.length > 0; i++) {
        const index = Math.floor(Math.random() * pool.length);
        elegidas.push(pool.splice(index, 1)[0]);
    }

    // 3. Inicializarlas en la DB
    for (const m of elegidas) {
        await query('INSERT INTO misiones_progreso (usuario_id, mission_id, progreso, completada, fecha) VALUES (?, ?, 0, 0, ?)', 
            [usuarioId, m.id, hoy]);
    }

    return elegidas.map(m => m.id);
}

async function obtenerProgresoMisiones(usuarioId) {
    const misionesData = require('../data/misiones.json');
    const hoy = new Date().toISOString().split('T')[0];
    
    // Asegurar que tenga 3 misiones asignadas
    const IDsAsignadas = await asegurarAsignacionMisiones(usuarioId);
    
    // Consultar progreso solo de esas 3 (Manejo dinámico de placeholders para seguridad)
    const placeholders = IDsAsignadas.map(() => '?').join(',');
    const rows = await query(`SELECT * FROM misiones_progreso WHERE usuario_id = ? AND fecha = ? AND mission_id IN (${placeholders})`, 
        [usuarioId, hoy, ...IDsAsignadas]);
    
    const progresoMap = new Map(rows.map(r => [r.mission_id, r]));

    // Solo devolver las misiones que están en la base de datos para hoy
    return misionesData
        .filter(m => IDsAsignadas.includes(m.id))
        .map(m => {
            const p = progresoMap.get(m.id);
            return {
                ...m,
                progreso: p?.progreso || 0,
                completada: p?.completada === 1
            };
        });
}

async function actualizarMision(usuarioId, tipo, cantidad) {
    const misionesData = require('../data/misiones.json');
    const hoy = new Date().toISOString().split('T')[0];
    
    // Obtener IDs de las 3 misiones asignadas hoy
    const IDsAsignadas = await asegurarAsignacionMisiones(usuarioId);
    
    // Filtrar misiones maestras por tipo Y que estén asignadas hoy
    const misionesInteres = misionesData.filter(m => m.tipo === tipo && IDsAsignadas.includes(m.id));
    const completadasAhora = [];

    for (const m of misionesInteres) {
        // Verificar progreso actual
        const [status] = await query('SELECT * FROM misiones_progreso WHERE usuario_id = ? AND mission_id = ? AND fecha = ?', [usuarioId, m.id, hoy]);
        
        if (!status || status.completada === 1) continue;

        let nuevoProgreso = (status.progreso || 0) + cantidad;
        let seCompleto = 0;

        if (nuevoProgreso >= m.objetivo) {
            seCompleto = 1;
            nuevoProgreso = m.objetivo;
            // Dar recompensas
            await sumarCreditos(usuarioId, null, m.recompensa_cr);
            await sumarExp(usuarioId, null, m.recompensa_xp);
            completadasAhora.push(m);
        }

        await query('UPDATE misiones_progreso SET progreso = ?, completada = ? WHERE usuario_id = ? AND mission_id = ? AND fecha = ?', 
            [nuevoProgreso, seCompleto, usuarioId, m.id, hoy]);
    }

    return completadasAhora;
}

// --- MERCADO P2P ---
async function obtenerMercado(pagina = 0, limite = 10) {
    const offset = pagina * limite;
    return await query('SELECT * FROM mercado ORDER BY id DESC LIMIT ? OFFSET ?', [limite, offset]);
}

async function contarItemsMercado() {
    const rows = await query('SELECT COUNT(*) as total FROM mercado', []);
    return rows[0].total;
}

async function publicarVenta(usuarioId, guildId, instanciaId, precio) {
    const inst = await query('SELECT * FROM inventario WHERE id = ? AND usuario_id = ?', [instanciaId, usuarioId]);
    if (inst.length === 0) return { exito: false, error: "No posees este vehículo." };
    
    await query('INSERT INTO mercado (usuario_id, guild_id, coche_id, inventario_id, precio) VALUES (?, ?, ?, ?, ?)', 
        [usuarioId, guildId, inst[0].coche_id, instanciaId, precio]);
    return { exito: true };
}

async function procesarCompraMercado(compradorId, guildId, mercadoId) {
    const item = await query('SELECT * FROM mercado WHERE id = ?', [mercadoId]);
    if (item.length === 0) return { exito: false, error: "El artículo ya no está disponible." };
    
    const pComprador = await obtenerPerfil(compradorId);
    if (pComprador.creditos < item[0].precio) return { exito: false, error: "Fondos insuficientes." };

    // Transferencia
    await restarCreditos(compradorId, guildId, item[0].precio);
    await sumarCreditos(item[0].usuario_id, guildId, item[0].precio);
    await actualizarMision(compradorId, 'SHOP_SPEND', item[0].precio);
    
    // Cambiar dueño del coche
    await query('UPDATE inventario SET usuario_id = ? WHERE id = ?', [compradorId, item[0].inventario_id]);
    
    // Borrar de mercado
    await query('DELETE FROM mercado WHERE id = ?', [mercadoId]);
    
    return { exito: true, cocheId: item[0].coche_id, precio: item[0].precio };
}

async function obtenerItemMercado(mercadoId) {
    const rows = await query('SELECT * FROM mercado WHERE id = ?', [mercadoId]);
    return rows[0] || null;
}

async function cancelarVenta(usuarioId, mercadoId) {
    await query('DELETE FROM mercado WHERE id = ? AND usuario_id = ?', [mercadoId, usuarioId]);
}

async function procesarContrato(usuarioId, guildId, cocheId) {
    // Eliminar 5 copias
    const [rows] = await pool.execute('SELECT id FROM inventario WHERE usuario_id = ? AND coche_id = ? LIMIT 5', [usuarioId, cocheId]);
    if (rows.length < 5) return { exito: false };
    
    const ids = rows.map(r => r.id);
    await query(`DELETE FROM inventario WHERE id IN (${ids.join(',')})`, []);
    return { exito: true };
}

// --- JACKPOT (Desguace) ---
async function obtenerJackpot() {
    const rows = await query('SELECT value FROM global_stats WHERE `key` = "jackpot"', []);
    return rows.length > 0 ? parseInt(rows[0].value) : 0;
}

async function sumarAlJackpot(cantidad) {
    await query('UPDATE global_stats SET value = CAST(value AS SIGNED) + ? WHERE `key` = "jackpot"', [cantidad]);
}

async function reclamarJackpot() {
    const actual = await obtenerJackpot();
    await query('UPDATE global_stats SET value = "50000" WHERE `key` = "jackpot"', []);
    return actual;
}

// --- OTROS ---
async function quitarCocheGarajeID(instanciaId) {
    await query('DELETE FROM inventario WHERE id = ?', [instanciaId]);
}

async function puedeReclamarDiario(usuarioId) {
    const p = await obtenerPerfil(usuarioId);
    if (!p.ultimo_diario) return { puede: true, restante: 0 };
    
    const ultimo = new Date(p.ultimo_diario).getTime();
    const ahora = Date.now();
    const dif = ahora - ultimo;
    const cooldown = 24 * 60 * 60 * 1000; // 24h
    
    if (dif < cooldown) return { puede: false, restante: cooldown - dif };
    return { puede: true, restante: 0 };
}

async function reclamarDiario(usuarioId, guildId, cantidad) {
    const p = await obtenerPerfil(usuarioId);
    let nuevaRacha = 1;
    
    if (p.ultimo_diario) {
        const ultimo = new Date(p.ultimo_diario).getTime();
        const ahora = Date.now();
        const dif = ahora - ultimo;
        if (dif < 48 * 60 * 60 * 1000) { // Si fue hace menos de 48h, mantiene racha
            nuevaRacha = (p.racha || 0) + 1;
        }
    }
    
    await query('UPDATE perfiles SET creditos = creditos + ?, racha = ?, ultimo_diario = CURRENT_TIMESTAMP WHERE usuario_id = ?', [cantidad, nuevaRacha, usuarioId]);
    
    // XP por diario
    const levelUp = await registrarVictoria(usuarioId); // Usamos registrarVictoria para el levelup y xp base
    
    return { nuevaRacha, levelUp };
}

async function registrarCompraTienda(usuarioId) {
    await query('UPDATE perfiles SET c_hoy = c_hoy + 1, u_compra = CURRENT_TIMESTAMP WHERE usuario_id = ?', [usuarioId]);
}

async function obtenerRankingVictorias(limite = 10) {
    return await query('SELECT usuario_id, victorias, derrotas FROM perfiles ORDER BY victorias DESC LIMIT ?', [limite]);
}

async function obtenerRankingColeccion(limite = 10) {
    // Esta consulta es más pesada, cuenta coches únicos por usuario
    return await query(`
        SELECT usuario_id, COUNT(DISTINCT coche_id) as modelos, GROUP_CONCAT(DISTINCT coche_id) as ids
        FROM inventario 
        GROUP BY usuario_id 
        ORDER BY modelos DESC 
        LIMIT ?`, [limite]);
}

async function obtenerRankingClanes(limite = 10) {
    return await query(`
        SELECT c.nombre, c.tag, COUNT(p.usuario_id) as miembros, SUM(p.exp) as exp_total
        FROM clanes c
        LEFT JOIN perfiles p ON c.id = p.clan_id
        GROUP BY c.id
        ORDER BY exp_total DESC
        LIMIT ?`, [limite]);
}

async function getPosicionPersonal(usuarioId, tipo) {
    let sql = '';
    if (tipo === 'creditos') sql = 'SELECT COUNT(*) + 1 as pos FROM perfiles WHERE creditos > (SELECT creditos FROM perfiles WHERE usuario_id = ?)';
    else if (tipo === 'exp') sql = 'SELECT COUNT(*) + 1 as pos FROM perfiles WHERE exp > (SELECT exp FROM perfiles WHERE usuario_id = ?)';
    else if (tipo === 'victorias') sql = 'SELECT COUNT(*) + 1 as pos FROM perfiles WHERE victorias > (SELECT victorias FROM perfiles WHERE usuario_id = ?)';
    else sql = 'SELECT 1 as pos'; // Default

    const rows = await query(sql, [usuarioId]);
    const totalRows = await query('SELECT COUNT(*) as total FROM perfiles', []);
    
    return { pos: rows[0]?.pos || '?', total: totalRows[0]?.total || '?' };
}

// --- ROLLS ---
async function reclamarRoll(rollId, usuarioId) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Bloquear la fila para evitar race conditions (FOR UPDATE)
        const [rows] = await connection.execute('SELECT * FROM rolls_activos WHERE roll_id = ? FOR UPDATE', [rollId]);
        
        if (rows.length === 0) {
            await connection.rollback();
            return { exito: false, error: "Este roll ya no existe o ya ha sido reclamado." };
        }
        
        const roll = rows[0];
        
        // Verificar si ya lo tenía
        const [invPrevio] = await connection.execute('SELECT COUNT(*) as total FROM inventario WHERE usuario_id = ? AND coche_id = ?', [usuarioId, roll.coche_id]);
        const yaLoTenia = invPrevio[0].total > 0;

        // Añadir al garaje
        const [res] = await connection.execute(
            'INSERT INTO inventario (usuario_id, guild_id, coche_id, reclamado_en) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
            [usuarioId, roll.guild_id, roll.coche_id]
        );

        // Eliminar el roll para que nadie más pueda reclamarlo
        await connection.execute('DELETE FROM rolls_activos WHERE roll_id = ?', [rollId]);
        
        await connection.commit();

        // XP y level up (fuera de la transacción pesada para no bloquear)
        const levelUp = await registrarVictoria(usuarioId);

        return { 
            exito: true, 
            cocheId: roll.coche_id, 
            guildId: roll.guild_id,
            inventarioId: res.insertId,
            yaLoTenia,
            copias: invPrevio[0].total + 1,
            levelUp
        };
    } catch (err) {
        await connection.rollback();
        console.error('❌ [DB ERROR] Error en transacción de reclamarRoll:', err);
        return { exito: false, error: "Error interno al procesar el reclamo." };
    } finally {
        connection.release();
    }
}

// --- CLANES ---
async function crearClan(nombre, tag, liderId) {
    // Verificar si el tag ya existe
    const existTag = await query('SELECT id FROM clanes WHERE tag = ?', [tag]);
    if (existTag.length > 0) return { exito: false, error: "El Tag ya está en uso." };

    const [res] = await pool.execute(
        'INSERT INTO clanes (nombre, tag, lider_id, nivel, exp, privado, fecha_creacion) VALUES (?, ?, ?, 1, 0, 0, CURRENT_TIMESTAMP)',
        [nombre, tag, liderId]
    );
    const clanId = res.insertId;
    await query('UPDATE perfiles SET clan_id = ? WHERE usuario_id = ?', [clanId, liderId]);
    return { exito: true, clanId };
}

async function unirseAClan(usuarioId, clanId) {
    const miembros = await obtenerMiembrosClan(clanId);
    if (miembros.length >= 15) return { exito: false, error: "El clan está lleno (Máx. 15)." };

    await query('UPDATE perfiles SET clan_id = ? WHERE usuario_id = ?', [clanId, usuarioId]);
    return { exito: true };
}

async function abandonarClan(usuarioId) {
    const p = await obtenerPerfil(usuarioId);
    if (!p.clan_id) return;

    const clan = await obtenerClan(p.clan_id);
    if (clan.lider_id === usuarioId) {
        // Disolver clan
        await query('UPDATE perfiles SET clan_id = NULL WHERE clan_id = ?', [p.clan_id]);
        await query('DELETE FROM clanes WHERE id = ?', [p.clan_id]);
        await query('DELETE FROM invitaciones_clanes WHERE clan_id = ?', [p.clan_id]);
    } else {
        await query('UPDATE perfiles SET clan_id = NULL WHERE usuario_id = ?', [usuarioId]);
    }
}

async function obtenerClanPorNombreOTag(busqueda) {
    const rows = await query('SELECT * FROM clanes WHERE tag = ? OR nombre LIKE ?', [busqueda.toUpperCase(), `%${busqueda}%`]);
    return rows[0] || null;
}

async function obtenerMiembrosClan(clanId) {
    return await query('SELECT * FROM perfiles WHERE clan_id = ? ORDER BY exp DESC', [clanId]);
}

async function cambiarEstadoClan(clanId, esPrivado) {
    await query('UPDATE clanes SET privado = ? WHERE id = ?', [esPrivado ? 1 : 0, clanId]);
}

async function crearInvitacion(clanId, usuarioId) {
    const exists = await query('SELECT id FROM invitaciones_clanes WHERE clan_id = ? AND usuario_id = ?', [clanId, usuarioId]);
    if (exists.length > 0) return false;
    await query('INSERT INTO invitaciones_clanes (clan_id, usuario_id) VALUES (?, ?)', [clanId, usuarioId]);
    return true;
}

async function obtenerInvitacion(clanId, usuarioId) {
    const rows = await query('SELECT * FROM invitaciones_clanes WHERE clan_id = ? AND usuario_id = ?', [clanId, usuarioId]);
    return rows[0] || null;
}

async function borrarInvitacion(clanId, usuarioId) {
    await query('DELETE FROM invitaciones_clanes WHERE clan_id = ? AND usuario_id = ?', [clanId, usuarioId]);
}

async function fechaPrimerCoche(usuarioId) {
    const rows = await query('SELECT reclamado_en FROM inventario WHERE usuario_id = ? ORDER BY id ASC LIMIT 1', [usuarioId]);
    return rows[0]?.reclamado_en || null;
}

async function obtenerTotalModelos(usuarioId) {
    const rows = await query('SELECT COUNT(DISTINCT coche_id) as total FROM inventario WHERE usuario_id = ?', [usuarioId]);
    return rows[0]?.total || 0;
}

async function verificarLimiteTienda(usuarioId, maxPacks) {
    const p = await obtenerPerfil(usuarioId);
    // Simple reset diario si u_compra es de otro día (omitido para brevedad, usando c_hoy)
    return { puede: (p.c_hoy || 0) < maxPacks, restantes: maxPacks - (p.c_hoy || 0) }; 
}

// --- EXPORT ---
module.exports = {
    pool,
    inicializarDB,
    reclamarRoll,
    obtenerPerfil,
    sumarCreditos,
    restarCreditos,
    sumarExp,
    sumarPieza,
    sumarExtraRolls,
    añadirCocheGaraje,
    obtenerInventario,
    obtenerVehiculoInstancia,
    setCocheActivo,
    subirMejoraVehiculo,
    registrarFugaResultado,
    obtenerHistorialFuga,
    registrarCarreraResultado,
    verificarLimiteRolls,
    incrementarRolls,
    registrarRoll,
    obtenerUltimosCoches,
    obtenerRankingXP,
    obtenerRankingCreditos,
    obtenerRankingVictorias,
    obtenerRankingColeccion,
    obtenerRankingClanes,
    getPosicionPersonal,
    obtenerClan,
    actualizarMision,
    obtenerMercado,
    contarItemsMercado,
    publicarVenta,
    procesarCompraMercado,
    obtenerJackpot,
    sumarAlJackpot,
    quitarCocheGarajeID,
    verificarLimiteTienda,
    registrarVictoria,
    registrarDerrota,
    transferirCoche,
    obtenerHistorialCarrera,
    obtenerTotalModelos,
    fechaPrimerCoche,
    registrarCompraTienda,
    obtenerItemMercado,
    cancelarVenta,
    procesarContrato,
    puedeReclamarDiario,
    reclamarDiario,
    crearClan,
    unirseAClan,
    abandonarClan,
    obtenerClanPorNombreOTag,
    obtenerMiembrosClan,
    cambiarEstadoClan,
    crearInvitacion,
    obtenerInvitacion,
    borrarInvitacion,
    obtenerProgresoMisiones
};
