// Painter - Módulo de algoritmo Flood Fill

/**
 * Função para converter cor hex para RGB
 * @param {string} hex - Cor em formato hex
 * @returns {Object|null} Objeto {r, g, b} ou null se inválido
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Função para comparar cores (com tolerância)
 * @param {number} r1 - Vermelho da cor 1
 * @param {number} g1 - Verde da cor 1
 * @param {number} b1 - Azul da cor 1
 * @param {number} r2 - Vermelho da cor 2
 * @param {number} g2 - Verde da cor 2
 * @param {number} b2 - Azul da cor 2
 * @param {number} tolerance - Tolerância para comparação
 * @returns {boolean} true se as cores são similares
 */
export function colorsMatch(r1, g1, b1, r2, g2, b2, tolerance = 10) {
    return Math.abs(r1 - r2) <= tolerance &&
           Math.abs(g1 - g2) <= tolerance &&
           Math.abs(b1 - b2) <= tolerance;
}

/**
 * Função para verificar se um pixel é parte do outline original (preto na imagem original)
 * @param {number} x - Coordenada X
 * @param {number} y - Coordenada Y
 * @param {ImageData} originalImageData - Dados da imagem original
 * @param {number} width - Largura da imagem
 * @returns {boolean} true se for outline original
 */
export function isOriginalOutline(x, y, originalImageData, width) {
    if (!originalImageData) return false;
    
    const pos = (y * width + x) * 4;
    const r = originalImageData.data[pos];
    const g = originalImageData.data[pos + 1];
    const b = originalImageData.data[pos + 2];
    
    // Verificar se é preto (ou muito próximo de preto) na imagem original
    // Tolerância de 30 para capturar pixels pretos mesmo com pequenas variações
    const blackTolerance = 30;
    return r <= blackTolerance && g <= blackTolerance && b <= blackTolerance;
}

/**
 * Algoritmo de flood fill (preenchimento por área)
 * @param {HTMLCanvasElement} canvas - Canvas a ser preenchido
 * @param {CanvasRenderingContext2D} ctx - Contexto do canvas
 * @param {number} startX - Coordenada X inicial
 * @param {number} startY - Coordenada Y inicial
 * @param {string} fillColor - Cor de preenchimento em hex
 * @param {ImageData} originalImageData - Dados da imagem original para preservar outlines
 */
export function floodFill(canvas, ctx, startX, startY, fillColor, originalImageData) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    // Validar coordenadas
    const x = Math.floor(startX);
    const y = Math.floor(startY);
    if (x < 0 || x >= width || y < 0 || y >= height) {
        return;
    }
    
    // Obter cor do ponto inicial
    const startPos = (y * width + x) * 4;
    let startR = data[startPos];
    let startG = data[startPos + 1];
    let startB = data[startPos + 2];
    const startA = data[startPos + 3];
    
    // Verificar se o pixel clicado é parte do outline original
    const clickedOnOriginalOutline = isOriginalOutline(x, y, originalImageData, width);
    if (clickedOnOriginalOutline) {
        return;
    }
    
    // Se o pixel é completamente transparente, tratar como branco
    if (startA === 0) {
        startR = 255;
        startG = 255;
        startB = 255;
    }
    
    // Obter cor de preenchimento
    const fillRgb = hexToRgb(fillColor);
    if (!fillRgb) {
        console.error('Cor de preenchimento inválida:', fillColor);
        return;
    }
    
    // Se a cor inicial já é a cor de preenchimento, não fazer nada
    if (colorsMatch(startR, startG, startB, fillRgb.r, fillRgb.g, fillRgb.b, 5)) {
        return;
    }
    
    // Usar fila para flood fill (mais eficiente que recursão)
    const queue = [[x, y]];
    const visited = new Set();
    const targetColor = { r: startR, g: startG, b: startB };
    
    // Tolerância para matching de cores
    const tolerance = 30;
    
    while (queue.length > 0) {
        const [px, py] = queue.shift();
        const key = `${px},${py}`;
        
        if (visited.has(key)) continue;
        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        
        // Pular pixels que são parte do outline original
        if (isOriginalOutline(px, py, originalImageData, width)) {
            continue;
        }
        
        const pos = (py * width + px) * 4;
        const a = data[pos + 3];
        
        // Se o pixel é transparente, tratar como branco
        let r = data[pos];
        let g = data[pos + 1];
        let b = data[pos + 2];
        if (a === 0) {
            r = 255;
            g = 255;
            b = 255;
        }
        
        // Verificar se é a cor que queremos substituir
        if (!colorsMatch(r, g, b, targetColor.r, targetColor.g, targetColor.b, tolerance)) {
            continue;
        }
        
        // Preencher o pixel
        data[pos] = fillRgb.r;
        data[pos + 1] = fillRgb.g;
        data[pos + 2] = fillRgb.b;
        data[pos + 3] = a === 0 ? 255 : a;
        
        visited.add(key);
        
        // Adicionar vizinhos à fila (4-direções)
        queue.push([px + 1, py]);
        queue.push([px - 1, py]);
        queue.push([px, py + 1]);
        queue.push([px, py - 1]);
    }
    
    // Aplicar as mudanças
    ctx.putImageData(imageData, 0, 0);
}

