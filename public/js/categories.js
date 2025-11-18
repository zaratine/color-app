// Gerenciamento de categorias
// Carrega dados dinamicamente da API em tempo de execução

let DRAWINGS_DATABASE = {};

// Função para carregar dados da API
async function loadDrawingsDatabase() {
    try {
        const response = await fetch('/api/drawings');
        if (response.ok) {
            DRAWINGS_DATABASE = await response.json();
            return true;
        }
    } catch (error) {
        console.error('Erro ao carregar desenhos da API:', error);
    }
    return false;
}

// Função para carregar categorias
async function loadCategories() {
    const grid = document.getElementById('categories-grid');
    if (!grid) return;

    grid.innerHTML = '<p>Carregando categorias...</p>';

    // Carregar dados da API
    const loaded = await loadDrawingsDatabase();
    
    if (!loaded || Object.keys(DRAWINGS_DATABASE).length === 0) {
        grid.innerHTML = '<p>Nenhuma categoria encontrada. Verifique se o servidor está rodando.</p>';
        return;
    }

    grid.innerHTML = '';

    for (const [categoryName, categoryData] of Object.entries(DRAWINGS_DATABASE)) {
        if (categoryData.drawings.length === 0) {
            // Se não houver desenhos, pular esta categoria
            continue;
        }

        const firstDrawing = categoryData.drawings[0];
        const thumbnailPath = `drawings/${categoryName}/${firstDrawing}`;

        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.onclick = () => {
            window.location.href = `/category?cat=${encodeURIComponent(categoryName)}`;
        };

        categoryCard.innerHTML = `
            <img src="${thumbnailPath}" alt="${categoryData.displayName}" class="category-thumbnail" 
                 onerror="this.style.display='none'">
            <p class="category-name">${categoryData.displayName}</p>
        `;

        grid.appendChild(categoryCard);
    }
}

// Função auxiliar para obter lista de desenhos em uma categoria
async function getDrawingsInCategory(categoryName) {
    // Garantir que os dados estão carregados
    if (Object.keys(DRAWINGS_DATABASE).length === 0) {
        await loadDrawingsDatabase();
    }
    
    if (DRAWINGS_DATABASE[categoryName]) {
        return DRAWINGS_DATABASE[categoryName].drawings || [];
    }
    return [];
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('categories-grid')) {
        loadCategories();
    }
});
