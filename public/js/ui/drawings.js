// UI - Renderização de desenhos de uma categoria

import { getDrawingsInCategory, getDrawingFilename, getDrawingUrl, getThumbnailUrl, getAllCategories } from '../services/drawingsService.js';
import { getCategoryFromUrl, getPaintUrl, getProxyUrl, isS3Url, getCategoryUrl } from '../utils/urlUtils.js';

// Estado global para os filtros
let allDrawingsData = [];
let selectedFilters = new Set();
let nounCountMap = new Map();
let currentCategory = '';

/**
 * Capitaliza a primeira letra de cada palavra em uma string
 * @param {string} str - String a ser capitalizada
 * @returns {string} String com primeira letra de cada palavra em maiúscula
 */
function capitalizeWords(str) {
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
function removeTrailingNumbers(str) {
    if (!str) return '';
    // Remove espaços/hífens/underscores seguidos de números no final
    return str.replace(/[\s_-]+\d+$/, '');
}

/**
 * Remove artigos do início de um substantivo
 * @param {string} noun - Substantivo a ser limpo
 * @returns {string} Substantivo sem artigos iniciais
 */
function removeLeadingArticles(noun) {
    // Remove artigos do início: "a ", "an ", "the "
    return noun.replace(/^(a|an|the)\s+/i, '').trim();
}

/**
 * Extrai substantivos de um nome de desenho usando compromise.js
 * @param {string} drawingName - Nome do desenho
 * @returns {string[]} Array de substantivos extraídos (lowercase)
 */
function extractNouns(drawingName) {
    // Acessa nlp via window pois é carregado como script global
    const nlpLib = window.nlp;
    if (!drawingName || typeof nlpLib === 'undefined') return [];
    
    // Usa compromise.js para extrair substantivos
    const doc = nlpLib(drawingName.toLowerCase());
    const nouns = doc.nouns().out('array');
    
    // Limpa e normaliza os substantivos
    const cleanedNouns = nouns
        .map(noun => noun.trim().toLowerCase())
        .map(noun => removeLeadingArticles(noun)) // Remove artigos do início
        .filter(noun => noun.length > 1) // Remove substantivos muito curtos
        .filter(noun => !['a', 'an', 'the', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'to'].includes(noun));
    
    return [...new Set(cleanedNouns)]; // Remove duplicatas
}

/**
 * Processa todos os desenhos e extrai os substantivos únicos com contagem
 * @param {Array} drawings - Array de desenhos
 * @returns {Map} Mapa de substantivo -> contagem de desenhos
 */
function processDrawingsNouns(drawings) {
    const nounCount = new Map();
    
    drawings.forEach(drawing => {
        const filename = getDrawingFilename(drawing);
        let nameWithoutExt = filename.replace(/\.[^.]+$/i, '').replace(/_/g, ' ');
        nameWithoutExt = removeTrailingNumbers(nameWithoutExt);
        
        const nouns = extractNouns(nameWithoutExt);
        drawing._extractedNouns = nouns; // Armazena os nouns no objeto do desenho
        
        nouns.forEach(noun => {
            nounCount.set(noun, (nounCount.get(noun) || 0) + 1);
        });
    });
    
    return nounCount;
}

/**
 * Renderiza a seção de filtros
 * @param {Map} nounCount - Mapa de substantivo -> contagem
 */
function renderFilters(nounCount) {
    // Remove container de filtros existente se houver
    const existingFilters = document.getElementById('filters-container');
    if (existingFilters) {
        existingFilters.remove();
    }
    
    // Se não houver nouns suficientes, não mostra filtros
    if (nounCount.size < 2) return;
    
    const grid = document.getElementById('drawings-grid');
    if (!grid) return;
    
    // Ordena os nouns por contagem (decrescente) e depois alfabeticamente
    const sortedNouns = [...nounCount.entries()]
        .filter(([noun, count]) => count >= 2) // Só mostra nouns que aparecem em pelo menos 2 desenhos
        .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1]; // Por contagem
            return a[0].localeCompare(b[0]); // Alfabético
        });
    
    if (sortedNouns.length === 0) return;
    
    // Limite de filtros visíveis inicialmente
    const VISIBLE_FILTERS_LIMIT = 15;
    const hasMoreFilters = sortedNouns.length > VISIBLE_FILTERS_LIMIT;
    
    // Cria o container de filtros
    const filtersContainer = document.createElement('div');
    filtersContainer.id = 'filters-container';
    filtersContainer.className = 'filters-container';
    
    filtersContainer.innerHTML = `
        <!--div class="filters-header">
            <span class="filters-label">Filter by:</span>
        </div-->
        <div class="filters-tags"></div>
        <div class="filters-footer" style="display: none;">
            <span class="filters-result-count"></span>
            <button class="clear-filters-btn">Clear filters</button>
        </div>
    `;
    
    // Insere antes do grid
    grid.parentNode.insertBefore(filtersContainer, grid);
    
    // Adiciona as tags
    const tagsContainer = filtersContainer.querySelector('.filters-tags');
    
    sortedNouns.forEach(([noun, count], index) => {
        const tag = document.createElement('button');
        tag.className = 'filter-tag';
        tag.dataset.noun = noun;
        tag.innerHTML = `${capitalizeWords(noun)} <span class="filter-count">(${count})</span>`;
        tag.addEventListener('click', () => toggleFilter(noun));
        
        // Esconde filtros além do limite
        if (index >= VISIBLE_FILTERS_LIMIT) {
            tag.classList.add('hidden-filter');
            tag.dataset.canHide = 'true';
        }
        
        tagsContainer.appendChild(tag);
    });
    
    // Adiciona botão "Show all filters" se houver mais filtros
    if (hasMoreFilters) {
        const showAllBtn = document.createElement('button');
        showAllBtn.className = 'show-all-filters-btn';
        showAllBtn.innerHTML = `Show all (${sortedNouns.length - VISIBLE_FILTERS_LIMIT} more)`;
        showAllBtn.addEventListener('click', () => toggleAllFilters(showAllBtn, VISIBLE_FILTERS_LIMIT, sortedNouns.length));
        tagsContainer.appendChild(showAllBtn);
    }
    
    // Evento para limpar filtros
    const clearBtn = filtersContainer.querySelector('.clear-filters-btn');
    clearBtn.addEventListener('click', clearFilters);
}

