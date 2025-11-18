// Gerenciamento de desenhos
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

// Função para obter o nome da categoria da URL
function getCategoryFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('cat');
}

// Função para carregar desenhos de uma categoria
async function loadDrawings() {
    const category = getCategoryFromUrl();
    if (!category) {
        document.getElementById('drawings-grid').innerHTML = 
            '<p>Erro: Categoria não especificada.</p>';
        return;
    }

    const grid = document.getElementById('drawings-grid');
    if (!grid) return;

    grid.innerHTML = '<p>Carregando desenhos...</p>';

    // Carregar dados da API
    const loaded = await loadDrawingsDatabase();
    
    if (!loaded) {
        grid.innerHTML = '<p>Erro ao carregar desenhos. Verifique se o servidor está rodando.</p>';
        return;
    }

    // Atualizar título
    const title = document.getElementById('category-title');
    if (title) {
        const categoryData = DRAWINGS_DATABASE[category];
        if (categoryData) {
            title.textContent = categoryData.displayName;
        } else {
            const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
            title.textContent = categoryName;
        }
    }

    const drawings = DRAWINGS_DATABASE[category]?.drawings || [];
    
    if (drawings.length === 0) {
        grid.innerHTML = '<p>Nenhum desenho encontrado nesta categoria.</p>';
        return;
    }

    grid.innerHTML = '';

    drawings.forEach(drawing => {
        const drawingCard = document.createElement('div');
        drawingCard.className = 'drawing-card';
        drawingCard.onclick = () => {
            window.location.href = `/paint?cat=${encodeURIComponent(category)}&drawing=${encodeURIComponent(drawing)}`;
        };

        const thumbnailPath = `drawings/${category}/${drawing}`;
        const drawingName = drawing.replace(/\.(svg|png|jpg|jpeg)$/i, '').replace(/_/g, ' ');

        drawingCard.innerHTML = `
            <img src="${thumbnailPath}" alt="${drawingName}" class="drawing-thumbnail"
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3E?%3C/text%3E%3C/svg%3E'">
            <p class="drawing-name">${drawingName}</p>
        `;

        grid.appendChild(drawingCard);
    });
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('drawings-grid')) {
        loadDrawings();
    }
});

