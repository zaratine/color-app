// UI - Renderização de desenhos de uma categoria

import { getCategoryData, getDrawingsInCategory, getDrawingFilename, getDrawingUrl, getThumbnailUrl } from '../services/drawingsService.js';
import { getCategoryFromUrl, getPaintUrl, getProxyUrl, isS3Url } from '../utils/urlUtils.js';

/**
 * Capitaliza a primeira letra de cada palavra em uma string
 * @param {string} str - String a ser capitalizada
 * @returns {string} String com primeira letra de cada palavra em maiúscula
 */
function capitalizeWords(str) {
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Carrega e renderiza os desenhos de uma categoria
 */
export async function loadDrawings() {
    const category = getCategoryFromUrl();
    if (!category) {
        const grid = document.getElementById('drawings-grid');
        if (grid) {
            grid.innerHTML = '<p>Error: Category not specified.</p>';
        }
        return;
    }

    const grid = document.getElementById('drawings-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="loading-container">
            <div class="spinner"></div>
            <p class="loading-label">Loading drawings...</p>
        </div>
    `;

    try {
        // Obter dados da categoria e nome amigável
        const categoryData = await getCategoryData(category);
        const friendlyName = categoryData ? categoryData.displayName : capitalizeWords(category);
        
        // Atualizar título da página e meta tags
        const pageTitle = `${friendlyName} Coloring Pages – Print or Color Online`;
        document.title = pageTitle;
        
        // Atualizar meta title
        let metaTitle = document.getElementById('meta-title');
        if (!metaTitle) {
            metaTitle = document.createElement('meta');
            metaTitle.id = 'meta-title';
            metaTitle.name = 'title';
            document.head.appendChild(metaTitle);
        }
        metaTitle.content = pageTitle;
        
        // Atualizar meta description
        let metaDescription = document.querySelector('meta[name="description"]');
        if (!metaDescription) {
            metaDescription = document.createElement('meta');
            metaDescription.name = 'description';
            document.head.appendChild(metaDescription);
        }
        metaDescription.content = `Free ${friendlyName.toLowerCase()} coloring pages for kids! Print or Color Online. Explore our collection of ${friendlyName.toLowerCase()} coloring pages. High-resolution drawings ready to color.`;
        
        // Atualizar canonical URL
        let canonicalLink = document.querySelector('link[rel="canonical"]');
        if (!canonicalLink) {
            canonicalLink = document.createElement('link');
            canonicalLink.rel = 'canonical';
            document.head.appendChild(canonicalLink);
        }
        canonicalLink.href = window.location.href;

        const drawings = await getDrawingsInCategory(category);
        
        if (drawings.length === 0) {
            grid.innerHTML = '<p>No drawings found in this category.</p>';
            return;
        }

        grid.innerHTML = '';

        drawings.forEach(drawing => {
            const filename = getDrawingFilename(drawing);
            const imageUrl = getDrawingUrl(drawing);
            
            // Obter URL do thumbnail
            let thumbnailPath = getThumbnailUrl(drawing, category);
            
            // Se for URL do S3 direta, tentar carregar direto. Se der 404, fazer fallback para /api/thumbnail
            // Se já for /api/thumbnail, usar diretamente
            const isS3Thumbnail = thumbnailPath && thumbnailPath.includes('.s3.') && thumbnailPath.includes('.amazonaws.com');
            const fallbackUrl = imageUrl ? `/api/thumbnail?url=${encodeURIComponent(imageUrl)}` : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3E?%3C/text%3E%3C/svg%3E';
            
            const drawingName = capitalizeWords(
                filename.replace(/\.(svg|png|jpg|jpeg)$/i, '').replace(/_/g, ' ')
            );

            const drawingCard = document.createElement('div');
            drawingCard.className = 'drawing-card';
            drawingCard.onclick = () => {
                window.location.href = getPaintUrl(category, filename, imageUrl);
            };

            // Se for URL do S3, fazer fallback para API quando der erro
            const onErrorHandler = isS3Thumbnail 
                ? `this.onerror=null; this.src='${fallbackUrl}';`
                : `this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3E?%3C/text%3E%3C/svg%3E';`;

            drawingCard.innerHTML = `
                <img src="${thumbnailPath}" alt="${drawingName}" class="drawing-thumbnail"
                     onerror="${onErrorHandler}">
                <p class="drawing-name">${drawingName}</p>
            `;

            grid.appendChild(drawingCard);
        });
    } catch (error) {
        console.error('Erro ao carregar desenhos:', error);
        grid.innerHTML = '<p>Error loading drawings. Please check if the server is running.</p>';
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('drawings-grid')) {
        loadDrawings();
    }
});

