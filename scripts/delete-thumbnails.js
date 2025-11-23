#!/usr/bin/env node

/**
 * Script para listar e excluir todos os thumbnails do S3
 * 
 * Uso:
 *   node scripts/delete-thumbnails.js --list    # Apenas lista os thumbnails
 *   node scripts/delete-thumbnails.js --delete   # Lista e exclui os thumbnails
 */

const { S3Client, ListObjectsV2Command, DeleteObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { config } = require('../src/config');

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
 * Lista todos os objetos que são thumbnails (contêm /thumb_ no caminho)
 */
async function listAllThumbnails() {
    const thumbnails = [];
    let continuationToken = undefined;

    console.log('🔍 Buscando thumbnails no S3...');
    console.log(`   Bucket: ${bucketName}`);
    console.log(`   Prefixo: drawings/`);

    do {
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: 'drawings/',
            ContinuationToken: continuationToken
        });

        const response = await s3Client.send(command);

        if (response.Contents) {
            for (const obj of response.Contents) {
                // Verificar se é um thumbnail (contém /thumb_ no caminho)
                if (obj.Key.includes('/thumb_')) {
                    thumbnails.push({
                        key: obj.Key,
                        size: obj.Size,
                        lastModified: obj.LastModified
                    });
                }
            }
        }

        continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return thumbnails;
}

/**
 * Exclui um objeto do S3
 */
async function deleteObject(key) {
    const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key
    });

    await s3Client.send(command);
}

/**
 * Exclui múltiplos objetos do S3 (em lote de até 1000)
 */
async function deleteObjects(keys) {
    if (keys.length === 0) return;

    // S3 permite até 1000 objetos por requisição
    const batchSize = 1000;
    let deleted = 0;

    for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        
        const command = new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
                Objects: batch.map(key => ({ Key: key })),
                Quiet: false
            }
        });

        const response = await s3Client.send(command);
        
        if (response.Deleted) {
            deleted += response.Deleted.length;
            console.log(`   ✅ Excluídos ${response.Deleted.length} objetos (total: ${deleted}/${keys.length})`);
        }

        if (response.Errors && response.Errors.length > 0) {
            console.error('   ❌ Erros ao excluir:');
            response.Errors.forEach(error => {
                console.error(`      - ${error.Key}: ${error.Message}`);
            });
        }
    }

    return deleted;
}

/**
 * Função principal
 */
async function main() {
    const args = process.argv.slice(2);
    const listOnly = args.includes('--list');
    const deleteMode = args.includes('--delete');

    if (!listOnly && !deleteMode) {
        console.log('📋 Uso:');
        console.log('   node scripts/delete-thumbnails.js --list    # Apenas lista os thumbnails');
        console.log('   node scripts/delete-thumbnails.js --delete # Lista e exclui os thumbnails');
        process.exit(0);
    }

    try {
        // Listar todos os thumbnails
        const thumbnails = await listAllThumbnails();

        if (thumbnails.length === 0) {
            console.log('✅ Nenhum thumbnail encontrado no S3.');
            return;
        }

        // Agrupar por pasta
        const byFolder = {};
        thumbnails.forEach(thumb => {
            const folder = thumb.key.substring(0, thumb.key.lastIndexOf('/'));
            if (!byFolder[folder]) {
                byFolder[folder] = [];
            }
            byFolder[folder].push(thumb);
        });

        // Exibir estatísticas
        console.log(`\n📊 Total de thumbnails encontrados: ${thumbnails.length}`);
        console.log(`📁 Distribuídos em ${Object.keys(byFolder).length} pasta(s):\n`);

        Object.keys(byFolder).sort().forEach(folder => {
            const count = byFolder[folder].length;
            const totalSize = byFolder[folder].reduce((sum, t) => sum + t.size, 0);
            const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
            console.log(`   ${folder}/`);
            console.log(`      ${count} thumbnail(s) - ${sizeMB} MB`);
        });

        // Listar todos os thumbnails
        console.log('\n📋 Lista completa de thumbnails:');
        thumbnails.forEach((thumb, index) => {
            const sizeKB = (thumb.size / 1024).toFixed(2);
            console.log(`   ${index + 1}. ${thumb.key} (${sizeKB} KB)`);
        });

        // Se for apenas listagem, parar aqui
        if (listOnly) {
            console.log('\n✅ Listagem concluída. Use --delete para excluir.');
            return;
        }

        // Modo de exclusão
        if (deleteMode) {
            console.log('\n⚠️  ATENÇÃO: Você está prestes a excluir TODOS os thumbnails!');
            console.log(`   Total: ${thumbnails.length} arquivo(s)`);
            
            // Em produção, você pode querer adicionar uma confirmação
            // Por enquanto, vamos excluir diretamente
            
            console.log('\n🗑️  Excluindo thumbnails...');
            const keys = thumbnails.map(t => t.key);
            const deleted = await deleteObjects(keys);

            console.log(`\n✅ Concluído! ${deleted} thumbnail(s) excluído(s).`);
            console.log('💡 Os thumbnails serão regenerados automaticamente quando necessário.');
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('   Stack:', error.stack);
        process.exit(1);
    }
}

// Executar
main();

