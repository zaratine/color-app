// UI - Lógica de pintura/preenchimento para imagens PNG usando Canvas
// Arquivo principal que importa e coordena os módulos

import { initColorPalette, adjustColorItemsSize } from './painter/colorPalette.js';
import { loadImage, updateBackLink } from './painter/canvas.js';

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('color-grid') && document.getElementById('canvas-container')) {
        updateBackLink();
        initColorPalette();
        loadImage();
        
        // Armazenar o modo inicial (mobile ou desktop)
        let wasMobile = window.innerWidth <= 767;
        
        // Ajustar tamanho quando a janela for redimensionada
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const isMobile = window.innerWidth <= 767;
                
                // Se mudou de modo (mobile <-> desktop), recarregar a página
                if (isMobile !== wasMobile) {
                    window.location.reload();
                    return;
                }
                
                requestAnimationFrame(() => {
                    adjustColorItemsSize();
                });
            }, 100);
        });
    }
});
