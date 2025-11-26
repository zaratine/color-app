// UI - Formulário de desenho customizado

import { generateDrawing } from '../api/drawingsApi.js';
import { getPaintUrl } from '../utils/urlUtils.js';

/**
 * Mostra overlay de loading
 * @param {HTMLElement} overlay - Elemento overlay
 * @param {string} message - Mensagem a ser exibida
 */
function showLoading(overlay, message) {
    if (!overlay) return;
    
    const messageEl = overlay.querySelector('.overlay-message');
    if (messageEl && message) {
        messageEl.textContent = message;
    }
    overlay.classList.add('active');
}

/**
 * Esconde overlay de loading
 * @param {HTMLElement} overlay - Elemento overlay
 */
function hideLoading(overlay) {
    if (!overlay) return;
    overlay.classList.remove('active');
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
    const overlay = document.getElementById('generation-overlay');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const theme = themeInput.value.trim();
        if (!theme) {
            themeInput.placeholder = '⚠️ Please enter a theme for the drawing...';
            themeInput.focus();
            setTimeout(() => {
                themeInput.placeholder = '✨ Describe what you want to paint and AI will create it (e.g., a cat, a princess, a car...)';
            }, 3000);
            return;
        }

        // Mostrar overlay de loading
        generateBtn.disabled = true;
        showLoading(overlay, 'Generating your drawing. This can take up to 15 seconds.');

        try {
            const data = await generateDrawing(theme);

            // Sucesso - atualizar mensagem e redirecionar
            showLoading(overlay, '✅ Drawing ready! Redirecting...');
            
            // Aguardar um pouco antes de redirecionar
            setTimeout(() => {
                // Usar URL do S3 se disponível, caso contrário usar caminho local
                window.location.href = getPaintUrl('customizados', data.filename, data.url || null);
            }, 1000);

        } catch (error) {
            console.error('Erro ao gerar desenho:', error);
            const errorMessage = getErrorMessage(error);
            
            // Esconder overlay e mostrar erro no placeholder
            hideLoading(overlay);
            generateBtn.disabled = false;
            themeInput.value = '';
            themeInput.placeholder = `❌ ${errorMessage}`;
            themeInput.focus();
            
            setTimeout(() => {
                themeInput.placeholder = '✨ Describe what you want to paint and AI will create it (e.g., a cat, a princess, a car...)';
            }, 5000);
        }
    });
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    initCustomDrawingForm();
});

