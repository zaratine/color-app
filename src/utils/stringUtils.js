// Utilitários para manipulação de strings

// Função para capitalizar primeira letra
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Função para formatar nome de exibição
function formatDisplayName(name) {
    return name
        .split('-')
        .map(word => capitalize(word))
        .join(' ');
}

module.exports = {
    capitalize,
    formatDisplayName
};

