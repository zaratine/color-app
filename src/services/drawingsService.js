// Serviço para gerenciar desenhos
const fs = require('fs');
const path = require('path');
const { DRAWINGS_DIR } = require('../config');
const { formatDisplayName } = require('../utils/stringUtils');

// Função para listar desenhos de todas as categorias
function getDrawingsDatabase() {
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
                    drawings: files
                };
            }
        });
    } catch (error) {
        console.error('Erro ao ler desenhos:', error);
    }

    return database;
}

module.exports = {
    getDrawingsDatabase
};

