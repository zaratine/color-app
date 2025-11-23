#!/usr/bin/env node

// Servidor Express - ponto de entrada principal
const express = require('express');
const { execSync } = require('child_process');
const { PORT, DRAWINGS_DIR, PUBLIC_DIR, apiKey } = require('./config');
const requestLogger = require('./middleware/logger');
const corsMiddleware = require('./middleware/cors');
const apiRoutes = require('./routes/apiRoutes');
const staticRoutes = require('./routes/staticRoutes');

// Função para liberar a porta se estiver em uso (útil para nodemon)
function killProcessOnPort(port) {
    // Primeiro, matar processos nodemon órfãos (exceto o atual e o pai)
    try {
        // Usar ps e grep para encontrar processos nodemon
        const psOutput = execSync(`ps aux | grep "[n]odemon.*server.js"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const lines = psOutput.trim().split('\n').filter(line => line.trim());
        const nodemonPids = lines
            .map(line => line.trim().split(/\s+/)[1]) // Extrair PID (segunda coluna)
            .filter(pid => pid && pid !== process.pid.toString() && pid !== process.ppid.toString());
        
        if (nodemonPids.length > 0) {
            console.log(`🔧 Encerrando ${nodemonPids.length} processo(s) nodemon órfão(s)...`);
            for (const pid of nodemonPids) {
                try {
                    execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
                } catch (error) {
                    // Processo pode já ter sido encerrado
                }
            }
        }
    } catch (error) {
        // Nenhum processo nodemon encontrado, tudo bem
    }
    
    // Depois, matar processos node na porta específica (servidores antigos)
    try {
        const output = execSync(`lsof -ti:${port}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const pids = output
            .trim()
            .split('\n')
            .filter(pid => pid && pid !== process.pid.toString() && pid !== process.ppid.toString());
        
        if (pids.length > 0) {
            console.log(`🔧 Encerrando ${pids.length} processo(s) antigo(s) na porta ${port}...`);
            for (const pid of pids) {
                try {
                    execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
                } catch (error) {
                    // Processo pode já ter sido encerrado
                }
            }
        }
    } catch (error) {
        // Nenhum processo encontrado na porta, tudo bem
    }
}

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
    // Liberar porta antes de iniciar (importante para nodemon)
    killProcessOnPort(PORT);
    
    // Aguardar um pouco para garantir que a porta foi liberada
    // Usar setImmediate para garantir que a porta foi liberada antes de tentar iniciar
    setImmediate(() => {
        const server = app.listen(PORT, () => {
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

    // Tratamento de erros no servidor
    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`\n❌ Erro: Porta ${PORT} ainda está em uso!`);
            console.error(`   Tentando encerrar processos novamente...`);
            killProcessOnPort(PORT);
            console.error(`   Aguarde alguns segundos e o nodemon tentará novamente.`);
            console.error(`   Ou execute manualmente: npm run kill-port\n`);
            // Não fazer exit aqui, deixar o nodemon tentar novamente
            setTimeout(() => process.exit(1), 2000);
        } else {
            console.error('❌ Erro ao iniciar servidor:', error);
            process.exit(1);
        }
    });

    // Handlers para encerramento limpo (importante para nodemon)
    const gracefulShutdown = (signal) => {
        console.log(`\n🛑 Recebido ${signal}. Encerrando servidor...`);
        server.close(() => {
            console.log('✅ Servidor encerrado corretamente.');
            process.exit(0);
        });

        // Forçar encerramento após 10 segundos
        setTimeout(() => {
            console.error('⚠️  Forçando encerramento do servidor...');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Tratamento de erros não capturados
    process.on('uncaughtException', (error) => {
        console.error('❌ Erro não capturado:', error);
        gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ Promise rejeitada não tratada:', reason);
        gracefulShutdown('unhandledRejection');
    });
    });
}
