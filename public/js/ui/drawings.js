// UI - Renderização de desenhos de uma categoria

import { getDrawingsInCategory, getDrawingFilename, getDrawingUrl, getThumbnailUrl, getAllCategories } from '../services/drawingsService.js';
import { getCategoryFromUrl, getPaintUrl, getProxyUrl, isS3Url, getCategoryUrl } from '../utils/urlUtils.js';

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
 * Remove números ao final de uma string
 * @param {string} str - String a ser processada
 * @returns {string} String sem números ao final
 */
function removeTrailingNumbers(str) {
    if (!str) return '';
    // Remove espaços/hífens/underscores seguidos de números no final
    return str.replace(/[\s_-]+\d+$/, '');
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
        // Breadcrumb e meta tags agora são renderizadas no servidor via EJS
        // Não é mais necessário atualizar esses elementos aqui

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
            
            let nameWithoutExt = filename.replace(/\.(svg|png|jpg|jpeg)$/i, '').replace(/_/g, ' ');
            // Remover números ao final
            nameWithoutExt = removeTrailingNumbers(nameWithoutExt);
            const drawingName = capitalizeWords(nameWithoutExt);

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
                <h2 class="drawing-name">${drawingName}</h2>
            `;

            grid.appendChild(drawingCard);
        });
        
        // Carregar outras categorias após carregar os desenhos
        await loadOtherCategories(category);
    } catch (error) {
        console.error('Erro ao carregar desenhos:', error);
        grid.innerHTML = '<p>Error loading drawings. Please check if the server is running.</p>';
    }
}

/**
 * Carrega e renderiza 3 categorias aleatórias (excluindo a categoria atual)
 * @param {string} currentCategory - Nome da categoria atual
 */
async function loadOtherCategories(currentCategory) {
    const grid = document.getElementById('other-categories-grid');
    if (!grid) return;

    try {
        const allCategories = await getAllCategories();
        
        // Filtrar categorias que têm desenhos e excluir a categoria atual
        const availableCategories = allCategories.filter(
            cat => cat.drawings.length > 0 && cat.name !== currentCategory
        );
        
        if (availableCategories.length === 0) {
            // Se não há outras categorias, esconder a seção
            const section = document.querySelector('.other-categories-section');
            if (section) {
                section.style.display = 'none';
            }
            return;
        }
        
        // Selecionar 3 categorias aleatórias
        const shuffled = availableCategories.sort(() => 0.5 - Math.random());
        const randomCategories = shuffled.slice(0, 3);
        
        grid.innerHTML = '';
        
        for (const category of randomCategories) {
            const firstDrawing = category.drawings[0];
            
            // Obter URL do thumbnail e URL original da imagem
            const thumbnailPath = getThumbnailUrl(firstDrawing, category.name);
            const imageUrl = getDrawingUrl(firstDrawing);
            
            // Se for URL do S3 direta, tentar carregar direto. Se der 404, fazer fallback para /api/thumbnail
            const isS3Thumbnail = thumbnailPath && thumbnailPath.includes('.s3.') && thumbnailPath.includes('.amazonaws.com');
            const fallbackUrl = imageUrl ? `/api/thumbnail?url=${encodeURIComponent(imageUrl)}` : null;
            
            const categoryCard = document.createElement('div');
            categoryCard.className = 'category-card';
            categoryCard.onclick = () => {
                window.location.href = getCategoryUrl(category.name);
            };

            // Se for URL do S3, fazer fallback para API quando der erro. Caso contrário, esconder imagem
            const onErrorHandler = isS3Thumbnail && fallbackUrl
                ? `this.onerror=null; this.src='${fallbackUrl}';`
                : `this.style.display='none';`;

            categoryCard.innerHTML = `
                <img src="${thumbnailPath}" alt="${category.displayName}" class="category-thumbnail" 
                     onerror="${onErrorHandler}">
                <h2 class="category-name">${category.displayName}</h2>
            `;

            grid.appendChild(categoryCard);
        }
    } catch (error) {
        console.error('Erro ao carregar outras categorias:', error);
        // Em caso de erro, esconder a seção
        const section = document.querySelector('.other-categories-section');
        if (section) {
            section.style.display = 'none';
        }
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('drawings-grid')) {
        loadDrawings();
    }
});

