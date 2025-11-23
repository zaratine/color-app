// Utilitários para manipulação de arquivos

// Função para gerar nome de arquivo único
function generateFilename(theme) {
    const sanitized = theme
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_');
    return `${sanitized}.png`;
}

module.exports = {
    generateFilename
};

