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
        errorMessage = 'Erro de conexão. Verifique se o servidor está rodando.';
    } else if (errorMessage.includes('resposta inválida')) {
        errorMessage = 'Erro no servidor. Verifique se o servidor está rodando e se a API está configurada corretamente.';
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
            showStatus(statusDiv, 'Por favor, digite um tema para o desenho.', 'error');
            return;
        }

        // Desabilitar botão e mostrar status
        generateBtn.disabled = true;
        generateBtn.textContent = '⏳ Gerando...';
        showStatus(statusDiv, 'Gerando seu desenho personalizado... Isso pode levar alguns segundos.', 'loading');

        try {
            const data = await generateDrawing(theme);

            // Sucesso - redirecionar para a página de pintura
            showStatus(statusDiv, '✅ Desenho gerado com sucesso! Redirecionando...', 'success');
            
            // Aguardar um pouco antes de redirecionar
            setTimeout(() => {
                window.location.href = getPaintUrl('customizados', data.filename);
            }, 1500);

        } catch (error) {
            console.error('Erro ao gerar desenho:', error);
            const errorMessage = getErrorMessage(error);
            showStatus(statusDiv, `❌ Erro: ${errorMessage}`, 'error');
            generateBtn.disabled = false;
            generateBtn.textContent = '🎨 Gerar Desenho';
        }
    });
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    initCustomDrawingForm();
});

