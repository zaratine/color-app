// Serviço para integração com AWS S3
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { config } = require('../config');
const { formatDisplayName } = require('../utils/stringUtils');

/**
 * Gera o nome do arquivo do thumbnail a partir do nome original
 * @param {string} originalFilename - Nome do arquivo original (ex: "desenho.png")
 * @returns {string} Nome do arquivo thumbnail (ex: "thumb_desenho.png")
 */
function getThumbnailFilename(originalFilename) {
    const lastDotIndex = originalFilename.lastIndexOf('.');
    if (lastDotIndex === -1) {
        return `thumb_${originalFilename}`;
    }
    
    const name = originalFilename.substring(0, lastDotIndex);
    const extension = originalFilename.substring(lastDotIndex);
    return `thumb_${name}${extension}`;
}

/**
 * Gera a chave S3 do thumbnail a partir da chave original
 * @param {string} originalKey - Chave S3 original (ex: "drawings/customizados/desenho.png")
 * @returns {string} Chave S3 do thumbnail (ex: "drawings/customizados/thumb_desenho.png")
 */
function getThumbnailKey(originalKey) {
    const lastSlashIndex = originalKey.lastIndexOf('/');
    if (lastSlashIndex === -1) {
        return getThumbnailFilename(originalKey);
    }
    
    const directory = originalKey.substring(0, lastSlashIndex + 1);
    const filename = originalKey.substring(lastSlashIndex + 1);
    const thumbnailFilename = getThumbnailFilename(filename);
    
    return `${directory}${thumbnailFilename}`;
}

/**
 * Valida e retorna a configuração do S3
 * @returns {Object} {isConfigured, accessKeyId, secretAccessKey, region, bucketName}
 */
function _validateS3Config() {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || config.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || config.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || config.AWS_REGION || 'us-east-1';
    const bucketName = process.env.AWS_S3_BUCKET_NAME || config.AWS_S3_BUCKET_NAME;

    const isConfigured = accessKeyId && 
                         secretAccessKey && 
                         accessKeyId !== 'sua-access-key-aqui' && 
                         secretAccessKey !== 'sua-secret-key-aqui' &&
                         bucketName &&
                         bucketName !== 'nome-do-seu-bucket';

    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        if (isConfigured) {
            console.log('✅ S3 configurado. Bucket:', bucketName, 'Região:', region);
        } else {
            console.error('❌ S3 não configurado no ambiente Vercel/Produção!');
            console.error('❌ Configure as variáveis de ambiente no painel do Vercel.');
        }
    } else if (!isConfigured) {
        console.log('ℹ️  S3 não configurado. Usando salvamento local.');
    }

    return { isConfigured, accessKeyId, secretAccessKey, region, bucketName };
}

// Configurar cliente S3
const { isConfigured: isS3Configured, accessKeyId, secretAccessKey, region, bucketName } = _validateS3Config();

let s3Client = null;
if (isS3Configured) {
    s3Client = new S3Client({
        region: region,
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey
        }
    });
}

/**
 * Função genérica para fazer upload de objetos para o S3
 * @param {Buffer} buffer - Buffer do objeto
 * @param {string} key - Chave S3 completa
 * @param {string} contentType - Tipo MIME
 * @param {string} acl - ACL do objeto (padrão: 'public-read')
 * @returns {Promise<string>} URL pública do objeto no S3
 */
async function _uploadObjectToS3(buffer, key, contentType = 'image/png', acl = 'public-read') {
    if (!isS3Configured || !s3Client) {
        throw new Error('S3 não está configurado. Configure as variáveis de ambiente AWS.');
    }

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: acl
    });

    await s3Client.send(command);
    return getS3PublicUrl(key);
}

/**
 * Faz upload de uma imagem para o S3
 * @param {Buffer} imageBuffer - Buffer da imagem
 * @param {string} filename - Nome do arquivo (ex: "Cachorro_Patinando.png")
 * @param {string} contentType - Tipo MIME (ex: "image/png")
 * @returns {Promise<string>} URL pública da imagem no S3
 */
