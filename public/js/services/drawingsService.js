// Service - Gerenciamento de estado e cache dos desenhos

import { fetchDrawings } from '../api/drawingsApi.js';

// Cache único compartilhado entre todos os componentes
let drawingsDatabase = null;
let isLoading = false;
let loadPromise = null;

/**
 * Carrega os desenhos da API e armazena em cache
 * @returns {Promise<boolean>} true se carregou com sucesso, false caso contrário
 */
export async function loadDrawingsDatabase() {
    // Se já está carregando, retornar a mesma promise
    if (isLoading && loadPromise) {
        return loadPromise;
    }

    // Se já está em cache, retornar imediatamente
    if (drawingsDatabase !== null) {
        return Promise.resolve(true);
    }

    // Iniciar carregamento
    isLoading = true;
    loadPromise = (async () => {
        try {
            drawingsDatabase = await fetchDrawings();
            return true;
        } catch (error) {
            console.error('Erro ao carregar desenhos:', error);
            return false;
        } finally {
            isLoading = false;
            loadPromise = null;
        }
    })();

    return loadPromise;
}

/**
 * Obtém o banco de dados de desenhos (do cache ou carrega se necessário)
 * @returns {Promise<Object>} Objeto com as categorias e desenhos
 */
export async function getDrawingsDatabase() {
    if (drawingsDatabase === null) {
        await loadDrawingsDatabase();
    }
    return drawingsDatabase || {};
}

/**
 * Obtém lista de desenhos em uma categoria específica
 * @param {string} categoryName - Nome da categoria
 * @returns {Promise<Array>} Array com os desenhos (pode ser strings ou objetos {filename, url})
 */
export async function getDrawingsInCategory(categoryName) {
    const database = await getDrawingsDatabase();
    
    if (database[categoryName]) {
        return database[categoryName].drawings || [];
    }
    return [];
}

/**
 * Obtém o nome do arquivo de um desenho (suporta string ou objeto)
 * @param {string|Object} drawing - Desenho (string ou objeto {filename, url})
 * @returns {string} Nome do arquivo
 */
export function getDrawingFilename(drawing) {
    if (typeof drawing === 'string') {
        return drawing;
    }
    return drawing.filename || drawing;
}

/**
 * Obtém a URL de um desenho (retorna URL do S3 se disponível, senão retorna null)
 * @param {string|Object} drawing - Desenho (string ou objeto {filename, url})
 * @returns {string|null} URL do desenho ou null se não houver
 */
export function getDrawingUrl(drawing) {
    if (typeof drawing === 'object' && drawing.url) {
        return drawing.url;
    }
    return null;
}

/**
 * Obtém a URL do thumbnail de um desenho
 * @param {string|Object} drawing - Desenho (string ou objeto {filename, url, thumbnailUrl})
 * @param {string} categoryName - Nome da categoria (opcional, necessário para filesystem)
 * @returns {string} URL do thumbnail ou URL da imagem original como fallback
 */
export function getThumbnailUrl(drawing, categoryName = null) {
    // Se for objeto e tiver thumbnailUrl, usar diretamente
    if (typeof drawing === 'object' && drawing.thumbnailUrl) {
        return drawing.thumbnailUrl;
    }
    
    // Se for objeto com URL do S3, construir URL do thumbnail
    if (typeof drawing === 'object' && drawing.url) {
        const url = drawing.url;
        // Se for URL do S3, construir URL do thumbnail
        if (url.includes('.s3.') && url.includes('.amazonaws.com')) {
            // Extrair nome do arquivo da URL
            const urlParts = url.split('/');
            const filename = urlParts[urlParts.length - 1];
            const thumbnailFilename = `thumb_${filename}`;
            // Substituir o nome do arquivo na URL
            const thumbnailUrl = url.replace(filename, thumbnailFilename);
            return `/api/thumbnail?url=${encodeURIComponent(url)}`;
        }
    }
    
    // Para filesystem, construir caminho do thumbnail
    if (typeof drawing === 'string' || (typeof drawing === 'object' && drawing.filename)) {
        const filename = typeof drawing === 'string' ? drawing : drawing.filename;
        const thumbnailFilename = `thumb_${filename}`;
        if (categoryName) {
            return `drawings/${categoryName}/${thumbnailFilename}`;
        }
        return `drawings/customizados/${thumbnailFilename}`;
    }
    
    // Fallback: retornar URL original se disponível
    return getDrawingUrl(drawing) || '';
}

/**
 * Obtém dados de uma categoria específica
 * @param {string} categoryName - Nome da categoria
 * @returns {Promise<Object|null>} Dados da categoria ou null se não existir
 */
export async function getCategoryData(categoryName) {
    const database = await getDrawingsDatabase();
    return database[categoryName] || null;
}

/**
 * Obtém todas as categorias disponíveis
 * @returns {Promise<Array>} Array de objetos {name, displayName, drawings, source}
 */
export async function getAllCategories() {
    const database = await getDrawingsDatabase();
    return Object.entries(database).map(([name, data]) => ({
        name,
        displayName: data.displayName,
        drawings: data.drawings || [],
        source: data.source || 'filesystem'
    }));
}

/**
 * Limpa o cache (útil para forçar recarregamento)
 */
export function clearCache() {
    drawingsDatabase = null;
    isLoading = false;
    loadPromise = null;
}

