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

// Rotas estáticas (HTML pages)
app.use('/', staticRoutes);

// Servir arquivos estáticos da pasta public
// Adicionar headers para evitar cache de arquivos JavaScript em desenvolvimento
app.use(express.static(PUBLIC_DIR, {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// Iniciar servidor
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
