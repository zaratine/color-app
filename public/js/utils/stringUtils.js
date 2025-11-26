// Utils - Funções utilitárias para manipulação de strings

/**
 * Capitaliza a primeira letra de cada palavra em uma string
 * @param {string} str - String a ser capitalizada
 * @returns {string} String com primeira letra de cada palavra em maiúscula
 */
export function capitalizeWords(str) {
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Remove números ao final de uma string
 * @param {string} str - String a ser processada
 * @returns {string} String sem números ao final
 */
export function removeTrailingNumbers(str) {
    if (!str) return '';
    // Remove espaços/hífens/underscores seguidos de números no final
    return str.replace(/[\s_-]+\d+$/, '');
}

/**
 * Obtém o nome amigável de um desenho a partir do nome do arquivo
 * @param {string} filename - Nome do arquivo
 * @returns {string} Nome amigável do desenho
 */
export function getFriendlyName(filename) {
    if (!filename) return '';
    let nameWithoutExt = filename.replace(/\.(svg|png|jpg|jpeg|webp)$/i, '').replace(/_/g, ' ');
    nameWithoutExt = removeTrailingNumbers(nameWithoutExt);
    return capitalizeWords(nameWithoutExt);
}

