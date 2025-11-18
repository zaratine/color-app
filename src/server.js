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

// Middleware para logar requisições de arquivos estáticos (debug)
app.use((req, res, next) => {
    // Logar apenas requisições para arquivos estáticos
    if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
        console.log(`📄 Requisição para arquivo estático: ${req.method} ${req.path}`);
    }
    next();
});

// Servir arquivos estáticos da pasta public (ANTES das rotas HTML)
// Isso garante que CSS, JS, imagens sejam servidos corretamente
const staticOptions = {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    },
    // Fallthrough: se o arquivo não existir, passar para o próximo middleware
    fallthrough: true
};

// Logar informações sobre o diretório público
const fs = require('fs');
const path = require('path');
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
