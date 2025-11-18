// Serviço para gerenciar desenhos
const fs = require('fs');
const path = require('path');
const { DRAWINGS_DIR } = require('../config');
const { formatDisplayName } = require('../utils/stringUtils');
const { isS3Available, getDrawingsFromS3 } = require('./s3Service');

// Função para listar desenhos de todas as categorias do filesystem
function getDrawingsDatabaseFromFilesystem() {
    const database = {};
    
    try {
        if (!fs.existsSync(DRAWINGS_DIR)) {
            return database;
        }

        const categories = fs.readdirSync(DRAWINGS_DIR, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        categories.forEach(category => {
            const categoryPath = path.join(DRAWINGS_DIR, category);
            const files = fs.readdirSync(categoryPath)
                .filter(file => {
                    const lower = file.toLowerCase();
                    return lower.endsWith('.svg') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg');
                })
                .sort();

            if (files.length > 0) {
                database[category] = {
                    displayName: formatDisplayName(category),
                    drawings: files,
                    source: 'filesystem'
                };
            }
        });
    } catch (error) {
        console.error('Erro ao ler desenhos do filesystem:', error);
    }

    return database;
}

// Função principal para listar desenhos de todas as categorias
// Prioriza S3 se disponível, caso contrário usa filesystem
async function getDrawingsDatabase() {
    // No Vercel/serverless, SEMPRE usar S3 (filesystem não é persistente)
    const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isVercel || isProduction) {
        if (!isS3Available()) {
            console.error('❌ ERRO: S3 não está configurado no ambiente Vercel/Produção!');
            console.error('❌ Configure as variáveis de ambiente no painel do Vercel:');
            console.error('   - AWS_ACCESS_KEY_ID');
            console.error('   - AWS_SECRET_ACCESS_KEY');
            console.error('   - AWS_REGION');
            console.error('   - AWS_S3_BUCKET_NAME');
            throw new Error('S3 deve estar configurado em ambientes serverless. Configure as variáveis de ambiente no Vercel.');
        }
        
        try {
            console.log('📦 Usando S3 para listar desenhos (ambiente Vercel/Produção)...');
            const database = await getDrawingsFromS3();
            return database;
        } catch (error) {
            console.error('❌ ERRO CRÍTICO: Falha ao ler desenhos do S3 no ambiente Vercel:', error.message);
            console.error('❌ Stack trace:', error.stack);
            throw error; // Não fazer fallback para filesystem no Vercel
        }
    }
    
    // Em desenvolvimento local, tentar S3 primeiro se estiver configurado
    if (isS3Available()) {
        try {
            console.log('📦 Usando S3 para listar desenhos...');
            const database = await getDrawingsFromS3();
            return database;
        } catch (error) {
            console.error('⚠️  Erro ao ler desenhos do S3, usando filesystem como fallback:', error.message);
            // Fallback para filesystem em caso de erro (apenas em desenvolvimento)
            return getDrawingsDatabaseFromFilesystem();
        }
    }
    
    // Usar filesystem se S3 não estiver disponível (apenas em desenvolvimento)
    console.log('📁 Usando filesystem para listar desenhos...');
    return getDrawingsDatabaseFromFilesystem();
}

module.exports = {
    getDrawingsDatabase
};

