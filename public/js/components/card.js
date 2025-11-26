// Components - Card reutilizável para categorias e desenhos

import { getThumbnailUrl, getDrawingUrl } from '../services/drawingsService.js';
import { isS3Url, getCategoryUrl } from '../utils/urlUtils.js';

/**
 * Cria o handler de erro para imagem com fallback
 * @param {string} thumbnailPath - URL do thumbnail
 * @param {string|null} fallbackUrl - URL de fallback para API de thumbnail
 * @returns {string} String do atributo onerror
 */
function createOnErrorHandler(thumbnailPath, fallbackUrl) {
    const isS3Thumbnail = thumbnailPath && thumbnailPath.includes('.s3.') && thumbnailPath.includes('.amazonaws.com');
    
    if (isS3Thumbnail && fallbackUrl) {
        return `this.onerror=null; this.src='${fallbackUrl}';`;
    }
    return `this.style.display='none';`;
}

/**
 * Cria um elemento de card para categoria
 * @param {Object} category - Dados da categoria { name, displayName, drawings }
 * @param {Function} onClick - Callback para clique no card
 * @returns {HTMLElement} Elemento do card
 */
export function createCategoryCard(category, onClick = null) {
    const firstDrawing = category.drawings[0];
    
    // Obter URL do thumbnail e URL original da imagem
    const thumbnailPath = getThumbnailUrl(firstDrawing, category.name);
    const imageUrl = getDrawingUrl(firstDrawing);
    
    // Construir fallback URL para API de thumbnail
    const fallbackUrl = imageUrl ? `/api/thumbnail?url=${encodeURIComponent(imageUrl)}` : null;
    
    // Criar elemento do card
    const categoryCard = document.createElement('div');
    categoryCard.className = 'card';
    
    // Definir handler de clique
    if (onClick) {
        categoryCard.onclick = onClick;
    } else {
        categoryCard.onclick = () => {
            window.location.href = getCategoryUrl(category.name);
        };
    }

    // Criar handler de erro para fallback
    const onErrorHandler = createOnErrorHandler(thumbnailPath, fallbackUrl);

    categoryCard.innerHTML = `
        <img src="${thumbnailPath}" alt="${category.displayName}" class="card-thumbnail" 
             onerror="${onErrorHandler}">
        <h2 class="card-name">${category.displayName}</h2>
    `;

    return categoryCard;
}

/**
 * Cria um elemento de card para desenho
 * @param {Object} drawing - Dados do desenho
 * @param {string} drawingName - Nome formatado do desenho
 * @param {string} categoryName - Nome da categoria
 * @param {Function} onClick - Callback para clique no card
 * @returns {HTMLElement} Elemento do card
 */
export function createDrawingCard(drawing, drawingName, categoryName, onClick) {
    const imageUrl = getDrawingUrl(drawing);
    
    // Obter URL do thumbnail
    let thumbnailPath = getThumbnailUrl(drawing, categoryName);
    
    const isS3Thumbnail = thumbnailPath && thumbnailPath.includes('.s3.') && thumbnailPath.includes('.amazonaws.com');
    const fallbackUrl = imageUrl 
        ? `/api/thumbnail?url=${encodeURIComponent(imageUrl)}` 
        : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3E?%3C/text%3E%3C/svg%3E';

    const drawingCard = document.createElement('div');
    drawingCard.className = 'card';
    drawingCard.onclick = onClick;

    const onErrorHandler = isS3Thumbnail 
        ? `this.onerror=null; this.src='${fallbackUrl}';`
        : `this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3E?%3C/text%3E%3C/svg%3E';`;

    drawingCard.innerHTML = `
        <img src="${thumbnailPath}" alt="${drawingName}" class="card-thumbnail"
             onerror="${onErrorHandler}">
        <h2 class="card-name">${drawingName}</h2>
    `;

    return drawingCard;
}

