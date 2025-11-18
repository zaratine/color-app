// Lógica principal e roteamento

// Função para obter parâmetros da URL
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        cat: params.get('cat'),
        drawing: params.get('drawing')
    };
}

// Inicialização baseada na página atual
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const currentPage = path.split('/').pop() || '';
    
    // Suportar rotas limpas (sem extensão) e rotas com extensão (compatibilidade)
    if (currentPage === '' || currentPage === 'index.html' || path === '/') {
        // Página de categorias será inicializada por categories.js
        return;
    } else if (currentPage === 'category' || currentPage === 'category.html') {
        // Página de listagem será inicializada por drawings.js
        return;
    } else if (currentPage === 'paint' || currentPage === 'paint.html') {
        // Página de pintura será inicializada por painter.js
        return;
    }
});

