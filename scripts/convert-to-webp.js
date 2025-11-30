#!/usr/bin/env node

/**
 * Script para converter todas as imagens de uma pasta para WebP
 * Mantém a estrutura de pastas original
 * 
 * Uso:
 *   node scripts/convert-to-webp.js                                    # Converte de ~/Downloads/drawings_backup para ~/Downloads/drawings_webp
 *   node scripts/convert-to-webp.js --input <pasta> --output <pasta>   # Pastas customizadas
 */

const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Extensões de imagem suportadas
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.svg'];
const WEBP_EXTENSION = '.webp';

/**
 * Verifica se um arquivo é uma imagem
 * @param {string} filePath - Caminho do arquivo
 * @returns {boolean} true se for uma imagem
 */
function isImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Verifica se um arquivo já é WebP
 * @param {string} filePath - Caminho do arquivo
 * @returns {boolean} true se já for WebP
 */
function isWebPFile(filePath) {
    return path.extname(filePath).toLowerCase() === WEBP_EXTENSION;
}

/**
 * Verifica se é um arquivo de sistema (como .DS_Store)
 * @param {string} fileName - Nome do arquivo
 * @returns {boolean} true se for arquivo de sistema
 */
function isSystemFile(fileName) {
    return fileName.startsWith('.') || fileName === 'Thumbs.db';
}

/**
 * Converte o caminho de um arquivo para o caminho WebP correspondente
 * @param {string} inputPath - Caminho do arquivo original
 * @param {string} inputDir - Diretório de entrada base
 * @param {string} outputDir - Diretório de saída base
 * @returns {string} Caminho do arquivo WebP de saída
 */
function getWebPPath(inputPath, inputDir, outputDir) {
    const relativePath = path.relative(inputDir, inputPath);
    const dir = path.dirname(relativePath);
    const fileName = path.basename(relativePath, path.extname(relativePath));
    const webpFileName = fileName + WEBP_EXTENSION;
    
    if (dir === '.') {
        return path.join(outputDir, webpFileName);
    }
    return path.join(outputDir, dir, webpFileName);
}

/**
 * Cria um diretório recursivamente se não existir
 * @param {string} dirPath - Caminho do diretório
 */