/**
 * Alterna a exibição de todos os filtros
 * @param {HTMLElement} btn - Botão que foi clicado
 * @param {number} limit - Limite inicial de filtros visíveis
 * @param {number} total - Total de filtros
 */
function toggleAllFilters(btn, limit, total) {
    const isExpanded = btn.dataset.expanded === 'true';
    
    // Seleciona todos os filtros que podem ser escondidos (índice >= limite)
    const allFilterTags = document.querySelectorAll('.filter-tag[data-can-hide="true"]');
    
    if (isExpanded) {
        // Esconde os filtros extras
        allFilterTags.forEach(filter => {
            filter.classList.add('hidden-filter');
        });
        btn.innerHTML = `Show all (${total - limit} more)`;
        btn.dataset.expanded = 'false';
    } else {
        // Mostra todos os filtros
        allFilterTags.forEach(filter => {
            filter.classList.remove('hidden-filter');
        });
        btn.innerHTML = 'Show less';
        btn.dataset.expanded = 'true';
    }
}

/**
 * Alterna um filtro (seleciona/deseleciona)
 * @param {string} noun - Substantivo do filtro
 */
function toggleFilter(noun) {
    if (selectedFilters.has(noun)) {
        selectedFilters.delete(noun);
    } else {
        selectedFilters.add(noun);
    }
    
    updateFilterUI();
    applyFilters();
}

/**
 * Limpa todos os filtros selecionados
 */
