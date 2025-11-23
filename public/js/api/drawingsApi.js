// API - Todas as chamadas HTTP ao backend

/**
 * Busca todos os desenhos e categorias do servidor
 * @returns {Promise<Object>} Objeto com as categorias e desenhos
 */
export async function fetchDrawings() {
    try {
        console.log('🌐 Fazendo requisição para /api/drawings...');
        const response = await fetch('/api/drawings');
        console.log('🌐 Resposta recebida:', response.status, response.statusText);
        
        if (response.ok) {
            const data = await response.json();
            console.log('🌐 Dados recebidos:', Object.keys(data), 'categorias');
            return data;
        }
        
        const errorText = await response.text();
        console.error('🌐 Erro na resposta:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
        console.error('🌐 Erro ao carregar desenhos da API:', error);
        throw error;
    }
}

/**
 * Gera um novo desenho customizado via OpenAI
 * @param {string} theme - Tema do desenho a ser gerado
 * @returns {Promise<Object>} Objeto com filename e outros dados do desenho gerado
 */
export async function generateDrawing(theme) {
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
            throw new Error('Server returned an invalid response. Please check if the server is running correctly.');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error generating drawing');
        }

        return data;
    } catch (error) {
        console.error('Erro ao gerar desenho:', error);
        throw error;
    }
}

