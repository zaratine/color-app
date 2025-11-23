// UI - Lógica de pintura/preenchimento para imagens PNG usando Canvas

import { getCategoryFromUrl, getDrawingFromUrl, getCategoryUrl, getImageUrlFromUrl, getProxyUrl, isS3Url, getDrawingBySlug } from '../utils/urlUtils.js';
import { getDrawingUrl, getDrawingFilename, getCategoryData } from '../services/drawingsService.js';

/**
 * Capitaliza a primeira letra de cada palavra em uma string
 * @param {string} str - String a ser capitalizada
 * @returns {string} String com primeira letra de cada palavra em maiúscula
 */
function capitalizeWords(str) {
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Remove números ao final de uma string
 * @param {string} str - String a ser processada
 * @returns {string} String sem números ao final
 */
function removeTrailingNumbers(str) {
    if (!str) return '';
    // Remove espaços/hífens/underscores seguidos de números no final
    return str.replace(/[\s_-]+\d+$/, '');
}

/**
 * Obtém o nome amigável de um desenho a partir do nome do arquivo
 * @param {string|Object} drawing - Nome do arquivo ou objeto do desenho
 * @returns {string} Nome amigável do desenho
 */
function getFriendlyDrawingName(drawing) {
    const filename = getDrawingFilename(drawing);
    let nameWithoutExt = filename.replace(/\.(svg|png|jpg|jpeg)$/i, '').replace(/_/g, ' ');
    // Remover números ao final
    nameWithoutExt = removeTrailingNumbers(nameWithoutExt);
    return capitalizeWords(nameWithoutExt);
}

/**
 * Atualiza o título da página, h1 e meta description com o nome amigável do desenho
 * @param {string|Object} drawing - Nome do arquivo ou objeto do desenho
 */
async function updatePageMetadata(drawing) {
    const friendlyName = getFriendlyDrawingName(drawing);
    const category = getCategoryFromUrl();
    
    // Atualizar breadcrumb com categoria
    if (category) {
        try {
            const categoryData = await getCategoryData(category);
            const categoryFriendlyName = categoryData ? categoryData.displayName : capitalizeWords(category);
            
            const breadcrumbCategory = document.getElementById('breadcrumb-category');
            const breadcrumbCategoryLink = document.getElementById('breadcrumb-category-link');
            if (breadcrumbCategory && breadcrumbCategoryLink) {
                breadcrumbCategoryLink.textContent = categoryFriendlyName;
                breadcrumbCategoryLink.href = getCategoryUrl(category);
            }
        } catch (error) {
            console.error('Erro ao carregar dados da categoria para breadcrumb:', error);
        }
    }
    
    // Breadcrumb já foi atualizado pelo script inline no HTML
    // Apenas atualizar se o nome amigável do desenho for diferente do slug
    const breadcrumbDrawing = document.getElementById('breadcrumb-drawing');
    if (breadcrumbDrawing) {
        const span = breadcrumbDrawing.querySelector('span');
        if (span && span.textContent !== friendlyName) {
            // Atualizar apenas se o nome real for diferente do slug
            span.textContent = friendlyName;
        }
    }
    
    // Atualizar título da página
    const pageTitle = `${friendlyName} Coloring Page – Print or Color Online`;
    document.title = pageTitle;
    
    // H1 já foi atualizado pelo script inline no HTML
    // Apenas atualizar se o nome amigável do desenho for diferente do slug
    const h1 = document.getElementById('drawing-title');
    if (h1) {
        const currentText = h1.textContent.replace(' Coloring Page', '');
        if (currentText !== friendlyName) {
            // Atualizar apenas se o nome real for diferente do slug
            h1.textContent = `${friendlyName} Coloring Page`;
        }
        h1.style.display = 'block';
    }
    
    // Atualizar meta description
    const metaDescription = document.getElementById('meta-description');
    const descriptionText = `Color online or download a free ${friendlyName} coloring page for kids. High-resolution drawing ready to print or color online. Fun and easy activity for children between 2 and 6 years old.`;
    if (metaDescription) {
        metaDescription.content = descriptionText;
    }
    
    // Atualizar Open Graph meta tags
    let ogTitle = document.getElementById('og-title');
    if (!ogTitle) {
        ogTitle = document.createElement('meta');
        ogTitle.id = 'og-title';
        ogTitle.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitle);
    }
    ogTitle.content = pageTitle;
    
    let ogDescription = document.getElementById('og-description');
    if (!ogDescription) {
        ogDescription = document.createElement('meta');
        ogDescription.id = 'og-description';
        ogDescription.setAttribute('property', 'og:description');
        document.head.appendChild(ogDescription);
    }
    ogDescription.content = descriptionText;
}

