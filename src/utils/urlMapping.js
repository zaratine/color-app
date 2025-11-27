// Utilitários para mapeamento dinâmico de URLs amigáveis
// Baseado nas pastas e arquivos do S3

/**
 * Converte um nome de arquivo para slug
 * @param {string} filename - Nome do arquivo (ex: "Pirate_Ship.png")
 * @returns {string} Slug (ex: "pirate-ship")
 */
function filenameToSlug(filename) {
    if (!filename) return '';
    
    // Remover extensão
    let nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    
    // Remover números ao final (ex: "Astronaut Floating 1763922380549" -> "Astronaut Floating")
    // Remove espaços/hífens/underscores seguidos de números no final
    nameWithoutExt = nameWithoutExt.replace(/[\s_-]+\d+$/, '');
    
    // Substituir underscores por hífens e converter para minúsculas
    return nameWithoutExt
        .replace(/_/g, '-')
        .toLowerCase()
        .trim();
}

/**
 * Normaliza o nome de uma categoria
 * @param {string} category - Nome da categoria
 * @returns {string} Categoria normalizada (minúsculas, trim)
 */
function normalizeCategory(category) {
    if (!category) return '';
    return category.toLowerCase().trim();
}

/**
 * Detecta se um slug tem formato antigo (com timestamp)
 * @param {string} slug - Slug a verificar (ex: "baker_decorating_cake_1763922631529")
 * @returns {boolean} true se o slug tem formato antigo
 */
function hasOldSlugFormat(slug) {
    if (!slug) return false;
    // Verifica se termina com underscore ou hífen seguido de números (timestamp)
    return /[_-]\d+$/.test(slug);
}

/**
 * Normaliza um slug antigo removendo o timestamp e convertendo para o formato correto
 * @param {string} slug - Slug antigo (ex: "baker_decorating_cake_1763922631529")
 * @returns {string} Slug normalizado (ex: "baker-decorating-cake")
 */
function normalizeOldSlug(slug) {
    if (!slug) return '';
    
    // Remover números ao final (timestamp) - mesma lógica de filenameToSlug
    let normalized = slug.replace(/[\s_-]+\d+$/, '');
    
    // Substituir underscores por hífens e converter para minúsculas
    normalized = normalized
        .replace(/_/g, '-')
        .toLowerCase()
        .trim();
    
    return normalized;
}

/**
 * Constrói mapeamento dinâmico de slugs para desenhos
 * @param {Object} drawingsDatabase - Banco de dados de desenhos (formato: {category: {drawings: [...]}})
 * @returns {Object} Mapeamento {category: {slug: {category, filename, url}}}
 */
function buildSlugMapping(drawingsDatabase) {
    const mapping = {};
    
    if (!drawingsDatabase || typeof drawingsDatabase !== 'object') {
        return mapping;
    }
    
    // Iterar sobre cada categoria
    for (const [category, categoryData] of Object.entries(drawingsDatabase)) {
        const normalizedCategory = normalizeCategory(category);
        
        if (!categoryData || !Array.isArray(categoryData.drawings)) {
            continue;
        }
        
        // Inicializar mapeamento da categoria se não existir
        if (!mapping[normalizedCategory]) {
            mapping[normalizedCategory] = {};
        }
        
        // Para cada desenho na categoria, criar entrada no mapeamento
        for (const drawing of categoryData.drawings) {
            // Obter nome do arquivo (pode ser string ou objeto)
            let filename;
            let url = null;
            
            if (typeof drawing === 'string') {
                filename = drawing;
            } else if (typeof drawing === 'object') {
                filename = drawing.filename || drawing;
                url = drawing.url || null;
            } else {
                continue;
            }
            
            // Converter para slug
            const slug = filenameToSlug(filename);
            
            if (slug) {
                // Armazenar no mapeamento
                mapping[normalizedCategory][slug] = {
                    category: normalizedCategory,
                    filename: filename,
                    url: url,
                    drawing: drawing // Manter referência ao objeto original
                };
            }
        }
    }
    
    return mapping;
}

/**
 * Busca um desenho usando slug e categoria
 * @param {string} slug - Slug do desenho (ex: "pirate-ship")
 * @param {string} category - Categoria (ex: "twins")
 * @param {Object} drawingsDatabase - Banco de dados de desenhos
 * @returns {Object|null} Objeto com informações do desenho ou null se não encontrado
 */
function getDrawingBySlug(slug, category, drawingsDatabase) {
    if (!slug || !category || !drawingsDatabase) {
        return null;
    }
    
    const normalizedCategory = normalizeCategory(category);
    const normalizedSlug = slug.toLowerCase().trim();
    
    // Construir mapeamento
    const mapping = buildSlugMapping(drawingsDatabase);
    
    // Buscar no mapeamento
    if (mapping[normalizedCategory] && mapping[normalizedCategory][normalizedSlug]) {
        return mapping[normalizedCategory][normalizedSlug];
    }
    
    return null;
}

module.exports = {
    filenameToSlug,
    normalizeCategory,
    buildSlugMapping,
    getDrawingBySlug,
    hasOldSlugFormat,
    normalizeOldSlug
};

