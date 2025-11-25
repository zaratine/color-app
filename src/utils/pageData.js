// Utilitários para preparar dados de página para templates EJS
const { getDrawingsDatabase } = require('../services/drawingsService');
const { formatDisplayName } = require('./stringUtils');
const { filenameToSlug, getDrawingBySlug, normalizeCategory } = require('./urlMapping');

/**
 * Converte slug para nome amigável
 * @param {string} slug - Slug (ex: "dog-skating")
 * @returns {string} Nome amigável (ex: "Dog Skating")
 */
function formatFriendlyName(slug) {
    if (!slug) return '';
    
    // Converter slug para nome amigável
    let friendlyName = slug.replace(/-/g, ' ');
    
    // Remover números ao final (ex: "astronaut-floating-1763922380549" -> "astronaut floating")
    friendlyName = friendlyName.replace(/[\s_-]+\d+$/, '');
    
    // Capitalizar primeira letra de cada palavra
    return formatDisplayName(friendlyName);
}

/**
 * Busca dados de uma categoria
 * @param {string} categorySlug - Slug da categoria (ex: "animals")
 * @returns {Promise<Object|null>} Dados da categoria ou null se não encontrada
 */
async function getCategoryPageData(categorySlug) {
    if (!categorySlug) return null;
    
    try {
        const database = await getDrawingsDatabase();
        const normalizedCategory = normalizeCategory(categorySlug);
        
        const categoryData = database[normalizedCategory];
        if (!categoryData) {
            return null;
        }
        
        const friendlyName = categoryData.displayName || formatDisplayName(categorySlug);
        
        return {
            slug: normalizedCategory,
            friendlyName: friendlyName,
            displayName: friendlyName,
            drawingsCount: categoryData.drawings ? categoryData.drawings.length : 0
        };
    } catch (error) {
        console.error('Erro ao buscar dados da categoria:', error);
        return null;
    }
}

/**
 * Busca dados de um desenho específico
 * @param {string} categorySlug - Slug da categoria
 * @param {string} drawingSlug - Slug do desenho
 * @returns {Promise<Object|null>} Dados do desenho ou null se não encontrado
 */
async function getDrawingPageData(categorySlug, drawingSlug) {
    if (!categorySlug || !drawingSlug) return null;
    
    try {
        const database = await getDrawingsDatabase();
        const drawingData = getDrawingBySlug(drawingSlug, categorySlug, database);
        
        if (!drawingData) {
            return null;
        }
        
        const friendlyName = formatFriendlyName(drawingSlug);
        const categoryFriendlyName = formatDisplayName(categorySlug);
        
        return {
            slug: drawingSlug,
            friendlyName: friendlyName,
            filename: drawingData.filename,
            category: {
                slug: categorySlug,
                friendlyName: categoryFriendlyName
            },
            drawing: drawingData.drawing
        };
    } catch (error) {
        console.error('Erro ao buscar dados do desenho:', error);
        return null;
    }
}

/**
 * Gera objeto com meta tags para uma página
 * @param {Object} options - Opções para gerar meta tags
 * @param {string} options.title - Título da página
 * @param {string} options.description - Descrição da página
 * @param {string} options.url - URL canônica
 * @param {string} options.ogImage - URL da imagem Open Graph (opcional)
 * @returns {Object} Objeto com meta tags
 */
function generateMetaTags({ title, description, url, ogImage = null }) {
    return {
        title: title || 'Free Coloring Pages for Kids',
        description: description || 'Free coloring pages for kids! Print or Color Online.',
        ogTitle: title || 'Free Coloring Pages for Kids',
        ogDescription: description || 'Free coloring pages for kids! Print or Color Online.',
        canonical: url || '',
        ogImage: ogImage || null
    };
}

/**
 * Gera meta tags para página de categoria
 * @param {Object} categoryData - Dados da categoria
 * @param {string} baseUrl - URL base do site
 * @returns {Object} Objeto com meta tags
 */
function generateCategoryMetaTags(categoryData, baseUrl) {
    if (!categoryData) {
        return generateMetaTags({
            title: 'Free Coloring Pages for Kids',
            description: 'Free coloring pages for kids! Print or Color Online.',
            url: baseUrl
        });
    }
    
    const categoryName = categoryData.friendlyName.toLowerCase();
    const title = `Free ${categoryData.friendlyName} Coloring Pages – Print or Color Online`;
    const description = `Free ${categoryName} coloring pages for kids! Print or Color Online. Explore our collection of ${categoryName} coloring pages. High-resolution drawings ready to color.`;
    const url = `${baseUrl}/en/${encodeURIComponent(categoryData.slug)}`;
    
    return generateMetaTags({
        title,
        description,
        url
    });
}

/**
 * Gera meta tags para página de desenho
 * @param {Object} drawingData - Dados do desenho
 * @param {string} baseUrl - URL base do site
 * @returns {Object} Objeto com meta tags
 */
function generateDrawingMetaTags(drawingData, baseUrl) {
    if (!drawingData) {
        return generateMetaTags({
            title: 'Free Coloring Pages for Kids',
            description: 'Free coloring pages for kids! Print or Color Online.',
            url: baseUrl
        });
    }
    
    const drawingName = drawingData.friendlyName.toLowerCase();
    const title = `${drawingData.friendlyName} Coloring Page – Print or Color Online`;
    const description = `Color online or download a free ${drawingName} coloring page for kids. High-resolution drawing ready to print or color online. Fun and easy activity for children between 2 and 6 years old.`;
    const url = `${baseUrl}/en/${encodeURIComponent(drawingData.category.slug)}/${encodeURIComponent(drawingData.slug)}`;
    
    return generateMetaTags({
        title,
        description,
        url
    });
}

module.exports = {
    formatFriendlyName,
    getCategoryPageData,
    getDrawingPageData,
    generateMetaTags,
    generateCategoryMetaTags,
    generateDrawingMetaTags
};

