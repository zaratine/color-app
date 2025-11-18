// UI - Renderização de categorias

import { getAllCategories } from '../services/drawingsService.js';
import { getCategoryUrl } from '../utils/urlUtils.js';

/**
 * Carrega e renderiza as categorias na página
 */
export async function loadCategories() {
    const grid = document.getElementById('categories-grid');
    if (!grid) return;

    grid.innerHTML = '<p>Carregando categorias...</p>';

    try {
        const categories = await getAllCategories();
        
        // Filtrar categorias que têm desenhos
        const categoriesWithDrawings = categories.filter(cat => cat.drawings.length > 0);
        
        if (categoriesWithDrawings.length === 0) {
            grid.innerHTML = '<p>Nenhuma categoria encontrada. Verifique se o servidor está rodando.</p>';
            return;
        }

        grid.innerHTML = '';

        for (const category of categoriesWithDrawings) {
            const firstDrawing = category.drawings[0];
            const thumbnailPath = `drawings/${category.name}/${firstDrawing}`;

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
    if (document.getElementById('categories-grid')) {
        loadCategories();
    }
});

