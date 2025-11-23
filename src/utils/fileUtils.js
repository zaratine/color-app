// Utilitários para manipulação de arquivos

// Função para gerar nome de arquivo único
function generateFilename(theme, format = 'png') {
    const sanitized = theme
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_');
    return `${sanitized}.${format}`;
}

module.exports = {
    generateFilename
};