function clearFilters() {
    selectedFilters.clear();
    updateFilterUI();
    applyFilters();
}

/**
 * Atualiza a UI dos filtros (estados selecionado/não selecionado)
 */
function updateFilterUI() {
    const filtersContainer = document.getElementById('filters-container');
    if (!filtersContainer) return;
    
    const tags = filtersContainer.querySelectorAll('.filter-tag');
    
    // Atualiza estado das tags
    tags.forEach(tag => {
        const noun = tag.dataset.noun;
        if (selectedFilters.has(noun)) {
            tag.classList.add('selected');
        } else {
            tag.classList.remove('selected');
        }
    });
}

/**
 * Aplica os filtros selecionados e re-renderiza o grid
 */
function applyFilters() {
    const grid = document.getElementById('drawings-grid');
    if (!grid) return;
    
    let filteredDrawings = allDrawingsData;
    
    // Aplica lógica AND: desenho deve conter TODOS os filtros selecionados
    if (selectedFilters.size > 0) {
        filteredDrawings = allDrawingsData.filter(drawing => {
            const drawingNouns = drawing._extractedNouns || [];
            return [...selectedFilters].every(filter => drawingNouns.includes(filter));
        });
    }
    
    // Atualiza contador de resultados e footer
    const filtersFooter = document.querySelector('.filters-footer');
    const resultCount = document.querySelector('.filters-result-count');
    if (filtersFooter && resultCount) {
        if (selectedFilters.size > 0) {
            resultCount.textContent = `Showing ${filteredDrawings.length} of ${allDrawingsData.length} drawings`;
            filtersFooter.style.display = 'flex';
        } else {
            filtersFooter.style.display = 'none';
        }
    }
    
    // Re-renderiza o grid
    renderDrawingsGrid(filteredDrawings);
}

/**
 * Renderiza o grid de desenhos
 * @param {Array} drawings - Array de desenhos a renderizar
 */
function renderDrawingsGrid(drawings) {
    const grid = document.getElementById('drawings-grid');
    if (!grid) return;
    
    if (drawings.length === 0) {
        grid.innerHTML = '<p class="no-results">No drawings match the selected filters.</p>';
        return;
    }
    
    grid.innerHTML = '';
    
    drawings.forEach(drawing => {
        const filename = getDrawingFilename(drawing);
        const imageUrl = getDrawingUrl(drawing);
        
        // Obter URL do thumbnail
        let thumbnailPath = getThumbnailUrl(drawing, currentCategory);
        
        const isS3Thumbnail = thumbnailPath && thumbnailPath.includes('.s3.') && thumbnailPath.includes('.amazonaws.com');
        const fallbackUrl = imageUrl ? `/api/thumbnail?url=${encodeURIComponent(imageUrl)}` : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3E?%3C/text%3E%3C/svg%3E';
        
        let nameWithoutExt = filename.replace(/\.[^.]+$/i, '').replace(/_/g, ' ');
        nameWithoutExt = removeTrailingNumbers(nameWithoutExt);
        const drawingName = capitalizeWords(nameWithoutExt);

        const drawingCard = document.createElement('div');
        drawingCard.className = 'card';
        drawingCard.onclick = () => {
            window.location.href = getPaintUrl(currentCategory, filename, imageUrl);
        };

        const onErrorHandler = isS3Thumbnail 
            ? `this.onerror=null; this.src='${fallbackUrl}';`
            : `this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3E?%3C/text%3E%3C/svg%3E';`;

        drawingCard.innerHTML = `
            <img src="${thumbnailPath}" alt="${drawingName}" class="card-thumbnail"
                 onerror="${onErrorHandler}">
            <h2 class="card-name">${drawingName}</h2>
        `;

        grid.appendChild(drawingCard);
    });
}

/**
 * Carrega e renderiza os desenhos de uma categoria
 */
