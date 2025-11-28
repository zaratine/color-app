// Utilitários para preparar dados de página para templates EJS
const { getDrawingsDatabase } = require('../services/drawingsService');
const { formatDisplayName } = require('./stringUtils');
const { filenameToSlug, getDrawingBySlug, normalizeCategory } = require('./urlMapping');
const { config } = require('../config');

// Constantes de SEO
const BASE_URL = config.BASE_URL || 'https://www.printorcolor.com';
const SITE_NAME = config.SITE_NAME || 'Print or Color';
const IMAGE_WIDTH = config.IMAGE_WIDTH || 1536;
const IMAGE_HEIGHT = config.IMAGE_HEIGHT || 1024;

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
 * Obtém URL da imagem original de um desenho
 * @param {Object} drawing - Objeto drawing do database
 * @returns {string|null} URL da imagem original ou null
 */
function getOriginalImageUrl(drawing) {
    if (!drawing) return null;
    
    // Desenho pode ser string (filename) ou objeto {filename, url}
    if (typeof drawing === 'string') {
        // Para arquivos locais, retornar null (não temos URL completa)
        return null;
    } else if (drawing && typeof drawing === 'object' && drawing.url) {
        // Para S3, temos URL completa
        return drawing.url;
    }
    
    return null;
}

/**
 * Gera objeto com meta tags para uma página
 * @param {Object} options - Opções para gerar meta tags
 * @param {string} options.title - Título da página
 * @param {string} options.description - Descrição da página
 * @param {string} options.url - URL canônica
 * @param {string} options.ogImage - URL da imagem Open Graph (opcional)
 * @param {string} options.ogImageAlt - Texto alternativo da imagem (opcional)
 * @returns {Object} Objeto com meta tags
 */
function generateMetaTags({ title, description, url, ogImage = null, ogImageAlt = null }) {
    return {
        title: title || 'Free Coloring Pages for Kids',
        description: description || 'Free coloring pages for kids! Print or Color Online.',
        ogTitle: title || 'Free Coloring Pages for Kids',
        ogDescription: description || 'Free coloring pages for kids! Print or Color Online.',
        canonical: url || '',
        ogUrl: url || '',
        ogImage: ogImage || null,
        ogImageAlt: ogImageAlt || 'Coloring page for kids',
        ogImageWidth: ogImage ? IMAGE_WIDTH : null,
        ogImageHeight: ogImage ? IMAGE_HEIGHT : null,
        ogSiteName: SITE_NAME,
        ogLocale: 'en_US',
        ogType: 'website',
        twitterCard: 'summary_large_image',
        twitterTitle: title || 'Free Coloring Pages for Kids',
        twitterDescription: description || 'Free coloring pages for kids! Print or Color Online.',
        twitterImage: ogImage || null
    };
}

/**
 * Gera meta tags para página de categoria
 * @param {Object} categoryData - Dados da categoria
 * @param {string} baseUrl - URL base do site
 * @param {Object} database - Database completo (opcional, para buscar primeira imagem)
 * @returns {Object} Objeto com meta tags
 */
async function generateCategoryMetaTags(categoryData, baseUrl = BASE_URL, database = null) {
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
    const ogImageAlt = `${categoryData.friendlyName} coloring pages collection`;
    
    // Buscar primeira imagem da categoria
    let ogImage = null;
    if (database && database[categoryData.slug] && database[categoryData.slug].drawings && database[categoryData.slug].drawings.length > 0) {
        const firstDrawing = database[categoryData.slug].drawings[0];
        ogImage = getOriginalImageUrl(firstDrawing);
    }
    
    return generateMetaTags({
        title,
        description,
        url,
        ogImage,
        ogImageAlt
    });
}

/**
 * Gera meta tags para página de desenho
 * @param {Object} drawingData - Dados do desenho
 * @param {string} baseUrl - URL base do site
 * @returns {Object} Objeto com meta tags
 */
function generateDrawingMetaTags(drawingData, baseUrl = BASE_URL) {
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
    const ogImage = drawingData.drawing ? getOriginalImageUrl(drawingData.drawing) : null;
    const ogImageAlt = `${drawingData.friendlyName} coloring page`;
    
    return generateMetaTags({
        title,
        description,
        url,
        ogImage,
        ogImageAlt
    });
}

/**
 * Gera JSON-LD para página de desenho individual
 * @param {Object} drawingData - Dados do desenho
 * @param {string} baseUrl - URL base do site
 * @returns {Array} Array de objetos JSON-LD
 */