async function ensureDirectoryExists(dirPath) {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

/**
 * Converte uma imagem para WebP
 * @param {string} inputPath - Caminho da imagem original
 * @param {string} outputPath - Caminho onde salvar o WebP
 * @returns {Promise<{success: boolean, originalSize: number, webpSize: number, error?: string}>}
 */
async function convertToWebP(inputPath, outputPath) {
    try {
        // Ler arquivo original
        const inputBuffer = await fs.readFile(inputPath);
        const originalSize = inputBuffer.length;
        
        // Converter para WebP usando sharp
        const webpBuffer = await sharp(inputBuffer)
            .webp({
                quality: 85, // Qualidade alta (0-100)
                effort: 4    // Balance entre velocidade e compressão (0-6)
            })
            .toBuffer();
        
        const webpSize = webpBuffer.length;
        
        // Criar diretório de saída se não existir
        const outputDir = path.dirname(outputPath);
        await ensureDirectoryExists(outputDir);
        
        // Salvar arquivo WebP
        await fs.writeFile(outputPath, webpBuffer);
        
        return {
            success: true,
            originalSize,
            webpSize
        };
    } catch (error) {
        return {
            success: false,
            originalSize: 0,
            webpSize: 0,
            error: error.message
        };
    }
}

/**
 * Encontra todos os arquivos de imagem em um diretório recursivamente
 * @param {string} dirPath - Diretório para buscar
 * @returns {Promise<Array<string>>} Array de caminhos de arquivos
 */
async function findImageFiles(dirPath) {
    const files = [];
    
    async function walkDir(currentPath) {
        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                
                if (entry.isDirectory()) {
                    // Ignorar diretórios de sistema
                    if (!isSystemFile(entry.name)) {
                        await walkDir(fullPath);
                    }
                } else if (entry.isFile()) {
                    // Ignorar arquivos de sistema
                    if (!isSystemFile(entry.name)) {
                        // Incluir apenas imagens que não são WebP
                        if (isImageFile(fullPath) && !isWebPFile(fullPath)) {
                            files.push(fullPath);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Erro ao ler diretório ${currentPath}:`, error.message);
        }
    }
    
    await walkDir(dirPath);
    return files;
}

/**
 * Função principal
 */
async function main() {
    const args = process.argv.slice(2);
    
    // Determinar diretórios de entrada e saída
    let inputDir = path.join(require('os').homedir(), 'Downloads', 'drawings_backup');
    let outputDir = path.join(require('os').homedir(), 'Downloads', 'drawings_webp');
    
    const inputIndex = args.indexOf('--input');
    if (inputIndex !== -1 && args[inputIndex + 1]) {
        inputDir = args[inputIndex + 1];
    }
    
    const outputIndex = args.indexOf('--output');
    if (outputIndex !== -1 && args[outputIndex + 1]) {
        outputDir = args[outputIndex + 1];
    }
    
    try {
        // Verificar se o diretório de entrada existe
        try {
            await fs.access(inputDir);
        } catch {
            console.error(`❌ Erro: Diretório de entrada não encontrado: ${inputDir}`);
            process.exit(1);
        }
        
        console.log('🔍 Buscando imagens para converter...');
        console.log(`   Entrada: ${inputDir}`);
        console.log(`   Saída: ${outputDir}\n`);
        
        // Encontrar todas as imagens
        const imageFiles = await findImageFiles(inputDir);
        
        if (imageFiles.length === 0) {
            console.log('✅ Nenhuma imagem encontrada para converter.');
            return;
        }
        
        console.log(`📊 Total de imagens encontradas: ${imageFiles.length}\n`);
        
        // Criar diretório de saída
        await ensureDirectoryExists(outputDir);
        
        // Estatísticas
        let successCount = 0;
        let errorCount = 0;
        let totalOriginalSize = 0;
        let totalWebpSize = 0;
        const errors = [];
        
        // Converter cada imagem
        console.log('🔄 Iniciando conversão...\n');
        
        for (let i = 0; i < imageFiles.length; i++) {
            const inputPath = imageFiles[i];
            const relativePath = path.relative(inputDir, inputPath);
            const outputPath = getWebPPath(inputPath, inputDir, outputDir);
            
            const result = await convertToWebP(inputPath, outputPath);
            
            if (result.success) {
                successCount++;
                totalOriginalSize += result.originalSize;
                totalWebpSize += result.webpSize;
                
                const originalSizeKB = (result.originalSize / 1024).toFixed(2);
                const webpSizeKB = (result.webpSize / 1024).toFixed(2);
                const reduction = ((1 - result.webpSize / result.originalSize) * 100).toFixed(1);
                
                console.log(`   [${i + 1}/${imageFiles.length}] ✅ ${relativePath}`);
                console.log(`      ${originalSizeKB} KB → ${webpSizeKB} KB (${reduction}% menor)`);
            } else {
                errorCount++;
                errors.push({ file: relativePath, error: result.error });
                console.error(`   [${i + 1}/${imageFiles.length}] ❌ ${relativePath}: ${result.error}`);
            }
        }
        
        // Resumo final
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO DA CONVERSÃO');
        console.log('='.repeat(60));
        console.log(`✅ Imagens convertidas com sucesso: ${successCount}`);
        if (errorCount > 0) {
            console.log(`❌ Imagens com erro: ${errorCount}`);
        }
        
        const totalOriginalMB = (totalOriginalSize / 1024 / 1024).toFixed(2);
        const totalWebpMB = (totalWebpSize / 1024 / 1024).toFixed(2);
        const totalReduction = totalOriginalSize > 0 
            ? ((1 - totalWebpSize / totalOriginalSize) * 100).toFixed(1)
            : 0;
        
        console.log(`📦 Tamanho original total: ${totalOriginalMB} MB`);
        console.log(`📦 Tamanho WebP total: ${totalWebpMB} MB`);
        console.log(`💾 Economia de espaço: ${totalReduction}%`);
        console.log(`📁 Arquivos salvos em: ${path.resolve(outputDir)}`);
        console.log('='.repeat(60));
        
        if (errors.length > 0) {
            console.log('\n⚠️  Arquivos com erro:');
            errors.forEach(({ file, error }) => {
                console.log(`   - ${file}: ${error}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('   Stack:', error.stack);
        process.exit(1);
    }
}

// Executar
main();

