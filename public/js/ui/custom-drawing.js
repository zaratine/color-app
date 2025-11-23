// UI - Formulário de desenho customizado

import { generateDrawing } from '../api/drawingsApi.js';
import { getPaintUrl } from '../utils/urlUtils.js';

/**
 * Mostra mensagem de status na interface
 * @param {HTMLElement} statusDiv - Elemento onde mostrar o status
 * @param {string} message - Mensagem a ser exibida
 * @param {string} type - Tipo de status ('loading', 'success', 'error')
 */
function showStatus(statusDiv, message, type) {
    if (!statusDiv) return;
    
    statusDiv.textContent = message;
    statusDiv.className = `generation-status ${type}`;
    
    if (type === 'success' || type === 'error') {
        // Limpar mensagem após alguns segundos
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'generation-status';
        }, 5000);
    }
}

/**
 * Trata mensagens de erro e retorna mensagens mais amigáveis
 * @param {Error} error - Objeto de erro
 * @returns {string} Mensagem de erro amigável
 */
function getErrorMessage(error) {
    let errorMessage = error.message;
    
    // Mensagens mais amigáveis para erros comuns
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = 'Connection error. Please check if the server is running.';
    } else if (errorMessage.includes('resposta inválida')) {
        errorMessage = 'Server error. Please check if the server is running and if the API is configured correctly.';
    }
    
    return errorMessage;
}

/**
 * Inicializa o formulário de desenho customizado
 */
function initCustomDrawingForm() {
    const form = document.getElementById('custom-drawing-form');
    const themeInput = document.getElementById('drawing-theme');
    const generateBtn = document.getElementById('generate-btn');
    const statusDiv = document.getElementById('generation-status');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const theme = themeInput.value.trim();
        if (!theme) {
            showStatus(statusDiv, 'Please enter a theme for the drawing.', 'error');
            return;
        }

        // Desabilitar botão e mostrar status
        generateBtn.disabled = true;
        generateBtn.textContent = '⏳ Generating...';
        showStatus(statusDiv, 'Generating your custom drawing... This may take a few seconds.', 'loading');

        try {
            const data = await generateDrawing(theme);

            // Sucesso - redirecionar para a página de pintura
            showStatus(statusDiv, '✅ Drawing generated successfully! Redirecting...', 'success');
            
            // Aguardar um pouco antes de redirecionar
            setTimeout(() => {
                // Usar URL do S3 se disponível, caso contrário usar caminho local
                window.location.href = getPaintUrl('customizados', data.filename, data.url || null);
            }, 1500);

        } catch (error) {
            console.error('Erro ao gerar desenho:', error);
            const errorMessage = getErrorMessage(error);
            showStatus(statusDiv, `❌ Error: ${errorMessage}`, 'error');
            generateBtn.disabled = false;
            generateBtn.textContent = '🎨 Generate Drawing';
        }
    });
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    initCustomDrawingForm();
});

