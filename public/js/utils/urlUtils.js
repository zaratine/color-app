// Utils - Funções utilitárias para manipulação de URL

/**
 * Converte um nome de arquivo para slug
 * @param {string} filename - Nome do arquivo (ex: "Pirate_Ship.png")
 * @returns {string} Slug (ex: "pirate-ship")
 */
export function filenameToSlug(filename) {
    if (!filename) return '';
    
    // Remover extensão
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    
    // Substituir underscores por hífens e converter para minúsculas
    return nameWithoutExt
        .replace(/_/g, '-')
        .toLowerCase()
        .trim();
}

/**
 * Obtém parâmetros da URL atual (compatibilidade com formato antigo)
 * @returns {Object} Objeto com os parâmetros da URL
 */
export function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        cat: params.get('cat'),
        drawing: params.get('drawing')
    };
}

/**
 * Obtém o nome da categoria da URL
 * Suporta tanto o formato antigo (?cat=...) quanto o novo (/en/:category ou /en/paint/:category/:drawing)
 * @returns {string|null} Nome da categoria ou null se não existir
 */
export function getCategoryFromUrl() {
    const path = window.location.pathname;
    
    // Tentar novo formato: /en/paint/:category/:drawing
    const paintMatch = path.match(/^\/en\/paint\/([^\/]+)/);
    if (paintMatch) {
        return decodeURIComponent(paintMatch[1]);
    }
    
    // Tentar novo formato: /en/:category (mas não /en/paint)
    const categoryMatch = path.match(/^\/en\/([^\/]+)$/);
    if (categoryMatch) {
        return decodeURIComponent(categoryMatch[1]);
    }
    
    // Fallback para formato antigo: ?cat=...
    const params = new URLSearchParams(window.location.search);
    return params.get('cat');
}

/**
 * Obtém o slug do desenho da URL
 * Suporta tanto o formato antigo (?drawing=...) quanto o novo (/en/paint/:category/:drawing)
 * @returns {string|null} Slug do desenho ou null se não existir
 */
export function getDrawingFromUrl() {
    const path = window.location.pathname;
    
    // Tentar novo formato: /en/paint/:category/:drawing
    const newFormatMatch = path.match(/^\/en\/paint\/[^\/]+\/([^\/]+)/);
    if (newFormatMatch) {
        return decodeURIComponent(newFormatMatch[1]);
    }
    
    // Fallback para formato antigo: ?drawing=...
    const params = new URLSearchParams(window.location.search);
    return params.get('drawing');
}

/**
 * Cria uma URL para uma categoria (novo formato amigável)
 * @param {string} categoryName - Nome da categoria
 * @returns {string} URL formatada
 */
export function getCategoryUrl(categoryName) {
    if (!categoryName) return '/';
    return `/en/${encodeURIComponent(categoryName.toLowerCase().trim())}`;
}

/**
 * Cria uma URL para um desenho na página de pintura (novo formato amigável)
 * @param {string} categoryName - Nome da categoria
 * @param {string} drawingName - Nome do desenho (será convertido para slug)
 * @param {string|null} imageUrl - URL completa da imagem (opcional, não usado no novo formato)
 * @returns {string} URL formatada
 */
export function getPaintUrl(categoryName, drawingName, imageUrl = null) {
    if (!categoryName || !drawingName) return '/';
    
    const slug = filenameToSlug(drawingName);
    const normalizedCategory = categoryName.toLowerCase().trim();
    
    return `/en/paint/${encodeURIComponent(normalizedCategory)}/${encodeURIComponent(slug)}`;
}

/**
 * Obtém a URL completa da imagem da URL atual (se fornecida)
 * @returns {string|null} URL completa da imagem ou null se não existir
 */
export function getImageUrlFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('url');
}

/**
 * Verifica se uma URL é do S3
 * @param {string} url - URL para verificar
 * @returns {boolean} true se a URL for do S3
 */
export function isS3Url(url) {
    if (!url) return false;
    return url.includes('.s3.') && url.includes('.amazonaws.com');
}

/**
 * Converte uma URL do S3 em uma URL do proxy do servidor
 * @param {string} s3Url - URL do S3
 * @returns {string} URL do proxy
 */
export function getProxyUrl(s3Url) {
    if (!isS3Url(s3Url)) return s3Url;
    return `/api/proxy-image?url=${encodeURIComponent(s3Url)}`;
}

/**
 * Busca um desenho no banco de dados usando slug e categoria
 * @param {string} slug - Slug do desenho (ex: "pirate-ship")
 * @param {string} category - Categoria (ex: "twins")
 * @returns {Promise<Object|null>} Objeto com informações do desenho ou null se não encontrado
 */
export async function getDrawingBySlug(slug, category) {
    if (!slug || !category) {
        return null;
    }
    
    try {
        // Importar dinamicamente para evitar dependência circular
        const { getDrawingsDatabase, getDrawingsInCategory } = await import('../services/drawingsService.js');
        
        // Obter desenhos da categoria
        const drawings = await getDrawingsInCategory(category);
        
        if (!drawings || drawings.length === 0) {
            return null;
        }
        
        // Buscar desenho que corresponde ao slug
        const normalizedSlug = slug.toLowerCase().trim();
        
        for (const drawing of drawings) {
            // Obter nome do arquivo
            let filename;
            if (typeof drawing === 'string') {
                filename = drawing;
            } else if (typeof drawing === 'object') {
                filename = drawing.filename || drawing;
            } else {
                continue;
            }
            
            // Converter para slug e comparar
            const drawingSlug = filenameToSlug(filename);
            if (drawingSlug === normalizedSlug) {
                return drawing;
            }
        }
        
        return null;
    } catch (error) {
        console.error('Erro ao buscar desenho por slug:', error);
        return null;
    }
}

