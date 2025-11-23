// UI - Renderização de desenhos de uma categoria

import { getCategoryData, getDrawingsInCategory, getDrawingFilename, getDrawingUrl, getThumbnailUrl } from '../services/drawingsService.js';
import { getCategoryFromUrl, getPaintUrl, getProxyUrl, isS3Url } from '../utils/urlUtils.js';

/**
 * Carrega e renderiza os desenhos de uma categoria
 */
export async function loadDrawings() {
    const category = getCategoryFromUrl();
    if (!category) {
        const grid = document.getElementById('drawings-grid');
        if (grid) {
            grid.innerHTML = '<p>Erro: Categoria não especificada.</p>';
        }
        return;
    }

    const grid = document.getElementById('drawings-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="loading-container">
            <div class="spinner"></div>
            <p class="loading-label">Carregando desenhos...</p>
        </div>
    `;

    try {
        // Atualizar título
        const title = document.getElementById('category-title');
        if (title) {
            const categoryData = await getCategoryData(category);
            if (categoryData) {
                title.textContent = categoryData.displayName;
            } else {
                const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
                title.textContent = categoryName;
            }
        }

        const drawings = await getDrawingsInCategory(category);
        
        if (drawings.length === 0) {
            grid.innerHTML = '<p>Nenhum desenho encontrado nesta categoria.</p>';
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
            
            const drawingName = filename.replace(/\.(svg|png|jpg|jpeg)$/i, '').replace(/_/g, ' ');

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
        grid.innerHTML = '<p>Erro ao carregar desenhos. Verifique se o servidor está rodando.</p>';
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('drawings-grid')) {
        loadDrawings();
    }
});

