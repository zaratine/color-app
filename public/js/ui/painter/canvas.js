// Painter - Módulo de gerenciamento do canvas

import { getCategoryFromUrl, getDrawingFromUrl, getCategoryUrl, getImageUrlFromUrl, getProxyUrl, isS3Url, getDrawingBySlug } from '../../utils/urlUtils.js';
import { getDrawingUrl, getDrawingFilename } from '../../services/drawingsService.js';
import { getFriendlyName } from '../../utils/stringUtils.js';
import { floodFill } from './floodFill.js';
import { getSelectedColor } from './colorPalette.js';
import { initDownloadButton, initDownloadBlankButton } from './download.js';

let canvas = null;
let ctx = null;
let image = null;
let originalImageData = null;
let container = null;
let resizeTimeout = null;
let drawing = null;

/**
 * Obtém o desenho atual
 * @returns {Object|null} Desenho atual
 */
export function getCurrentDrawing() {
    return drawing;
}

/**
 * Obtém o canvas atual
 * @returns {HTMLCanvasElement|null} Canvas atual
 */
export function getCanvas() {
    return canvas;
}

/**
 * Função para redimensionar o canvas mantendo aspect ratio
 */
function resizeCanvas() {
    if (!canvas || !image || !container) return;
    
    const containerRect = container.getBoundingClientRect();
    const containerPadding = 1 * 16;
    const availableWidth = containerRect.width - (containerPadding * 2);
    const availableHeight = containerRect.height - (containerPadding * 2);
    
    const usableWidth = availableWidth * 0.95;
    const usableHeight = availableHeight * 0.95;
    
    const imageAspectRatio = image.width / image.height;
    const containerAspectRatio = usableWidth / usableHeight;
    
    let displayWidth, displayHeight;
    
    if (imageAspectRatio > containerAspectRatio) {
        displayWidth = usableWidth;
        displayHeight = displayWidth / imageAspectRatio;
    } else {
        displayHeight = usableHeight;
        displayWidth = displayHeight * imageAspectRatio;
    }
    
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
}

/**
 * Função para lidar com cliques no canvas
 * @param {MouseEvent} e - Evento de clique
 */
function handleCanvasClick(e) {
    if (!canvas || !ctx) {
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    // Aplicar flood fill
    floodFill(canvas, ctx, x, y, getSelectedColor(), originalImageData);
}

/**
 * Função para carregar e renderizar a imagem
 */
export async function loadImage() {
    const category = getCategoryFromUrl();
    const drawingSlug = getDrawingFromUrl();

    if (!category || !drawingSlug) {
        container = document.getElementById('canvas-container');
        if (container) {
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
        drawing = await getDrawingBySlug(drawingSlug, category);
        
        if (drawing) {
            const imageUrl = getDrawingUrl(drawing);
            if (imageUrl) {
                imagePath = imageUrl;
            } else {
                const filename = typeof drawing === 'string' ? drawing : (drawing.filename || drawing);
                imagePath = `drawings/${category}/${filename}`;
            }
        } else {
            const imageUrlFromParams = getImageUrlFromUrl();
            if (imageUrlFromParams) {
                imagePath = imageUrlFromParams;
            } else {
                imagePath = `drawings/${category}/${drawingSlug}`;
            }
        }
    } catch (error) {
        console.error('Erro ao buscar desenho:', error);
        const imageUrlFromParams = getImageUrlFromUrl();
        if (imageUrlFromParams) {
            imagePath = imageUrlFromParams;
        } else {
            imagePath = `drawings/${category}/${drawingSlug}`;
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
    const originalImageUrl = drawing && getDrawingUrl(drawing);
    if (!originalImageUrl || !isS3Url(originalImageUrl)) {
        image.crossOrigin = 'anonymous';
    }
    
    image.onload = function() {
        canvas.width = image.width;
        canvas.height = image.height;
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
        
        originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        container.innerHTML = '';
        container.appendChild(canvas);
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        canvas.addEventListener('click', handleCanvasClick);
        
        requestAnimationFrame(() => {
            const containerRect = container.getBoundingClientRect();
            const containerPadding = 1 * 16;
            const availableWidth = containerRect.width - (containerPadding * 2);
            const availableHeight = containerRect.height - (containerPadding * 2);
            
            const usableWidth = availableWidth * 0.95;
            const usableHeight = availableHeight * 0.95;
            
            const imageAspectRatio = image.width / image.height;
            const containerAspectRatio = usableWidth / usableHeight;
            
            let displayWidth, displayHeight;
            
            if (imageAspectRatio > containerAspectRatio) {
                displayWidth = usableWidth;
                displayHeight = displayWidth / imageAspectRatio;
            } else {
                displayHeight = usableHeight;
                displayWidth = displayHeight * imageAspectRatio;
            }
            
            canvas.style.cursor = 'pointer';
            canvas.style.display = 'block';
            canvas.style.width = `${displayWidth}px`;
            canvas.style.height = `${displayHeight}px`;
            canvas.style.maxWidth = '100%';
            canvas.style.maxHeight = '100%';
            canvas.style.objectFit = 'contain';
            
            // Inicializar botões de download após o canvas estar pronto
            initDownloadButton(canvas, drawing);
            initDownloadBlankButton(drawing);
            
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
        container.innerHTML = '';
        const errorMsg = document.createElement('p');
        errorMsg.textContent = 'Error loading image. Please check if the file exists.';
        container.appendChild(errorMsg);
    };
    
    image.src = imagePath;
}

/**
 * Função para atualizar link de voltar
 */
export function updateBackLink() {
    const category = getCategoryFromUrl();
    const backLink = document.getElementById('back-link');
    
    if (backLink && category) {
        backLink.href = getCategoryUrl(category);
    } else if (backLink) {
        backLink.href = '/';
    }
}

