#!/usr/bin/env node

// Servidor Express - ponto de entrada principal
const express = require('express');
const { PORT, DRAWINGS_DIR, PUBLIC_DIR, apiKey } = require('./config');
const requestLogger = require('./middleware/logger');
const corsMiddleware = require('./middleware/cors');
const apiRoutes = require('./routes/apiRoutes');
const staticRoutes = require('./routes/staticRoutes');

// Inicializar Express
const app = express();

// Middleware para parsing JSON
app.use(express.json());

// Middleware para log de requisições
app.use(requestLogger);

// Middleware CORS para rotas da API
app.use('/api', corsMiddleware);

// Rotas da API (antes do static para ter prioridade)
app.use('/api', apiRoutes);

// Middleware customizado para servir arquivos estáticos como raw files
// Isso garante que arquivos JS não sejam transpilados pelo Vercel
const fs = require('fs');
const path = require('path');

// Logar informações sobre o diretório público
console.log('📁 Configuração de arquivos estáticos:');
console.log('  PUBLIC_DIR:', PUBLIC_DIR);
console.log('  PUBLIC_DIR existe?', fs.existsSync(PUBLIC_DIR));

if (fs.existsSync(PUBLIC_DIR)) {
    try {
        const files = fs.readdirSync(PUBLIC_DIR);
        console.log('  Arquivos em public:', files.slice(0, 5).join(', '), files.length > 5 ? '...' : '');
        
        // Verificar se styles existe
        const stylesPath = path.join(PUBLIC_DIR, 'styles');
        if (fs.existsSync(stylesPath)) {
            const styleFiles = fs.readdirSync(stylesPath);
            console.log('  Arquivos em styles:', styleFiles.join(', '));
        }
    } catch (error) {
        console.error('  Erro ao ler public:', error.message);
    }
}

// Middleware para servir arquivos estáticos diretamente do filesystem
// Isso evita qualquer processamento/transpilação pelo Vercel
app.use((req, res, next) => {
    // Verificar se é um arquivo estático
    const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.json'];
    const isStaticFile = staticExtensions.some(ext => req.path.endsWith(ext));
    
    if (isStaticFile) {
        const filePath = path.join(PUBLIC_DIR, req.path);
        
        // Verificar se o arquivo existe
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            console.log(`📄 Servindo arquivo estático: ${req.path}`);
            
            // Ler arquivo diretamente do filesystem (raw, sem processamento)
            const fileContent = fs.readFileSync(filePath);
            
            // Determinar Content-Type
            let contentType = 'application/octet-stream';
            if (req.path.endsWith('.js')) {
                contentType = 'application/javascript; charset=utf-8';
            } else if (req.path.endsWith('.css')) {
                contentType = 'text/css; charset=utf-8';
            } else if (req.path.endsWith('.json')) {
                contentType = 'application/json; charset=utf-8';
            } else if (req.path.endsWith('.svg')) {
                contentType = 'image/svg+xml';
            } else if (req.path.endsWith('.png')) {
                contentType = 'image/png';
            } else if (req.path.endsWith('.jpg') || req.path.endsWith('.jpeg')) {
                contentType = 'image/jpeg';
            } else if (req.path.endsWith('.gif')) {
                contentType = 'image/gif';
            } else if (req.path.endsWith('.ico')) {
                contentType = 'image/x-icon';
            }
            
            // Headers para evitar cache e garantir tipo correto
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            // Enviar arquivo
            return res.send(fileContent);
        }
    }
    
    // Se não for arquivo estático ou não existir, passar para o próximo middleware
    next();
});

// Usar express.static como fallback (para outros arquivos que não foram capturados acima)
const staticOptions = {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
        }
    },
    fallthrough: true,
    index: false
};

app.use(express.static(PUBLIC_DIR, staticOptions));

// Rotas estáticas (HTML pages) - DEPOIS do static para não interceptar arquivos estáticos
app.use('/', staticRoutes);

// Exportar app para Vercel (serverless)
module.exports = app;

// Iniciar servidor apenas se não estiver no Vercel
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
        console.log(`📁 Desenhos sendo lidos de: ${DRAWINGS_DIR}`);
        
        if (!apiKey || apiKey === 'sua-chave-aqui') {
            console.log(`⚠️  AVISO: OPENAI_API_KEY não configurada.`);
            console.log(`   Por favor, edite o arquivo config.js e adicione sua chave da API.`);
            console.log(`   Obtenha sua chave em: https://platform.openai.com/api-keys`);
        } else {
            console.log(`✅ OpenAI API configurada`);
        }
        
        console.log(`\n✨ Acesse http://localhost:${PORT} no navegador\n`);
    });
}