// Paleta de 24 cores para crianças
const COLOR_PALETTE = [
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
let canvas = null;
let ctx = null;
let image = null;
let imageData = null;
let originalImageData = null; // Armazena a ImageData original para preservar outlines
let container = null;
let resizeTimeout = null;
let drawing = null; // Armazena o desenho atual para uso em outras funções

// Função para calcular e ajustar o tamanho dos itens de cor
function adjustColorItemsSize() {
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
    const availableWidth = colorPalette.offsetWidth - palettePaddingLeft - palettePaddingRight; // 1.5rem left + 3rem right

    // Gap fixo de aproximadamente 20px (horizontal e vertical)
    const gapSize = 20;
    
    // Determinar número de colunas (3 para desktop, 6 para mobile)
    const isMobile = window.innerWidth <= 768;
    const columns = isMobile ? 6 : 3;
    const rows = Math.ceil(COLOR_PALETTE.length / columns);
    
    // Calcular espaço necessário para gaps
    const totalGapWidth = (columns - 1) * gapSize;
    const totalGapHeight = (rows - 1) * gapSize;
    
    // Calcular tamanho das células do grid (100% do espaço menos gaps)
    const cellWidth = (availableWidth - totalGapWidth) / columns;
    const cellHeight = (availableHeight - totalGapHeight) / rows;
    
    // Aplicar configuração ao grid
    colorGrid.style.gap = `${gapSize}px`;
    colorGrid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    colorGrid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    colorGrid.style.height = `${availableHeight}px`;
    colorGrid.style.width = `${availableWidth}px`;
    
    // Os itens já têm width: 100% e height: 100% no CSS
    // Eles vão preencher completamente as células do grid
    // Não precisamos definir tamanho manualmente
}

// Função para inicializar a paleta de cores
function initColorPalette() {
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

// Função para selecionar uma cor
function selectColor(color, element) {
    selectedColor = color;
    
    // Remover seleção anterior
    document.querySelectorAll('.color-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Adicionar seleção atual
    element.classList.add('selected');
}

// Função para converter cor hex para RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Função para comparar cores (com tolerância)
function colorsMatch(r1, g1, b1, r2, g2, b2, tolerance = 10) {
    return Math.abs(r1 - r2) <= tolerance &&
           Math.abs(g1 - g2) <= tolerance &&
           Math.abs(b1 - b2) <= tolerance;
}

// Função para verificar se um pixel é parte do outline original (preto na imagem original)
function isOriginalOutline(x, y, originalImageData, width) {
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

// Algoritmo de flood fill (preenchimento por área)
function floodFill(canvas, ctx, startX, startY, fillColor) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    // Validar coordenadas
    const x = Math.floor(startX);
    const y = Math.floor(startY);
    if (x < 0 || x >= width || y < 0 || y >= height) {
        console.log('Coordenadas inválidas:', { x, y, width, height });
        return;
    }
    
    // Obter cor do ponto inicial
    const startPos = (y * width + x) * 4;
    let startR = data[startPos];
    let startG = data[startPos + 1];
    let startB = data[startPos + 2];
    const startA = data[startPos + 3];
    
    console.log('Pixel inicial:', { x, y, r: startR, g: startG, b: startB, a: startA });
    
    // Verificar se o pixel clicado é parte do outline original
    const clickedOnOriginalOutline = isOriginalOutline(x, y, originalImageData, width);
    if (clickedOnOriginalOutline) {
        console.log('Clicou em outline original, ignorando preenchimento');
        return;
    }
    
    // Se o pixel é completamente transparente, tratar como branco (para imagens com transparência)
    // Isso permite que o flood fill funcione mesmo em imagens com fundo transparente
    if (startA === 0) {
        console.log('Pixel transparente detectado, tratando como branco');
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
    
    console.log('Cor de preenchimento:', fillRgb);
    
    // Se a cor inicial já é a cor de preenchimento, não fazer nada
    if (colorsMatch(startR, startG, startB, fillRgb.r, fillRgb.g, fillRgb.b, 5)) {
        console.log('Cor já é a mesma, ignorando');
        return;
    }
    
    // Usar fila para flood fill (mais eficiente que recursão)
    const queue = [[x, y]];
    const visited = new Set();
    const targetColor = { r: startR, g: startG, b: startB };
    
    // Tolerância para matching de cores (permite variações pequenas)
    const tolerance = 30;
    
    while (queue.length > 0) {
        const [px, py] = queue.shift();
        const key = `${px},${py}`;
        
        if (visited.has(key)) continue;
        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        
        // Pular pixels que são parte do outline original (não preencher outlines)
        if (isOriginalOutline(px, py, originalImageData, width)) {
            continue;
        }
        
        const pos = (py * width + px) * 4;
        const a = data[pos + 3];
        
        // Se o pixel é transparente, tratar como branco (mesma lógica do pixel inicial)
        let r = data[pos];
        let g = data[pos + 1];
        let b = data[pos + 2];
        if (a === 0) {
            r = 255;
            g = 255;
            b = 255;
        }
        
        // Verificar se é a cor que queremos substituir (com tolerância)
        if (!colorsMatch(r, g, b, targetColor.r, targetColor.g, targetColor.b, tolerance)) {
            continue;
        }
        
        // Preencher o pixel
        data[pos] = fillRgb.r;
        data[pos + 1] = fillRgb.g;
        data[pos + 2] = fillRgb.b;
        // Se o pixel era transparente, torná-lo opaco; caso contrário, manter alpha original
        data[pos + 3] = a === 0 ? 255 : a;
        
        visited.add(key);
        
        // Adicionar vizinhos à fila (4-direções)
        queue.push([px + 1, py]);
        queue.push([px - 1, py]);
        queue.push([px, py + 1]);
        queue.push([px, py - 1]);
    }
    
    console.log('Flood fill concluído. Pixels preenchidos:', visited.size);
    
    // Aplicar as mudanças
    ctx.putImageData(imageData, 0, 0);
}

// Função para redimensionar o canvas mantendo aspect ratio
function resizeCanvas() {
    if (!canvas || !image || !container) return;
    
    const containerRect = container.getBoundingClientRect();
    const containerPadding = 1 * 16; // 1rem em pixels (padding reduzido)
    const availableWidth = containerRect.width - (containerPadding * 2);
    const availableHeight = containerRect.height - (containerPadding * 2);
    
    // Calcular escala para manter aspect ratio e garantir que a imagem apareça inteira
    // Usar 95% do espaço disponível para dar uma pequena margem
    const usableWidth = availableWidth * 0.95;
    const usableHeight = availableHeight * 0.95;
    
    const imageAspectRatio = image.width / image.height;
    const containerAspectRatio = usableWidth / usableHeight;
    
    let displayWidth, displayHeight;
    
    if (imageAspectRatio > containerAspectRatio) {
        // Imagem é mais larga - usar toda a largura disponível
        displayWidth = usableWidth;
        displayHeight = displayWidth / imageAspectRatio;
    } else {
        // Imagem é mais alta - usar toda a altura disponível
        displayHeight = usableHeight;
        displayWidth = displayHeight * imageAspectRatio;
    }
    
    // Aplicar estilos
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
}

// Função para carregar e renderizar a imagem PNG
async function loadImage() {
    const category = getCategoryFromUrl();
    const drawingSlug = getDrawingFromUrl(); // Agora é um slug, não o nome do arquivo

    if (!category || !drawingSlug) {
        const container = document.getElementById('canvas-container');
        if (container) {
            // Limpar todos os elementos do container
            container.innerHTML = '';
            
            const errorMsg = document.createElement('p');
            errorMsg.textContent = 'Error: Category or drawing not specified.';
            container.appendChild(errorMsg);
        }
        return;
    }

    // Buscar desenho no banco de dados usando slug e categoria
    drawing = null;
    let imagePath = null;
    
    try {
        // Tentar buscar pelo slug (novo formato)
        drawing = await getDrawingBySlug(drawingSlug, category);
        
        if (drawing) {
            // Atualizar metadados da página com o nome amigável
            await updatePageMetadata(drawing);
            
            // Obter URL do desenho encontrado
            const imageUrl = getDrawingUrl(drawing);
            if (imageUrl) {
                imagePath = imageUrl;
            } else {
                // Fallback: construir caminho local
                const filename = typeof drawing === 'string' ? drawing : (drawing.filename || drawing);
                imagePath = `drawings/${category}/${filename}`;
            }
        } else {
            // Se não encontrou pelo slug, tentar formato antigo (compatibilidade)
            const imageUrlFromParams = getImageUrlFromUrl();
            if (imageUrlFromParams) {
                imagePath = imageUrlFromParams;
                // Tentar criar um desenho temporário para obter o nome amigável do slug
                if (drawingSlug) {
                    const tempDrawing = { filename: drawingSlug.replace(/-/g, '_') + '.png' };
                    await updatePageMetadata(tempDrawing);
                }
            } else {
                // Último fallback: usar slug como nome de arquivo (pode não funcionar)
                imagePath = `drawings/${category}/${drawingSlug}`;
                if (drawingSlug) {
                    const tempDrawing = { filename: drawingSlug.replace(/-/g, '_') + '.png' };
                    await updatePageMetadata(tempDrawing);
                }
            }
        }
    } catch (error) {
        console.error('Erro ao buscar desenho:', error);
        // Fallback para formato antigo
        const imageUrlFromParams = getImageUrlFromUrl();
        if (imageUrlFromParams) {
            imagePath = imageUrlFromParams;
            if (drawingSlug) {
                const tempDrawing = { filename: drawingSlug.replace(/-/g, '_') + '.png' };
                updatePageMetadata(tempDrawing);
            }
        } else {
            imagePath = `drawings/${category}/${drawingSlug}`;
            if (drawingSlug) {
                const tempDrawing = { filename: drawingSlug.replace(/-/g, '_') + '.png' };
                updatePageMetadata(tempDrawing);
            }
        }
    }
    
    // Se for URL do S3, usar proxy para evitar problemas de CORS
    if (isS3Url(imagePath)) {
        imagePath = getProxyUrl(imagePath);
    }
    
    container = document.getElementById('canvas-container');
    
    // Criar canvas
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Carregar imagem
    image = new Image();
    // Usar crossOrigin apenas se não for o proxy (que já tem CORS configurado)
    // Verificar se imagePath é uma URL do S3 (antes de passar pelo proxy)
    const originalImageUrl = drawing && getDrawingUrl(drawing);
    if (!originalImageUrl || !isS3Url(originalImageUrl)) {
        image.crossOrigin = 'anonymous';
    }
    
    image.onload = function() {
        // Usar as dimensões originais da imagem para o canvas
        canvas.width = image.width;
        canvas.height = image.height;
        
        // Preencher o canvas com branco antes de desenhar a imagem
        // Isso garante que não haja pixels transparentes que impeçam o flood fill
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Desenhar imagem no canvas com tamanho original
        ctx.drawImage(image, 0, 0);
        
        // Armazenar ImageData original para preservar outlines pretos
        originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Limpar todos os elementos do container
        container.innerHTML = '';
        
        container.appendChild(canvas);
        
        // Configurar modo de composição para melhor renderização
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Adicionar event listener para clique
        canvas.addEventListener('click', handleCanvasClick);
        
        console.log('Canvas criado e event listener adicionado', { 
            canvasWidth: canvas.width, 
            canvasHeight: canvas.height,
            imageWidth: image.width,
            imageHeight: image.height
        });
        
        // Aguardar um frame para garantir que o layout esteja calculado
        requestAnimationFrame(() => {
            // Calcular dimensões disponíveis no container
            const containerRect = container.getBoundingClientRect();
            const containerPadding = 1 * 16; // 1rem em pixels (padding reduzido)
            const availableWidth = containerRect.width - (containerPadding * 2);
            const availableHeight = containerRect.height - (containerPadding * 2);
            
            // Usar 95% do espaço disponível para dar uma pequena margem
            const usableWidth = availableWidth * 0.95;
            const usableHeight = availableHeight * 0.95;
            
            // Calcular escala para manter aspect ratio e garantir que a imagem apareça inteira
            const imageAspectRatio = image.width / image.height;
            const containerAspectRatio = usableWidth / usableHeight;
            
            let displayWidth, displayHeight;
            
            if (imageAspectRatio > containerAspectRatio) {
                // Imagem é mais larga - usar toda a largura disponível
                displayWidth = usableWidth;
                displayHeight = displayWidth / imageAspectRatio;
            } else {
                // Imagem é mais alta - usar toda a altura disponível
                displayHeight = usableHeight;
                displayWidth = displayHeight * imageAspectRatio;
            }
            
            // Aplicar estilos para redimensionamento responsivo
            canvas.style.cursor = 'pointer';
            canvas.style.display = 'block';
            canvas.style.width = `${displayWidth}px`;
            canvas.style.height = `${displayHeight}px`;
            canvas.style.maxWidth = '100%';
            canvas.style.maxHeight = '100%';
            canvas.style.objectFit = 'contain';
            
            // Adicionar listener para redimensionamento da janela (apenas uma vez)
            if (!window.canvasResizeListenerAdded) {
                window.addEventListener('resize', () => {
                    clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(() => {
                        requestAnimationFrame(() => {
                            resizeCanvas();
                        });
                    }, 100);
                });
                window.canvasResizeListenerAdded = true;
            }
        });
    };
    
    image.onerror = function() {
        // Limpar todos os elementos do container
        container.innerHTML = '';
        
        const errorMsg = document.createElement('p');
        errorMsg.textContent = 'Error loading image. Please check if the file exists.';
        container.appendChild(errorMsg);
    };
    
    image.src = imagePath;
}

// Função para lidar com cliques no canvas
function handleCanvasClick(e) {
    if (!canvas || !ctx) {
        console.error('Canvas ou contexto não disponível');
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    // Calcular escala entre o canvas real e o canvas renderizado
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Obter coordenadas do clique em relação ao canvas
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    console.log('Clique detectado:', { x, y, selectedColor, canvasSize: { width: canvas.width, height: canvas.height }, rectSize: { width: rect.width, height: rect.height } });
    
    // Aplicar flood fill
    floodFill(canvas, ctx, x, y, selectedColor);
}

// Função para atualizar link de voltar
function updateBackLink() {
    const category = getCategoryFromUrl();
    const backLink = document.getElementById('back-link');
    
    if (backLink && category) {
        backLink.href = getCategoryUrl(category);
    } else if (backLink) {
        backLink.href = '/category';
    }
}

// Função para fazer download da imagem
function downloadImage() {
    if (!canvas) {
        console.error('Canvas não disponível para download');
        return;
    }
    
    console.log('Iniciando download da imagem');
    
    // Converter canvas para blob
    canvas.toBlob((blob) => {
        if (!blob) {
            console.error('Erro ao converter canvas para blob');
            return;
        }
        
        // Criar URL temporária
        const url = URL.createObjectURL(blob);
        
        // Obter nome do arquivo da URL
        const category = getCategoryFromUrl();
        const drawingSlug = getDrawingFromUrl();
        
        // Tentar obter nome do arquivo do desenho encontrado
        let fileName = 'drawing';
        let extension = 'png';
        
        if (drawing) {
            const filename = typeof drawing === 'string' ? drawing : (drawing.filename || drawing);
            fileName = filename.replace(/\.[^/.]+$/, '');
            extension = filename.split('.').pop() || 'png';
        } else if (drawingSlug) {
            // Fallback: usar slug como nome
            fileName = drawingSlug.replace(/-/g, '_');
        }
        
        console.log('Nome do arquivo:', `${fileName}_colored.${extension}`);
        
        // Criar link de download
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${fileName}_colored.${extension}`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Limpar URL temporária
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }, 'image/png');
}

// Função para inicializar o botão de download
function initDownloadButton() {
    const downloadLink = document.getElementById('download-link');
    if (downloadLink) {
        // Remover event listeners anteriores se houver (usando onclick = null)
        downloadLink.onclick = null;
        
        downloadLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Download button clicked');
            downloadImage();
        });
        
        // Também adicionar como fallback usando onclick
        downloadLink.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Download button clicked (onclick)');
            downloadImage();
        };
    } else {
        console.error('Download link not found');
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('color-grid') && document.getElementById('canvas-container')) {
        updateBackLink();
        initColorPalette();
        initDownloadButton();
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

