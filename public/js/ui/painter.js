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
        
        // Ajustar tamanho quando a janela for redimensionada
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                requestAnimationFrame(() => {
                    adjustColorItemsSize();
                });
            }, 100);
        });
    }
});
