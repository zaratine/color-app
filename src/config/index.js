// Configurações do servidor
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Carregar configurações (opcional - variáveis de ambiente têm prioridade)
let config = {};
try {
    config = require('../../config.js');
} catch (error) {
    // config.js é opcional se variáveis de ambiente estiverem configuradas
    if (process.env.NODE_ENV !== 'production') {
        console.log('ℹ️  Arquivo config.js não encontrado. Usando variáveis de ambiente ou valores padrão.');
    }
}

// Constantes de configuração
// Prioridade: variável de ambiente > config.js > valor padrão
const PORT = process.env.PORT || config.PORT || 8000;
const DRAWINGS_DIR = path.resolve(__dirname, '..', '..', 'public', 'drawings');
const CUSTOM_DIR = path.resolve(__dirname, '..', '..', 'public', 'drawings', 'customizados');
const PUBLIC_DIR = path.resolve(__dirname, '..', '..', 'public');

// Inicializar OpenAI
// Prioridade: variável de ambiente > config.js
const apiKey = process.env.OPENAI_API_KEY || config.OPENAI_API_KEY;
const openai = new OpenAI({
    apiKey: apiKey
});

// Garantir que a pasta customizados existe
if (!fs.existsSync(CUSTOM_DIR)) {
    fs.mkdirSync(CUSTOM_DIR, { recursive: true });
    console.log('📁 Pasta customizados criada');
}

module.exports = {
    config,
    PORT,
    DRAWINGS_DIR,
    CUSTOM_DIR,
    PUBLIC_DIR,
    openai,
    apiKey
};

