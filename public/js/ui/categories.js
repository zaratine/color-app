// UI - Renderização de categorias

import { getAllCategories } from '../services/drawingsService.js';
import { getCategoryUrl } from '../utils/urlUtils.js';

/**
 * Carrega e renderiza as categorias na página
 */
export async function loadCategories() {
    const grid = document.getElementById('categories-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="loading-container">
            <div class="spinner"></div>
            <p class="loading-label">Carregando categorias...</p>
        </div>
    `;

    try {
        console.log('📋 Carregando categorias...');
        const categories = await getAllCategories();
        console.log('📋 Categorias recebidas:', categories);
        
        // Filtrar categorias que têm desenhos
        const categoriesWithDrawings = categories.filter(cat => cat.drawings.length > 0);
        console.log('📋 Categorias com desenhos:', categoriesWithDrawings.length);
        
        if (categoriesWithDrawings.length === 0) {
            console.warn('📋 Nenhuma categoria com desenhos encontrada');
            grid.innerHTML = '<p>Nenhuma categoria encontrada. Verifique se o servidor está rodando.</p>';
            return;
        }

        grid.innerHTML = '';

        for (const category of categoriesWithDrawings) {
            const firstDrawing = category.drawings[0];
            
            // Obter URL ou caminho da imagem
            let thumbnailPath;
            if (typeof firstDrawing === 'object' && firstDrawing.url) {
                // Usar URL do S3
                thumbnailPath = firstDrawing.url;
            } else {
                // Usar caminho relativo (filesystem)
                const filename = typeof firstDrawing === 'string' ? firstDrawing : firstDrawing.filename;
                thumbnailPath = `drawings/${category.name}/${filename}`;
            }

            const categoryCard = document.createElement('div');
            categoryCard.className = 'category-card';
            categoryCard.onclick = () => {
                window.location.href = getCategoryUrl(category.name);
            };

            categoryCard.innerHTML = `
                <img src="${thumbnailPath}" alt="${category.displayName}" class="category-thumbnail" 
                     onerror="this.style.display='none'">
                <p class="category-name">${category.displayName}</p>
            `;

            grid.appendChild(categoryCard);
        }
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        grid.innerHTML = '<p>Erro ao carregar categorias. Verifique se o servidor está rodando.</p>';
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    console.log('📋 categories.js: DOMContentLoaded disparado');
    const grid = document.getElementById('categories-grid');
    if (grid) {
        console.log('📋 categories.js: Grid encontrado, carregando categorias...');
        loadCategories();
    } else {
        console.warn('📋 categories.js: Grid não encontrado!');
    }
});

