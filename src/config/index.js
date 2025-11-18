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

// Resolver caminhos - no Vercel, pode ser necessário usar process.cwd()
// Tentar múltiplos caminhos possíveis
function resolvePublicDir() {
    // Tentar caminho relativo ao __dirname primeiro
    const dirnamePath = path.resolve(__dirname, '..', '..', 'public');
    if (fs.existsSync(dirnamePath)) {
        return dirnamePath;
    }
    
    // Tentar caminho relativo ao process.cwd()
    const cwdPath = path.resolve(process.cwd(), 'public');
    if (fs.existsSync(cwdPath)) {
        return cwdPath;
    }
    
    // Tentar caminho absoluto no Vercel
    const vercelPath = path.resolve('/var/task/public');
    if (fs.existsSync(vercelPath)) {
        return vercelPath;
    }
    
    // Fallback para o caminho original
    return dirnamePath;
}

const PUBLIC_DIR = resolvePublicDir();
const DRAWINGS_DIR = path.join(PUBLIC_DIR, 'drawings');
const CUSTOM_DIR = path.join(PUBLIC_DIR, 'drawings', 'customizados');

// Log para debug
console.log('🔍 Resolvendo caminhos:');
console.log('  __dirname:', __dirname);
console.log('  process.cwd():', process.cwd());
console.log('  PUBLIC_DIR:', PUBLIC_DIR);
console.log('  PUBLIC_DIR existe?', fs.existsSync(PUBLIC_DIR));

// Inicializar OpenAI
// Prioridade: variável de ambiente > config.js
const apiKey = process.env.OPENAI_API_KEY || config.OPENAI_API_KEY;
const openai = new OpenAI({
    apiKey: apiKey
});

// Garantir que a pasta customizados existe (apenas em ambientes com sistema de arquivos writable)
// No Vercel/serverless, o sistema de arquivos é read-only, então pulamos essa operação
try {
    if (!fs.existsSync(CUSTOM_DIR)) {
        fs.mkdirSync(CUSTOM_DIR, { recursive: true });
        console.log('📁 Pasta customizados criada');
    }
} catch (error) {
    // Em ambientes serverless (Vercel), o sistema de arquivos pode ser read-only
    // Isso é esperado e não é um erro crítico
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        console.log('ℹ️  Sistema de arquivos read-only detectado (ambiente serverless). Pasta customizados não será criada.');
    } else {
        console.warn('⚠️  Não foi possível criar a pasta customizados:', error.message);
    }
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

