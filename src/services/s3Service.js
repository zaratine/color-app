// Serviço para integração com AWS S3
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { config } = require('../config');
const { formatDisplayName } = require('../utils/stringUtils');

// Configurar cliente S3
// Prioridade: variável de ambiente > config.js
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || config.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || config.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION || config.AWS_REGION || 'us-east-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME || config.AWS_S3_BUCKET_NAME;

// Verificar se as credenciais estão configuradas
const isS3Configured = accessKeyId && 
                       secretAccessKey && 
                       accessKeyId !== 'sua-access-key-aqui' && 
                       secretAccessKey !== 'sua-secret-key-aqui' &&
                       bucketName &&
                       bucketName !== 'nome-do-seu-bucket';

// Criar cliente S3 apenas se as credenciais estiverem configuradas
let s3Client = null;
if (isS3Configured) {
    s3Client = new S3Client({
        region: region,
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey
        }
    });
    console.log('✅ Cliente S3 configurado. Bucket:', bucketName, 'Região:', region);
} else {
    console.log('ℹ️  S3 não configurado. Usando salvamento local.');
}

/**
 * Faz upload de uma imagem para o S3
 * @param {Buffer} imageBuffer - Buffer da imagem
 * @param {string} filename - Nome do arquivo (ex: "Cachorro_Patinando.png")
 * @param {string} contentType - Tipo MIME (ex: "image/png")
 * @returns {Promise<string>} URL pública da imagem no S3
 */
async function uploadToS3(imageBuffer, filename, contentType = 'image/png') {
    if (!isS3Configured || !s3Client) {
        throw new Error('S3 não está configurado. Configure as variáveis de ambiente AWS.');
    }

    try {
        console.log('    [uploadToS3] Iniciando upload para S3...');
        console.log('    [uploadToS3] Bucket:', bucketName);
        console.log('    [uploadToS3] Key:', filename);
        console.log('    [uploadToS3] Tamanho:', imageBuffer.length, 'bytes');

        // Definir o caminho no bucket (pasta customizados)
        const key = `drawings/customizados/${filename}`;

        // Comando para fazer upload
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: imageBuffer,
            ContentType: contentType,
            // Tornar o objeto público para leitura
            ACL: 'public-read'
        });

        // Executar upload
        await s3Client.send(command);
        console.log('    [uploadToS3] Upload concluído com sucesso');

        // Construir URL pública
        // Formato: https://bucket-name.s3.region.amazonaws.com/key
        const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
        console.log('    [uploadToS3] URL pública:', publicUrl);

        return publicUrl;
    } catch (error) {
        console.error('    [uploadToS3] Erro ao fazer upload:', error.message);
        console.error('    [uploadToS3] Stack:', error.stack);
        throw error;
    }
}

/**
 * Verifica se o S3 está configurado e disponível
 * @returns {boolean}
 */
function isS3Available() {
    return isS3Configured && s3Client !== null;
}

/**
 * Lista todos os objetos do S3 em um prefixo específico
 * @param {string} prefix - Prefixo para filtrar objetos (ex: "drawings/")
 * @returns {Promise<Array>} Array de objetos com informações dos arquivos
 */
async function listObjects(prefix = 'drawings/') {
    if (!isS3Configured || !s3Client) {
        throw new Error('S3 não está configurado. Configure as variáveis de ambiente AWS.');
    }

    try {
        const allObjects = [];
        let continuationToken = undefined;

        do {
            const command = new ListObjectsV2Command({
                Bucket: bucketName,
                Prefix: prefix,
                ContinuationToken: continuationToken
            });

            const response = await s3Client.send(command);
            
            if (response.Contents) {
                allObjects.push(...response.Contents);
            }

            continuationToken = response.NextContinuationToken;
        } while (continuationToken);

        return allObjects;
    } catch (error) {
        console.error('❌ Erro ao listar objetos do S3:', error.message);
        console.error('❌ Código do erro:', error.Code || error.name);
        if (error.message.includes('Access Denied') || error.message.includes('Forbidden')) {
            console.error('💡 Problema de permissões! Verifique se a política IAM permite:');
            console.error('   - s3:ListBucket (para listar objetos)');
            console.error('   - s3:GetObject (para ler objetos)');
        }
        throw error;
    }
}

/**
 * Obtém todas as categorias e desenhos do S3 dinamicamente
 * Estrutura esperada no S3: drawings/{categoria}/{arquivo}
 * @returns {Promise<Object>} Objeto com categorias e desenhos no formato {categoria: {displayName, drawings: []}}
 */
