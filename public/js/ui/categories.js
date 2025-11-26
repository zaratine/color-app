// UI - Renderização de categorias

import { getAllCategories } from '../services/drawingsService.js';
import { createCategoryCard } from '../components/card.js';

/**
 * Carrega e renderiza as categorias na página
 */
export async function loadCategories() {
    const grid = document.getElementById('categories-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="loading-container">
            <div class="spinner"></div>
            <p class="loading-label">Loading categories...</p>
        </div>
    `;

    try {
        const categories = await getAllCategories();
        
        // Filtrar categorias que têm desenhos
        const categoriesWithDrawings = categories.filter(cat => cat.drawings.length > 0);
        
        if (categoriesWithDrawings.length === 0) {
            grid.innerHTML = '<p>No categories found. Please check if the server is running.</p>';
            return;
        }

        grid.innerHTML = '';

        for (const category of categoriesWithDrawings) {
            const categoryCard = createCategoryCard(category);
            grid.appendChild(categoryCard);
        }
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        grid.innerHTML = '<p>Error loading categories. Please check if the server is running.</p>';
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('categories-grid');
    if (grid) {
        loadCategories();
    }
});

