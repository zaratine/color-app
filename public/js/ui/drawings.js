// UI - Renderização de desenhos de uma categoria

import { getCategoryData, getDrawingsInCategory, getDrawingFilename, getDrawingUrl, getThumbnailUrl, getAllCategories } from '../services/drawingsService.js';
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
        
        // Atualizar breadcrumb
        const breadcrumbCategory = document.getElementById('breadcrumb-category');
        if (breadcrumbCategory) {
            breadcrumbCategory.textContent = friendlyName;
        }
        
        // Atualizar seção de descrição da categoria
        const categoryDescription = document.querySelector('.category-description');
        if (categoryDescription) {
            const friendlyNameElements = categoryDescription.querySelectorAll('#category-friendly-name, #category-friendly-name-inline');
            friendlyNameElements.forEach(el => {
                if (el.id === 'category-friendly-name') {
                    el.textContent = `${friendlyName} Coloring Pages`;
                } else {
                    el.textContent = friendlyName;
                }
            });
        }
        
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
        const descriptionText = `Free ${friendlyName.toLowerCase()} coloring pages for kids! Print or Color Online. Explore our collection of ${friendlyName.toLowerCase()} coloring pages. High-resolution drawings ready to color.`;
        metaDescription.content = descriptionText;
        
        // Atualizar Open Graph meta tags
        let ogTitle = document.getElementById('og-title');
        if (!ogTitle) {
            ogTitle = document.createElement('meta');
            ogTitle.id = 'og-title';
            ogTitle.setAttribute('property', 'og:title');
            document.head.appendChild(ogTitle);
        }
        ogTitle.content = pageTitle;
        
        let ogDescription = document.getElementById('og-description');
        if (!ogDescription) {
            ogDescription = document.createElement('meta');
            ogDescription.id = 'og-description';
            ogDescription.setAttribute('property', 'og:description');
            document.head.appendChild(ogDescription);
        }
        ogDescription.content = descriptionText;
        
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

