#!/usr/bin/env node

/**
 * Script para fazer download de todas as imagens e pastas do S3 mantendo a estrutura existente
 * 
 * Uso:
 *   node scripts/download-all-images.js                    # Baixa para public/drawings_x/
 *   node scripts/download-all-images.js --output <pasta>   # Baixa para pasta customizada
 */

const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { config } = require('../src/config');
const fs = require('fs').promises;
const path = require('path');

// Configurar cliente S3
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || config.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || config.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION || config.AWS_REGION || 'us-east-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME || config.AWS_S3_BUCKET_NAME;

if (!accessKeyId || !secretAccessKey || !bucketName) {
    console.error('❌ Erro: Credenciais AWS não configuradas.');
    console.error('   Configure as variáveis de ambiente ou o arquivo config.js');
    process.exit(1);
}

const s3Client = new S3Client({
    region: region,
    credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey
    }
});

/**
 * Lista todos os objetos do S3 com um prefixo específico
 * @param {string} prefix - Prefixo para filtrar objetos (ex: "drawings/")
 * @returns {Promise<Array>} Array de objetos com informações dos arquivos
 */
async function listAllObjects(prefix = 'drawings/') {
    const objects = [];
    let continuationToken = undefined;

    console.log('🔍 Buscando objetos no S3...');
    console.log(`   Bucket: ${bucketName}`);
    console.log(`   Prefixo: ${prefix}`);

    do {
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
            ContinuationToken: continuationToken
        });

        const response = await s3Client.send(command);

        if (response.Contents) {
            objects.push(...response.Contents);
        }

        continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return objects;
}

/**
 * Baixa um objeto do S3 e retorna o buffer
 * @param {string} key - Chave do objeto no S3
 * @returns {Promise<Buffer>} Buffer do arquivo
 */
async function downloadObject(key) {
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key
    });

    const response = await s3Client.send(command);
    
    // Converter stream para buffer
    const chunks = [];
    for await (const chunk of response.Body) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
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
 * Baixa um arquivo do S3 e salva localmente mantendo a estrutura
 * @param {string} key - Chave do objeto no S3 (ex: "drawings/animais/Cachorro.png")
 * @param {string} outputDir - Diretório de saída base (ex: "public/drawings_x")
 * @param {number} index - Índice do arquivo (para exibir progresso)
 * @param {number} total - Total de arquivos (para exibir progresso)
 */
async function downloadAndSaveFile(key, outputDir, index, total) {
    try {
        // Remover o prefixo "drawings/" da chave para manter apenas a estrutura interna
        const relativePath = key.startsWith('drawings/') 
            ? key.substring('drawings/'.length) 
            : key;
        
        // Caminho completo do arquivo local
        const localPath = path.join(outputDir, relativePath);
        
        // Criar diretório pai se não existir
        const dirPath = path.dirname(localPath);
        await ensureDirectoryExists(dirPath);
        
        // Baixar arquivo do S3
        const buffer = await downloadObject(key);
        
        // Salvar arquivo localmente
        await fs.writeFile(localPath, buffer);
        
        const sizeKB = (buffer.length / 1024).toFixed(2);
        console.log(`   [${index}/${total}] ✅ ${relativePath} (${sizeKB} KB)`);
        
        return { success: true, key, localPath, size: buffer.length };
    } catch (error) {
        console.error(`   [${index}/${total}] ❌ Erro ao baixar ${key}:`, error.message);
        return { success: false, key, error: error.message };
    }
}

/**
 * Função principal
 */
async function main() {
    const args = process.argv.slice(2);
    
    // Determinar diretório de saída
    let outputDir = 'public/drawings_x';
    const outputIndex = args.indexOf('--output');
    if (outputIndex !== -1 && args[outputIndex + 1]) {
        outputDir = args[outputIndex + 1];
    }

    try {
        // Listar todos os objetos do S3
        const objects = await listAllObjects('drawings/');

        if (objects.length === 0) {
            console.log('✅ Nenhum objeto encontrado no S3 com prefixo "drawings/".');
            return;
        }

        // Filtrar apenas arquivos (ignorar "pastas" vazias do S3)
        const files = objects.filter(obj => {
            // S3 não tem pastas reais, mas pode ter chaves terminadas com "/"
            // Ignorar essas "pastas" vazias
            return !obj.Key.endsWith('/');
        });

        if (files.length === 0) {
            console.log('✅ Nenhum arquivo encontrado (apenas pastas vazias).');
            return;
        }

        // Agrupar por pasta para estatísticas
        const byFolder = {};
        files.forEach(file => {
            const key = file.Key;
            const folder = key.substring(0, key.lastIndexOf('/'));
            if (!byFolder[folder]) {
                byFolder[folder] = [];
            }
            byFolder[folder].push(file);
        });

        // Exibir estatísticas
        console.log(`\n📊 Total de arquivos encontrados: ${files.length}`);
        console.log(`📁 Distribuídos em ${Object.keys(byFolder).length} pasta(s):\n`);

        Object.keys(byFolder).sort().forEach(folder => {
            const count = byFolder[folder].length;
            const totalSize = byFolder[folder].reduce((sum, f) => sum + f.Size, 0);
            const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
            console.log(`   ${folder}/`);
            console.log(`      ${count} arquivo(s) - ${sizeMB} MB`);
        });

        // Criar diretório de saída se não existir
        await ensureDirectoryExists(outputDir);
        console.log(`\n📥 Diretório de saída: ${outputDir}`);

        // Confirmar antes de baixar
        console.log(`\n⚠️  Você está prestes a baixar ${files.length} arquivo(s) do S3.`);
        console.log(`   Os arquivos serão salvos em: ${outputDir}`);
        console.log(`   A estrutura de pastas será mantida.\n`);

        // Baixar todos os arquivos
        console.log('📥 Iniciando download...\n');
        
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        let totalSize = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const result = await downloadAndSaveFile(file.Key, outputDir, i + 1, files.length);
            results.push(result);
            
            if (result.success) {
                successCount++;
                totalSize += result.size;
            } else {
                errorCount++;
            }
        }

        // Resumo final
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO DO DOWNLOAD');
        console.log('='.repeat(60));
        console.log(`✅ Arquivos baixados com sucesso: ${successCount}`);
        if (errorCount > 0) {
            console.log(`❌ Arquivos com erro: ${errorCount}`);
        }
        const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
        console.log(`📦 Tamanho total baixado: ${totalSizeMB} MB`);
        console.log(`📁 Arquivos salvos em: ${path.resolve(outputDir)}`);
        console.log('='.repeat(60));

        if (errorCount > 0) {
            console.log('\n⚠️  Alguns arquivos falharam ao baixar:');
            results
                .filter(r => !r.success)
                .forEach(r => {
                    console.log(`   - ${r.key}: ${r.error}`);
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