function generateDrawingJsonLd(drawingData, baseUrl = BASE_URL) {
    if (!drawingData) return [];
    
    const schemas = [];
    const drawingUrl = `${baseUrl}/en/${encodeURIComponent(drawingData.category.slug)}/${encodeURIComponent(drawingData.slug)}`;
    const imageUrl = drawingData.drawing ? getOriginalImageUrl(drawingData.drawing) : null;
    
    // ImageObject Schema
    if (imageUrl) {
        schemas.push({
            '@context': 'https://schema.org',
            '@type': 'ImageObject',
            name: `${drawingData.friendlyName} Coloring Page for Kids`,
            description: `Free printable ${drawingData.friendlyName.toLowerCase()} coloring page for kids.`,
            contentUrl: imageUrl,
            url: drawingUrl,
            thumbnailUrl: imageUrl,
            fileFormat: 'image/png',
            width: IMAGE_WIDTH,
            height: IMAGE_HEIGHT,
            creator: {
                '@type': 'Organization',
                name: SITE_NAME
            }
        });
    }
    
    // BreadcrumbList Schema
    schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: baseUrl
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: drawingData.category.friendlyName,
                item: `${baseUrl}/en/${encodeURIComponent(drawingData.category.slug)}`
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: drawingData.friendlyName,
                item: drawingUrl
            }
        ]
    });
    
    return schemas;
}

/**
 * Gera JSON-LD para página de categoria
 * @param {Object} categoryData - Dados da categoria
 * @param {string} baseUrl - URL base do site
 * @param {Object} database - Database completo (para listar desenhos)
 * @returns {Array} Array de objetos JSON-LD
 */
function generateCategoryJsonLd(categoryData, baseUrl = BASE_URL, database = null) {
    if (!categoryData) return [];
    
    const schemas = [];
    const categoryUrl = `${baseUrl}/en/${encodeURIComponent(categoryData.slug)}`;
    
    // CollectionPage Schema
    const collectionPage = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${categoryData.friendlyName} Coloring Pages`,
        description: `Free ${categoryData.friendlyName.toLowerCase()} coloring pages for kids to print or color online.`,
        url: categoryUrl
    };
    schemas.push(collectionPage);
    
    // ItemList Schema (lista de desenhos da categoria)
    if (database && database[categoryData.slug] && database[categoryData.slug].drawings) {
        const drawings = database[categoryData.slug].drawings;
        const itemListElements = drawings.slice(0, 20).map((drawing, index) => {
            let filename, url;
            if (typeof drawing === 'string') {
                filename = drawing;
                url = null;
            } else {
                filename = drawing.filename;
                url = drawing.url;
            }
            
            const drawingSlug = filenameToSlug(filename);
            const drawingUrl = `${baseUrl}/en/${encodeURIComponent(categoryData.slug)}/${encodeURIComponent(drawingSlug)}`;
            const drawingName = formatFriendlyName(drawingSlug);
            
            return {
                '@type': 'ListItem',
                position: index + 1,
                name: drawingName,
                url: drawingUrl,
                image: url || undefined
            };
        });
        
        schemas.push({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: itemListElements
        });
    }
    
    // BreadcrumbList Schema
    schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: baseUrl
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: categoryData.friendlyName,
                item: categoryUrl
            }
        ]
    });
    
    return schemas;
}

/**
 * Gera JSON-LD para página home
 * @param {string} baseUrl - URL base do site
 * @param {Object} database - Database completo (para listar categorias)
 * @returns {Array} Array de objetos JSON-LD
 */
function generateHomeJsonLd(baseUrl = BASE_URL, database = null) {
    const schemas = [];
    
    // WebSite Schema (sem SearchAction, pois o site não tem funcionalidade de busca)
    schemas.push({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: baseUrl,
        description: 'Free coloring pages for kids! Print or Color Online. Explore animals, nature, characters, food, and more. Use our AI-powered drawing generator to create custom coloring pages.'
    });
    
    // ItemList Schema (lista de categorias)
    if (database) {
        const categories = Object.keys(database).slice(0, 20);
        const itemListElements = categories.map((categorySlug, index) => {
            const categoryData = database[categorySlug];
            const categoryName = categoryData.displayName || formatDisplayName(categorySlug);
            const categoryUrl = `${baseUrl}/en/${encodeURIComponent(categorySlug)}`;
            
            return {
                '@type': 'ListItem',
                position: index + 1,
                name: categoryName,
                url: categoryUrl
            };
        });
        
        schemas.push({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: itemListElements
        });
    }
    
    return schemas;
}

module.exports = {
    formatFriendlyName,
    getCategoryPageData,
    getDrawingPageData,
    generateMetaTags,
    generateCategoryMetaTags,
    generateDrawingMetaTags,
    generateDrawingJsonLd,
    generateCategoryJsonLd,
    generateHomeJsonLd,
    getOriginalImageUrl
};