async function getDrawingsFromS3() {
    if (!isS3Configured || !s3Client) {
        throw new Error('S3 não está configurado.');
    }

    try {
        console.log('📦 Listando desenhos do S3...');
        console.log('📦 Bucket:', bucketName);
        console.log('📦 Prefixo:', 'drawings/');
        const objects = await listObjects('drawings/');
        console.log(`📦 Total de objetos encontrados: ${objects.length}`);
        
        // Se não encontrou nada, listar todos os objetos do bucket para debug
        if (objects.length === 0) {
            console.log('⚠️  Nenhum objeto encontrado com prefixo "drawings/"');
            console.log('🔍 Listando todos os objetos do bucket para debug...');
            try {
                const allObjects = await listObjects('');
                console.log(`📦 Total de objetos no bucket: ${allObjects.length}`);
                if (allObjects.length > 0) {
                    console.log('📦 Todos os objetos no bucket:');
                    allObjects.slice(0, 20).forEach((obj, index) => {
                        console.log(`   ${index + 1}. ${obj.Key}`);
                    });
                    if (allObjects.length > 20) {
                        console.log(`   ... e mais ${allObjects.length - 20} objeto(s)`);
                    }
                    console.log('💡 Dica: As imagens precisam ter chaves começando com "drawings/"');
                    console.log('💡 Exemplo correto: drawings/animais/Cachorro.png');
                } else {
                    console.log('⚠️  O bucket está vazio!');
                }
            } catch (debugError) {
                console.error('Erro ao listar todos os objetos:', debugError.message);
            }
        } else {
            // Log de debug: mostrar todas as chaves encontradas
            console.log('📦 Chaves encontradas:');
            objects.forEach((obj, index) => {
                console.log(`   ${index + 1}. ${obj.Key}`);
            });
        }

        const database = {};
        const imageExtensions = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp'];

        // Processar cada objeto
        objects.forEach(obj => {
            const key = obj.Key;
            console.log(`📦 Processando chave: ${key}`);
            
            // Ignorar se não for um arquivo de imagem
            const isImage = imageExtensions.some(ext => 
                key.toLowerCase().endsWith(ext)
            );
            
            if (!isImage) {
                console.log(`   ⏭️  Ignorado (não é imagem): ${key}`);
                return;
            }

            // Extrair categoria e nome do arquivo
            // Formato esperado: drawings/{categoria}/{arquivo}
            const parts = key.replace('drawings/', '').split('/');
            console.log(`   📂 Partes após "drawings/":`, parts);
            
            if (parts.length >= 2) {
                const category = parts[0];
                const filename = parts.slice(1).join('/'); // Caso tenha subpastas
                console.log(`   ✅ Categoria: "${category}", Arquivo: "${filename}"`);

                // Inicializar categoria se não existir
                if (!database[category]) {
                    database[category] = {
                        displayName: formatDisplayName(category),
                        drawings: [],
                        source: 's3' // Marcar que vem do S3
                    };
                    console.log(`   🆕 Nova categoria criada: "${category}"`);
                }

                // Adicionar arquivo à categoria com URL completa do S3
                const publicUrl = getS3PublicUrl(key);
                database[category].drawings.push({
                    filename: filename,
                    url: publicUrl
                });
                console.log(`   ➕ Arquivo adicionado à categoria "${category}"`);
            } else {
                console.log(`   ⚠️  Chave ignorada (formato inválido): ${key}`);
                console.log(`   💡 Formato esperado: drawings/{categoria}/{arquivo}`);
            }
        });

        // Ordenar desenhos em cada categoria por nome do arquivo
        Object.keys(database).forEach(category => {
            database[category].drawings.sort((a, b) => {
                const nameA = typeof a === 'string' ? a : a.filename;
                const nameB = typeof b === 'string' ? b : b.filename;
                return nameA.localeCompare(nameB);
            });
        });

        console.log(`📦 Categorias encontradas: ${Object.keys(database).length}`);
        if (Object.keys(database).length > 0) {
            console.log('📦 Categorias:', Object.keys(database).join(', '));
            Object.keys(database).forEach(cat => {
                console.log(`   - ${cat}: ${database[cat].drawings.length} desenho(s)`);
            });
        } else {
            console.log('⚠️  Nenhuma categoria foi criada!');
            console.log('💡 Verifique se:');
            console.log('   1. As imagens foram enviadas com chaves no formato: drawings/{categoria}/{arquivo}');
            console.log('   2. As imagens têm extensões válidas: .svg, .png, .jpg, .jpeg, .gif, .webp');
            console.log('   3. O bucket e as credenciais estão corretos');
        }
        return database;
    } catch (error) {
        console.error('Erro ao obter desenhos do S3:', error.message);
        throw error;
    }
}

/**
 * Gera URL pública de um objeto no S3
 * @param {string} key - Chave do objeto no S3 (ex: "drawings/animais/Cachorro.png")
 * @returns {string} URL pública do objeto
 */
function getS3PublicUrl(key) {
    // Remover barra inicial se houver
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    return `https://${bucketName}.s3.${region}.amazonaws.com/${cleanKey}`;
}

module.exports = {
    uploadToS3,
    isS3Available,
    listObjects,
    getDrawingsFromS3,
    getS3PublicUrl
};

