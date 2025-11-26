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

// Armazenar a cor atual do cursor
let currentCursorColor = null;
let customCursorElement = null;
let isMouseOverCanvas = false;

/**
 * Cria o elemento de cursor visual customizado
 * Gota de tinta ao lado do cursor oficial para indicar a cor selecionada
 */
function createCustomCursorElement() {
    if (customCursorElement) return;
    
    // Container da gota
    customCursorElement = document.createElement('div');
    customCursorElement.id = 'custom-color-cursor';
    customCursorElement.style.cssText = `
        position: fixed;
        width: 14px;
        height: 18px;
        pointer-events: none;
        z-index: 99999;
        transform: translate(10px, 4px);
        display: none;
    `;
    
    // A gota em si - usando clip-path para forma perfeita
    const drop = document.createElement('div');
    drop.id = 'color-drop';
    drop.style.cssText = `
        width: 100%;
        height: 100%;
        clip-path: path('M7 0 C7 0, 14 10, 14 13 C14 16, 11 18, 7 18 C3 18, 0 16, 0 13 C0 10, 7 0, 7 0 Z');
        box-shadow: inset 2px 2px 4px rgba(255,255,255,0.4);
        transition: background-color 0.1s ease;
        filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.3));
    `;
    
    customCursorElement.appendChild(drop);
    document.body.appendChild(customCursorElement);
}

/**
 * Atualiza a posição do cursor visual
 */
function updateCursorPosition(e) {
    if (!customCursorElement || !isMouseOverCanvas) return;
    customCursorElement.style.left = e.clientX + 'px';
    customCursorElement.style.top = e.clientY + 'px';
}

/**
 * Mostra o cursor visual customizado
 * O cursor oficial do sistema continua visível
 */
function showCustomCursor() {
    if (!customCursorElement) return;
    isMouseOverCanvas = true;
    customCursorElement.style.display = 'block';
}

/**
 * Esconde o cursor visual customizado
 */
function hideCustomCursor() {
    if (!customCursorElement) return;
    isMouseOverCanvas = false;
    customCursorElement.style.display = 'none';
}

/**
 * Atualiza o cursor do canvas para mostrar a cor selecionada
 * Usa uma gota de tinta que segue o mouse (funciona em todos os navegadores, incluindo Arc)
 * @param {string} color - Cor em formato hex
 */
export function updateCanvasCursor(color) {
    if (!canvas) return;
    
    currentCursorColor = color;
    
    // Criar elemento de cursor se não existir
    createCustomCursorElement();
    
    // Atualizar a cor da gota
    const drop = document.getElementById('color-drop');
    if (drop) {
        drop.style.backgroundColor = color;
    }
}

/**
 * Inicializa os event listeners para o cursor visual
 */
function initCursorListeners() {
    if (!canvas) return;
    
    // Criar cursor visual
    createCustomCursorElement();
    
    // Eventos do canvas
    canvas.addEventListener('mouseenter', showCustomCursor);
    canvas.addEventListener('mouseleave', hideCustomCursor);
    canvas.addEventListener('mousemove', updateCursorPosition);
    
    // Evento global para atualizar posição mesmo durante movimento rápido
    document.addEventListener('mousemove', (e) => {
        if (isMouseOverCanvas) {
            updateCursorPosition(e);
        }
    });
}

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
        
        // Inicializar cursor visual customizado (funciona em todos os navegadores, incluindo Arc)
        initCursorListeners();
        
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
            
            canvas.style.display = 'block';
            canvas.style.width = `${displayWidth}px`;
            canvas.style.height = `${displayHeight}px`;
            canvas.style.maxWidth = '100%';
            canvas.style.maxHeight = '100%';
            canvas.style.objectFit = 'contain';
            
            // Definir cursor com a cor inicial
            updateCanvasCursor(getSelectedColor());
            
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

