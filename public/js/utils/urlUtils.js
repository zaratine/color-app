// Utils - Funções utilitárias para manipulação de URL

/**
 * Obtém parâmetros da URL atual
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
 * @returns {string|null} Nome da categoria ou null se não existir
 */
export function getCategoryFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('cat');
}

/**
 * Obtém o nome do desenho da URL
 * @returns {string|null} Nome do desenho ou null se não existir
 */
export function getDrawingFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('drawing');
}

/**
 * Cria uma URL para uma categoria
 * @param {string} categoryName - Nome da categoria
 * @returns {string} URL formatada
 */
export function getCategoryUrl(categoryName) {
    return `/category?cat=${encodeURIComponent(categoryName)}`;
}

/**
 * Cria uma URL para um desenho na página de pintura
 * @param {string} categoryName - Nome da categoria
 * @param {string} drawingName - Nome do desenho
 * @param {string|null} imageUrl - URL completa da imagem (opcional, para S3)
 * @returns {string} URL formatada
 */
export function getPaintUrl(categoryName, drawingName, imageUrl = null) {
    let url = `/paint?cat=${encodeURIComponent(categoryName)}&drawing=${encodeURIComponent(drawingName)}`;
    if (imageUrl) {
        url += `&url=${encodeURIComponent(imageUrl)}`;
    }
    return url;
}

/**
 * Obtém a URL completa da imagem da URL atual (se fornecida)
 * @returns {string|null} URL completa da imagem ou null se não existir
 */
export function getImageUrlFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('url');
}

