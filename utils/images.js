
const { AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

/**
 * Procesa la imagen de un coche (MODO 100% LOCAL).
 * Todas las imágenes se sirven desde la carpeta assets/coches/.
 * @param {Object} coche Objeto del coche de coches.json
 * @returns {Object} Objeto con { url, files } para usar en el embed
 */
function getCarImage(coche) {
    if (!coche || !coche.url_imagen) {
        return { url: null, files: [] };
    }

    // --- MODO URL (OPTIMIZADO) ---
    // Si la imagen ya es un enlace (Imgur, GitHub, etc), la enviamos directamente.
    // Esto elimina el lag de subida del bot.
    if (coche.url_imagen.startsWith('http')) {
        return { url: coche.url_imagen, files: [] };
    }

    try {
        let fullPath = path.resolve(process.cwd(), coche.url_imagen);

        // --- LOGICA DE TOLERANCIA A EXTENSIONES ---
        if (!fs.existsSync(fullPath)) {
            const dir = path.dirname(fullPath);
            const ext = path.extname(fullPath);
            const base = path.basename(fullPath, ext);

            const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
            for (const newExt of extensions) {
                const tryPath = path.join(dir, base + newExt);
                if (fs.existsSync(tryPath)) {
                    fullPath = tryPath;
                    break;
                }
            }
        }
        // ------------------------------------------

        if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            const sizeMB = stats.size / (1024 * 1024);

            if (sizeMB > 8) {
                console.warn(`[IMAGE] ⚠️ El archivo ${fullPath} es demasiado grande (${sizeMB.toFixed(2)}MB).`);
                return { url: null, files: [] };
            }

            const fileName = path.basename(fullPath);
            const attachment = new AttachmentBuilder(fullPath, { name: fileName });

            return {
                url: `attachment://${fileName}`,
                files: [attachment]
            };
        } else {
            console.error(`⚠️ Imagen no encontrada en disco: ${coche.url_imagen} (ID: ${coche.id})`);
        }
    } catch (error) {
        console.error(`❌ Error al procesar imagen local para ID ${coche.id}:`, error);
    }

    return { url: null, files: [] };
}

// ACELERADOR CDN (jsDelivr): Hace que las imágenes carguen a la velocidad de la luz
const constants = require('./constants');
const BASE_ASSETS_URL = constants.BASE_ASSETS_URL || 'https://cdn.jsdelivr.net/gh/BonnySensual99/CARDEX@main/assets/icons/';
const JSDELIVR_BASE_URL = BASE_ASSETS_URL.replace('assets/icons/', '');

/**
 * Obtiene el icono de categoría (Tier) desde assets/icons/.
 * @param {number} rareza Nivel de rareza (1-7)
 * @returns {Object} { url, files }
 */
function getTierIcon(rarezaLevel) {
    const { RAREZA } = require('./constants');
    const tier = RAREZA[rarezaLevel];
    if (!tier || !tier.asset) return { url: null, files: [] };

    // Preferir URL del CDN para evitar lag de subida
    return {
        url: `${JSDELIVR_BASE_URL}assets/icons/${tier.asset}`,
        files: []
    };
}

/**
 * Obtiene la imagen de portada del Hub central.
 * @returns {Object} { url, files }
 */
function getHubImage() {
    // Usar CDN directamente para máxima velocidad
    return {
        url: `${JSDELIVR_BASE_URL}assets/hub_cardex.webp`,
        files: []
    };
}

/**
 * Obtiene la imagen del desguace nocturno.
 * @returns {Object} { url, files }
 */
function getDesguaceImage() {
    return {
        url: `${JSDELIVR_BASE_URL}assets/desguace.webp`,
        files: []
    };
}

/**
 * Obtiene imágenes de estados de Fuga.
 * @param {string} estado 'active', 'arrest', 'success'
 * @returns {Object} { url, files }
 */
function getFugaImage(estado) {
    const mapping = {
        'active': 'active.webp',
        'arrest': 'arrest.webp',
        'success': 'success.webp'
    };
    const file = mapping[estado] || 'active.png';
    return {
        url: `${JSDELIVR_BASE_URL}assets/fuga/${file}`,
        files: []
    };
}

module.exports = { getCarImage, getTierIcon, getHubImage, getDesguaceImage, getFugaImage };
