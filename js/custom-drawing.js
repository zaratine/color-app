// Gerenciamento de desenhos customizados gerados pela OpenAI

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('custom-drawing-form');
    const themeInput = document.getElementById('drawing-theme');
    const generateBtn = document.getElementById('generate-btn');
    const statusDiv = document.getElementById('generation-status');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const theme = themeInput.value.trim();
        if (!theme) {
            showStatus('Por favor, digite um tema para o desenho.', 'error');
            return;
        }

        // Desabilitar botão e mostrar status
        generateBtn.disabled = true;
        generateBtn.textContent = '⏳ Gerando...';
        showStatus('Gerando seu desenho personalizado... Isso pode levar alguns segundos.', 'loading');

        try {
            const response = await fetch('/api/generate-drawing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ theme: theme })
            });

            // Verificar se a resposta é JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Resposta não é JSON:', text);
                throw new Error('Servidor retornou uma resposta inválida. Verifique se o servidor está rodando corretamente.');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao gerar desenho');
            }

            // Sucesso - redirecionar para a página de pintura
            showStatus('✅ Desenho gerado com sucesso! Redirecionando...', 'success');
            
            // Aguardar um pouco antes de redirecionar
            setTimeout(() => {
                window.location.href = `paint.html?cat=customizados&drawing=${encodeURIComponent(data.filename)}`;
            }, 1500);

        } catch (error) {
            console.error('Erro ao gerar desenho:', error);
            let errorMessage = error.message;
            
            // Mensagens mais amigáveis para erros comuns
            if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
                errorMessage = 'Erro de conexão. Verifique se o servidor está rodando.';
            } else if (errorMessage.includes('resposta inválida')) {
                errorMessage = 'Erro no servidor. Verifique se o servidor está rodando e se a API está configurada corretamente.';
            }
            
            showStatus(`❌ Erro: ${errorMessage}`, 'error');
            generateBtn.disabled = false;
            generateBtn.textContent = '🎨 Gerar Desenho';
        }
    });

    function showStatus(message, type) {
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
});

