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
    // Tentar usar S3 primeiro se estiver configurado
    if (isS3Available()) {
        try {
            console.log('📦 Usando S3 para listar desenhos...');
            const database = await getDrawingsFromS3();
            return database;
        } catch (error) {
            console.error('⚠️  Erro ao ler desenhos do S3, usando filesystem como fallback:', error.message);
            // Fallback para filesystem em caso de erro
            return getDrawingsDatabaseFromFilesystem();
        }
    }
    
    // Usar filesystem se S3 não estiver disponível
    console.log('📁 Usando filesystem para listar desenhos...');
    return getDrawingsDatabaseFromFilesystem();
}

module.exports = {
    getDrawingsDatabase
};

