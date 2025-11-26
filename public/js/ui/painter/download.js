// Painter - Módulo de download de imagens

import { getCategoryFromUrl, getDrawingFromUrl, isS3Url } from '../../utils/urlUtils.js';
import { getDrawingUrl, getDrawingFilename } from '../../services/drawingsService.js';

/**
 * Função para fazer download da imagem pintada
 * @param {HTMLCanvasElement} canvas - Canvas com o desenho pintado
 * @param {Object} drawing - Objeto do desenho atual
 */
export function downloadImage(canvas, drawing) {
    if (!canvas) {
        console.error('Canvas não disponível para download');
        return;
    }
    
    // Obter nome do arquivo da URL
    const drawingSlug = getDrawingFromUrl();
    
    // Tentar obter nome do arquivo do desenho encontrado
    let fileName = 'drawing';
    let extension = 'png';
    let mimeType = 'image/png';
    
    if (drawing) {
        const filename = typeof drawing === 'string' ? drawing : (drawing.filename || drawing);
        fileName = filename.replace(/\.[^/.]+$/, '');
        const originalExt = filename.split('.').pop()?.toLowerCase() || 'png';
        
        // Determinar formato baseado na extensão original
        if (originalExt === 'webp') {
            extension = 'webp';
            mimeType = 'image/webp';
        } else {
            extension = 'png';
            mimeType = 'image/png';
        }
    } else if (drawingSlug) {
        // Fallback: usar slug como nome
        fileName = drawingSlug.replace(/-/g, '_');
    }
    
    // Verificar se o navegador suporta WebP antes de tentar exportar
    const supportsWebP = mimeType === 'image/webp' && 
        (() => {
            const testCanvas = document.createElement('canvas');
            testCanvas.width = 1;
            testCanvas.height = 1;
            return testCanvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
        })();
    
    // Se WebP não for suportado, usar PNG como fallback
    if (mimeType === 'image/webp' && !supportsWebP) {
        extension = 'png';
        mimeType = 'image/png';
    }
    
    // Converter canvas para blob no formato apropriado
    canvas.toBlob((blob) => {
        if (!blob) {
            console.error('Erro ao converter canvas para blob');
            return;
        }
        
        // Criar URL temporária
        const url = URL.createObjectURL(blob);
        
        // Criar link de download
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${fileName}_colored.${extension}`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Limpar URL temporária
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }, mimeType);
}

/**
 * Função para fazer download da imagem original do S3
 * @param {Object} drawing - Objeto do desenho atual
 */
export async function downloadOriginalImage(drawing) {
    if (!drawing) {
        console.error('Desenho não disponível para download');
        return;
    }
    
    // Obter URL original do desenho
    const originalImageUrl = getDrawingUrl(drawing);
    
    if (!originalImageUrl) {
        console.error('URL original não disponível');
        alert('Imagem original não disponível para download');
        return;
    }
    
    // Se for URL do S3, usar proxy para fazer o download
    let downloadUrl = originalImageUrl;
    if (isS3Url(originalImageUrl)) {
        downloadUrl = `/api/proxy-image?url=${encodeURIComponent(originalImageUrl)}`;
    }
    
    // Obter nome do arquivo
    const filename = typeof drawing === 'string' ? drawing : (drawing.filename || drawing);
    let fileName = filename.replace(/\.[^/.]+$/, '');
    const extension = filename.split('.').pop()?.toLowerCase() || 'png';
    
    try {
        // Fazer fetch da imagem
        const response = await fetch(downloadUrl);
        if (!response.ok) {
            throw new Error(`Erro ao baixar imagem: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        
        // Criar URL temporária
        const url = URL.createObjectURL(blob);
        
        // Criar link de download
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${fileName}.${extension}`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Limpar URL temporária
        setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
        console.error('Erro ao baixar imagem original:', error);
        alert('Erro ao baixar imagem original. Por favor, tente novamente.');
    }
}

/**
 * Função para inicializar o botão de download
 * @param {HTMLCanvasElement} canvas - Canvas com o desenho
 * @param {Object} drawing - Objeto do desenho
 */
export function initDownloadButton(canvas, drawing) {
    const downloadLink = document.getElementById('download-link');
    if (downloadLink) {
        // Remover event listeners anteriores
        downloadLink.onclick = null;
        const newDownloadLink = downloadLink.cloneNode(true);
        downloadLink.parentNode.replaceChild(newDownloadLink, downloadLink);
        
        newDownloadLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            downloadImage(canvas, drawing);
        });
    }
}

/**
 * Função para inicializar o botão de download blank
 * @param {Object} drawing - Objeto do desenho
 */
export function initDownloadBlankButton(drawing) {
    const downloadBlankLink = document.getElementById('download-blank-link');
    if (downloadBlankLink) {
        // Remover event listeners anteriores
        downloadBlankLink.onclick = null;
        const newDownloadBlankLink = downloadBlankLink.cloneNode(true);
        downloadBlankLink.parentNode.replaceChild(newDownloadBlankLink, downloadBlankLink);
        
        newDownloadBlankLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            downloadOriginalImage(drawing);
        });
    }
}