export async function loadDrawings() {
    const category = getCategoryFromUrl();
    if (!category) {
        const grid = document.getElementById('drawings-grid');
        if (grid) {
            grid.innerHTML = '<p>Error: Category not specified.</p>';
        }
        return;
    }

    // Salva a categoria atual no estado global
    currentCategory = category;

    const grid = document.getElementById('drawings-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="loading-container">
            <div class="spinner"></div>
            <p class="loading-label">Loading drawings...</p>
        </div>
    `;

    try {
        const drawings = await getDrawingsInCategory(category);
        
        if (drawings.length === 0) {
            grid.innerHTML = '<p>No drawings found in this category.</p>';
            return;
        }

        // Processa os substantivos de todos os desenhos
        nounCountMap = processDrawingsNouns(drawings);
        
        // Armazena todos os desenhos no estado global
        allDrawingsData = drawings;
        
        // Limpa filtros selecionados
        selectedFilters.clear();
        
        // Renderiza a seção de filtros
        renderFilters(nounCountMap);
        
        // Renderiza o grid de desenhos
        renderDrawingsGrid(drawings);
        
        // Carregar outras categorias após carregar os desenhos
        await loadOtherCategories(category);
    } catch (error) {
        console.error('Erro ao carregar desenhos:', error);
        grid.innerHTML = '<p>Error loading drawings. Please check if the server is running.</p>';
    }
}

/**
 * Carrega e renderiza 5 categorias aleatórias (excluindo a categoria atual)
 * @param {string} currentCategory - Nome da categoria atual
 */
async function loadOtherCategories(currentCategory) {
    const grid = document.getElementById('other-categories-grid');
    if (!grid) return;

    try {
        const allCategories = await getAllCategories();
        
        // Filtrar categorias que têm desenhos e excluir a categoria atual
        const availableCategories = allCategories.filter(
            cat => cat.drawings.length > 0 && cat.name !== currentCategory
        );
        
        if (availableCategories.length === 0) {
            // Se não há outras categorias, esconder a seção
            const section = document.querySelector('.other-categories-section');
            if (section) {
                section.style.display = 'none';
            }
            return;
        }
        
        // Selecionar 3 categorias aleatórias
        const shuffled = availableCategories.sort(() => 0.5 - Math.random());
        const randomCategories = shuffled.slice(0, 5);
        
        grid.innerHTML = '';
        
        for (const category of randomCategories) {
            const firstDrawing = category.drawings[0];
            
            // Obter URL do thumbnail e URL original da imagem
            const thumbnailPath = getThumbnailUrl(firstDrawing, category.name);
            const imageUrl = getDrawingUrl(firstDrawing);
            
            // Se for URL do S3 direta, tentar carregar direto. Se der 404, fazer fallback para /api/thumbnail
            const isS3Thumbnail = thumbnailPath && thumbnailPath.includes('.s3.') && thumbnailPath.includes('.amazonaws.com');
            const fallbackUrl = imageUrl ? `/api/thumbnail?url=${encodeURIComponent(imageUrl)}` : null;
            
            const categoryCard = document.createElement('div');
            categoryCard.className = 'card';
            categoryCard.onclick = () => {
                window.location.href = getCategoryUrl(category.name);
            };

            // Se for URL do S3, fazer fallback para API quando der erro. Caso contrário, esconder imagem
            const onErrorHandler = isS3Thumbnail && fallbackUrl
                ? `this.onerror=null; this.src='${fallbackUrl}';`
                : `this.style.display='none';`;

            categoryCard.innerHTML = `
                <img src="${thumbnailPath}" alt="${category.displayName}" class="card-thumbnail" 
                     onerror="${onErrorHandler}">
                <h2 class="card-name">${category.displayName}</h2>
            `;

            grid.appendChild(categoryCard);
        }
    } catch (error) {
        console.error('Erro ao carregar outras categorias:', error);
        // Em caso de erro, esconder a seção
        const section = document.querySelector('.other-categories-section');
        if (section) {
            section.style.display = 'none';
        }
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('drawings-grid')) {
        loadDrawings();
    }
});

