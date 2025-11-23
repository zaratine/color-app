// Script para processar CSV e gerar imagens em lote
const fs = require('fs');
const path = require('path');
const { generateDrawing } = require('../src/services/openaiService');

const CSV_FILE = path.join(__dirname, '..', 'drawings.csv');
const CSV_BACKUP = path.join(__dirname, '..', 'drawings.csv.backup');
const CONCURRENT_REQUESTS = 30;

/**
 * Lê e parseia o arquivo CSV
 * @returns {Array<{category: string, description: string, url: string, lineIndex: number}>}
 */
function readCSV() {
    const content = fs.readFileSync(CSV_FILE, 'utf-8');
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Pular cabeçalho
    const dataLines = lines.slice(1);
    
    const rows = [];
    dataLines.forEach((line, index) => {
        // Parsear CSV simples (assumindo que não há vírgulas dentro das strings)
        const parts = line.split(',');
        if (parts.length >= 2) {
            const category = parts[0].trim();
            const description = parts[1].trim();
            const url = parts.length >= 3 ? parts[2].trim() : '';
            
            rows.push({
                category,
                description,
                url,
                lineIndex: index + 1, // +1 porque pulamos o cabeçalho
                originalLine: line
            });
        }
    });
    
    return rows;
}

/**
 * Escreve o CSV atualizado
 * @param {Array} rows - Array de objetos com category, description, url
 */
function writeCSV(rows) {
    const lines = ['Categoria,Descrição do desenho,URL'];
    
    rows.forEach(row => {
        const category = row.category || '';
        const description = row.description || '';
        const url = row.url || '';
        lines.push(`${category},${description},${url}`);
    });
    
    fs.writeFileSync(CSV_FILE, lines.join('\n') + '\n', 'utf-8');
}

/**
 * Processa uma linha do CSV gerando a imagem
 * @param {Object} row - Objeto com category, description, url, lineIndex
 * @returns {Promise<Object>} - Row atualizado com URL ou erro
 */
async function processRow(row) {
    try {
        // Converter categoria para minúsculo
        const category = row.category.toLowerCase();
        
        console.log(`  [${row.lineIndex}] Processando: ${row.description} (categoria: ${category})`);
        
        const result = await generateDrawing(row.description, category);
        
        return {
            ...row,
            url: result.url || '',
            success: true
        };
    } catch (error) {
        console.error(`  [${row.lineIndex}] ERRO ao processar "${row.description}":`, error.message);
        return {
            ...row,
            url: `ERRO: ${error.message}`,
            success: false
        };
    }
}

/**
 * Processa linhas em chunks paralelos
 * @param {Array} rowsToProcess - Array de linhas para processar
 * @param {Array} allRows - Array completo com todas as linhas (para atualização)
 * @param {number} chunkSize - Tamanho do chunk (padrão: 10)
 */
async function processInChunks(rowsToProcess, allRows, chunkSize = CONCURRENT_REQUESTS) {
    let processed = 0;
    let successCount = 0;
    let errorCount = 0;
    
    // Processar em chunks
    for (let i = 0; i < rowsToProcess.length; i += chunkSize) {
        const chunk = rowsToProcess.slice(i, i + chunkSize);
        const chunkNumber = Math.floor(i / chunkSize) + 1;
        const totalChunks = Math.ceil(rowsToProcess.length / chunkSize);
        
        console.log(`\n📦 Processando chunk ${chunkNumber}/${totalChunks} (${chunk.length} itens)...`);
        
        // Processar chunk em paralelo
        const chunkResults = await Promise.all(chunk.map(row => processRow(row)));
        
        // Atualizar estatísticas e o array completo
        chunkResults.forEach(result => {
            if (result.success) {
                successCount++;
            } else {
                errorCount++;
            }
            processed++;
            
            // Atualizar a linha correspondente no array completo
            const originalIndex = allRows.findIndex(r => r.lineIndex === result.lineIndex);
            if (originalIndex !== -1) {
                allRows[originalIndex] = result;
            }
        });
        
        // Salvar CSV após cada chunk
        writeCSV(allRows);
        
        console.log(`✅ Chunk ${chunkNumber} concluído. Progresso: ${processed}/${rowsToProcess.length} (${successCount} sucesso, ${errorCount} erros)`);
    }
    
    return allRows;
}

/**
 * Função principal
 */
async function main() {
    console.log('🚀 Iniciando processamento em lote de imagens...\n');
    
    // Fazer backup do CSV original
    if (fs.existsSync(CSV_FILE)) {
        console.log('📋 Criando backup do CSV original...');
        fs.copyFileSync(CSV_FILE, CSV_BACKUP);
        console.log(`✅ Backup criado: ${CSV_BACKUP}\n`);
    } else {
        console.error(`❌ Arquivo CSV não encontrado: ${CSV_FILE}`);
        process.exit(1);
    }
    
    // Ler CSV
    console.log('📖 Lendo arquivo CSV...');
    const rows = readCSV();
    console.log(`✅ ${rows.length} linhas encontradas\n`);
    
    // Filtrar linhas que já têm URL (pular)
    const rowsToProcess = rows.filter(row => !row.url || row.url.trim() === '');
    const rowsToSkip = rows.filter(row => row.url && row.url.trim() !== '');
    
    console.log(`📊 Estatísticas:`);
    console.log(`   - Total de linhas: ${rows.length}`);
    console.log(`   - Já processadas (com URL): ${rowsToSkip.length}`);
    console.log(`   - A processar: ${rowsToProcess.length}\n`);
    
    if (rowsToProcess.length === 0) {
        console.log('✅ Todas as linhas já foram processadas!');
        return;
    }
    
    // Processar linhas
    console.log(`🔄 Iniciando processamento de ${rowsToProcess.length} imagens...`);
    console.log(`⚙️  Processando ${CONCURRENT_REQUESTS} requisições em paralelo\n`);
    
    const startTime = Date.now();
    const updatedRows = await processInChunks(rowsToProcess, rows, CONCURRENT_REQUESTS);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);
    
    // Estatísticas finais (apenas das linhas processadas)
    const finalSuccess = rowsToProcess.filter((row, idx) => {
        const updated = updatedRows.find(r => r.lineIndex === row.lineIndex);
        return updated && updated.success;
    }).length;
    const finalErrors = rowsToProcess.length - finalSuccess;
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ PROCESSAMENTO CONCLUÍDO!');
    console.log('='.repeat(60));
    console.log(`📊 Estatísticas finais:`);
    console.log(`   - Total processado nesta execução: ${rowsToProcess.length}`);
    console.log(`   - Sucesso: ${finalSuccess}`);
    console.log(`   - Erros: ${finalErrors}`);
    console.log(`   - Tempo total: ${duration} minutos`);
    console.log(`   - CSV atualizado: ${CSV_FILE}`);
    console.log(`   - Backup disponível: ${CSV_BACKUP}`);
    console.log('='.repeat(60));
}

// Executar
main().catch(error => {
    console.error('\n❌ Erro fatal:', error);
    console.error(error.stack);
    process.exit(1);
});