async function uploadToS3(imageBuffer, filename, contentType = 'image/png') {
    const key = `drawings/customizados/${filename}`;
    return await _uploadObjectToS3(imageBuffer, key, contentType);
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
        const objects = await listObjects('drawings/');
        
        if (objects.length === 0) {
            console.log('⚠️  Nenhum objeto encontrado com prefixo "drawings/"');
            return {};
        }

        const database = {};
        const imageExtensions = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp'];

        for (const obj of objects) {
            const key = obj.Key;
            
            // Ignorar se não for um arquivo de imagem
            const isImage = imageExtensions.some(ext => key.toLowerCase().endsWith(ext));
            if (!isImage) continue;
            
            // Ignorar thumbnails na listagem principal
            if (key.includes('/thumb_') || key.endsWith('thumb_')) continue;

            // Extrair categoria e nome do arquivo
            // Formato esperado: drawings/{categoria}/{arquivo}
            const parts = key.replace('drawings/', '').split('/');
            
            if (parts.length >= 2) {
                const category = parts[0];
                const filename = parts.slice(1).join('/');

                if (!database[category]) {
                    database[category] = {
                        displayName: formatDisplayName(category),
                        drawings: [],
                        source: 's3'
                    };
                }

                const thumbnailKey = getThumbnailKey(key);
                database[category].drawings.push({
                    filename: filename,
                    url: getS3PublicUrl(key),
                    thumbnailUrl: getS3PublicUrl(thumbnailKey)
                });
            }
        }

        // Ordenar desenhos em cada categoria por nome do arquivo
        Object.keys(database).forEach(category => {
            database[category].drawings.sort((a, b) => {
                const nameA = typeof a === 'string' ? a : a.filename;
                const nameB = typeof b === 'string' ? b : b.filename;
                return nameA.localeCompare(nameB);
            });
        });

        console.log(`📦 Categorias encontradas: ${Object.keys(database).length}`);
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
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    return `https://${bucketName}.s3.${region}.amazonaws.com/${cleanKey}`;
}

/**
 * Extrai a chave do S3 a partir de uma URL pública
 * @param {string} url - URL pública do S3
 * @returns {string|null} Chave do objeto ou null se a URL não for válida
 */
function extractKeyFromUrl(url) {
    if (!url) return null;
    
    try {
        // Formato: https://bucket-name.s3.region.amazonaws.com/key ou https://bucket-name.s3-region.amazonaws.com/key
        const urlPattern = new RegExp(`https://${bucketName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.s3[.-][^.]+\.amazonaws\\.com/(.+)`);
        const match = url.match(urlPattern);
        
        return match && match[1] ? decodeURIComponent(match[1]) : null;
    } catch (error) {
        console.error('Erro ao extrair chave da URL:', error);
        return null;
    }
}

/**
 * Busca um objeto do S3 e retorna o buffer
 * @param {string} key - Chave do objeto no S3 (ex: "drawings/animais/Cachorro.png")
 * @returns {Promise<{Body: Buffer, ContentType: string}>} Buffer e tipo de conteúdo do objeto
 */
async function getObjectFromS3(key) {
    if (!isS3Configured || !s3Client) {
        throw new Error('S3 não está configurado. Configure as variáveis de ambiente AWS.');
    }

    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key
        });

        const response = await s3Client.send(command);
        
        const chunks = [];
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        return {
            Body: buffer,
            ContentType: response.ContentType || 'image/png'
        };
    } catch (error) {
        console.error('Erro ao buscar objeto do S3:', error.message);
        throw error;
    }
}

/**
 * Verifica se um objeto existe no S3
 * @param {string} key - Chave do objeto no S3
 * @returns {Promise<boolean>} true se o objeto existe, false caso contrário
 */
async function objectExistsInS3(key) {
    if (!isS3Configured || !s3Client) {
        return false;
    }

    try {
        const command = new HeadObjectCommand({
            Bucket: bucketName,
            Key: key
        });

        await s3Client.send(command);
        return true;
    } catch (headError) {
        if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
            return false;
        }
        console.error('Erro ao verificar objeto no S3:', headError.message);
        return false;
    }
}

/**
 * Faz upload de um thumbnail para o S3
 * @param {Buffer} thumbnailBuffer - Buffer do thumbnail
 * @param {string} key - Chave S3 completa (ex: "drawings/customizados/thumb_desenho.png")
 * @returns {Promise<string>} URL pública do thumbnail no S3
 */
async function uploadThumbnailToS3(thumbnailBuffer, key) {
    return await _uploadObjectToS3(thumbnailBuffer, key, 'image/png');
}

module.exports = {
    uploadToS3,
    uploadThumbnailToS3,
    objectExistsInS3,
    isS3Available,
    listObjects,
    getDrawingsFromS3,
    getS3PublicUrl,
    getThumbnailKey,
    getThumbnailFilename,
    extractKeyFromUrl,
    getObjectFromS3,
    _uploadObjectToS3
};

