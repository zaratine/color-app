// App - Inicialização e roteamento básico

// Inicialização baseada na página atual
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const currentPage = path.split('/').pop() || '';
    
    // Suportar rotas limpas (sem extensão) e rotas com extensão (compatibilidade)
    if (currentPage === '' || currentPage === 'index.html' || path === '/') {
        // Página de categorias será inicializada por ui/categories.js
        return;
    } else if (currentPage === 'category' || currentPage === 'category.html') {
        // Página de listagem será inicializada por ui/drawings.js
        return;
    } else if (currentPage === 'paint' || currentPage === 'paint.html') {
        // Página de pintura será inicializada por ui/painter.js
        return;
    }
});
