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

// Servir arquivos estáticos da pasta public (ANTES das rotas HTML)
// Isso garante que CSS, JS, imagens sejam servidos corretamente
// Usar caminho absoluto para garantir que funcione no Vercel
const staticOptions = {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
};

// Log para debug (apenas em desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
    console.log('📁 Servindo arquivos estáticos de:', PUBLIC_DIR);
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
