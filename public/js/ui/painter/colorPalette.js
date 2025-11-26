// Painter - Módulo de paleta de cores

import { updateCanvasCursor } from './canvas.js';

// Paleta de 24 cores para crianças
export const COLOR_PALETTE = [
    '#FF0000', // Vermelho
    '#FF6B00', // Laranja
    '#FFD700', // Dourado
    '#FFFF00', // Amarelo
    '#ADFF2F', // Verde amarelo
    '#00FF00', // Verde
    '#00CED1', // Turquesa
    '#00BFFF', // Azul céu
    '#0000FF', // Azul
    '#8A2BE2', // Azul violeta
    '#FF00FF', // Magenta
    '#FF1493', // Rosa choque
    '#FF69B4', // Rosa
    '#FFB6C1', // Rosa claro
    '#FFA500', // Laranja
    '#FF6347', // Tomate
    '#32CD32', // Verde lima
    '#00FA9A', // Verde médio primavera
    '#1E90FF', // Azul dodger
    '#9370DB', // Roxo médio
    '#8B4513', // Marrom
    '#000000', // Preto
    '#808080', // Cinza
    '#FFFFFF'  // Branco
];

let selectedColor = COLOR_PALETTE[0];

/**
 * Obtém a cor atualmente selecionada
 * @returns {string} Cor em formato hex
 */
export function getSelectedColor() {
    return selectedColor;
}

/**
 * Função para calcular e ajustar o tamanho dos itens de cor
 */
export function adjustColorItemsSize() {
    const colorGrid = document.getElementById('color-grid');
    if (!colorGrid) return;

    const colorPalette = colorGrid.closest('.color-palette');
    if (!colorPalette) return;

    // Obter dimensões disponíveis da paleta
    const paletteHeader = colorPalette.querySelector('header');
    const headerHeight = paletteHeader ? paletteHeader.offsetHeight : 0;
    const palettePaddingTop = 1.5 * 16; // 1.5rem top
    const palettePaddingBottom = 1.5 * 16; // 1.5rem bottom
    const palettePaddingLeft = 1.5 * 16; // 1.5rem left
    const palettePaddingRight = 3 * 16; // 3rem right (dobro do esquerdo)
    
    // Altura disponível para o grid (100% da paleta menos header e padding)
    const availableHeight = colorPalette.offsetHeight - headerHeight - palettePaddingTop - palettePaddingBottom;
    const availableWidth = colorPalette.offsetWidth - palettePaddingLeft - palettePaddingRight;

    // Gap fixo de aproximadamente 20px (horizontal e vertical)
    const gapSize = 20;
    
    // Determinar número de colunas (3 para desktop, 6 para mobile)
    const isMobile = window.innerWidth <= 768;
    const columns = isMobile ? 6 : 3;
    const rows = Math.ceil(COLOR_PALETTE.length / columns);
    
    // Calcular espaço necessário para gaps
    const totalGapWidth = (columns - 1) * gapSize;
    const totalGapHeight = (rows - 1) * gapSize;
    
    // Aplicar configuração ao grid
    colorGrid.style.gap = `${gapSize}px`;
    colorGrid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    colorGrid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    colorGrid.style.height = `${availableHeight}px`;
    colorGrid.style.width = `${availableWidth}px`;
}

/**
 * Função para selecionar uma cor
 * @param {string} color - Cor em formato hex
 * @param {HTMLElement} element - Elemento clicado
 */
function selectColor(color, element) {
    selectedColor = color;
    
    // Remover seleção anterior
    document.querySelectorAll('.color-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Adicionar seleção atual
    element.classList.add('selected');
    
    // Atualizar cursor do canvas com a nova cor
    updateCanvasCursor(color);
}

/**
 * Função para inicializar a paleta de cores
 */
export function initColorPalette() {
    const colorGrid = document.getElementById('color-grid');
    if (!colorGrid) return;

    colorGrid.innerHTML = '';

    COLOR_PALETTE.forEach((color, index) => {
        const colorItem = document.createElement('div');
        colorItem.className = 'color-item';
        if (index === 0) {
            colorItem.classList.add('selected');
        }
        colorItem.style.backgroundColor = color;
        colorItem.style.border = color === '#FFFFFF' ? '2px solid #ccc' : 'none';
        colorItem.onclick = () => selectColor(color, colorItem);
        colorGrid.appendChild(colorItem);
    });

    // Ajustar tamanho após criar os itens
    requestAnimationFrame(() => {
        adjustColorItemsSize();
    });
}

