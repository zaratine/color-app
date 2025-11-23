// Serviço para gerenciar thumbnails de imagens
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { CUSTOM_DIR } = require('../config');
const { uploadToS3, isS3Available, getS3PublicUrl, extractKeyFromUrl, getObjectFromS3, listObjects } = require('./s3Service');

/**
 * Gera um thumbnail de uma imagem
 * @param {Buffer} imageBuffer - Buffer da imagem original
 * @param {number} width - Largura do thumbnail (padrão: 100px)
 * @returns {Promise<Buffer>} Buffer do thumbnail gerado
 */
async function generateThumbnail(imageBuffer, width = 100) {
    try {
        console.log(`    [generateThumbnail] Gerando thumbnail com largura ${width}px...`);
        const thumbnailBuffer = await sharp(imageBuffer)
            .resize(width, null, {
                withoutEnlargement: true,
                fit: 'inside'
            })
            .png()
            .toBuffer();
        
        console.log(`    [generateThumbnail] Thumbnail gerado (tamanho: ${thumbnailBuffer.length} bytes)`);
        return thumbnailBuffer;
    } catch (error) {
        console.error('    [generateThumbnail] Erro ao gerar thumbnail:', error.message);
        throw error;
    }
}

/**
 * Gera o nome do arquivo do thumbnail a partir do nome original
 * @param {string} originalFilename - Nome do arquivo original (ex: "desenho.png")
 * @returns {string} Nome do arquivo thumbnail (ex: "thumb_desenho.png")
 */
function getThumbnailFilename(originalFilename) {
    // Extrair nome e extensão
    const lastDotIndex = originalFilename.lastIndexOf('.');
    if (lastDotIndex === -1) {
        // Sem extensão, apenas adicionar prefixo
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
    // Extrair diretório e nome do arquivo
    const lastSlashIndex = originalKey.lastIndexOf('/');
    if (lastSlashIndex === -1) {
        // Sem diretório, apenas adicionar prefixo
        return getThumbnailFilename(originalKey);
    }
    
    const directory = originalKey.substring(0, lastSlashIndex + 1);
    const filename = originalKey.substring(lastSlashIndex + 1);
    const thumbnailFilename = getThumbnailFilename(filename);
    
    return `${directory}${thumbnailFilename}`;
}

/**
 * Faz upload do thumbnail para o S3
 * @param {Buffer} thumbnailBuffer - Buffer do thumbnail
 * @param {string} originalFilename - Nome do arquivo original
 * @param {string} originalKey - Chave S3 original (opcional, será construída se não fornecida)
 * @returns {Promise<string>} URL pública do thumbnail no S3
 */
async function uploadThumbnailToS3(thumbnailBuffer, originalFilename, originalKey = null) {
    if (!isS3Available()) {
        throw new Error('S3 não está configurado. Configure as variáveis de ambiente AWS.');
    }

    try {
        // Se originalKey não foi fornecida, construir a partir do filename
        let key;
        if (originalKey) {
            key = getThumbnailKey(originalKey);
        } else {
            // Assumir que está na pasta customizados
            const thumbnailFilename = getThumbnailFilename(originalFilename);
            key = `drawings/customizados/${thumbnailFilename}`;
        }

        console.log(`    [uploadThumbnailToS3] Fazendo upload do thumbnail...`);
        console.log(`    [uploadThumbnailToS3] Key: ${key}`);
        console.log(`    [uploadThumbnailToS3] Tamanho: ${thumbnailBuffer.length} bytes`);

        // Usar a função uploadToS3 existente, mas precisamos adaptar
        // Vamos fazer o upload diretamente aqui
        const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
        const { config } = require('../config');
        
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID || config.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || config.AWS_SECRET_ACCESS_KEY;
        const region = process.env.AWS_REGION || config.AWS_REGION || 'us-east-1';
        const bucketName = process.env.AWS_S3_BUCKET_NAME || config.AWS_S3_BUCKET_NAME;

        const s3Client = new S3Client({
            region: region,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey
            }
        });

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: thumbnailBuffer,
            ContentType: 'image/png',
            ACL: 'public-read'
        });

        await s3Client.send(command);
        console.log('    [uploadThumbnailToS3] Upload do thumbnail concluído com sucesso');

        // Construir URL pública
        const publicUrl = getS3PublicUrl(key);
        console.log('    [uploadThumbnailToS3] URL pública do thumbnail:', publicUrl);

        return publicUrl;
    } catch (error) {
        console.error('    [uploadThumbnailToS3] Erro ao fazer upload do thumbnail:', error.message);
        throw error;
    }
}

/**
 * Verifica se um thumbnail existe no S3
 * @param {string} thumbnailKey - Chave S3 do thumbnail
 * @returns {Promise<boolean>} true se o thumbnail existe, false caso contrário
 */
async function thumbnailExistsInS3(thumbnailKey) {
    if (!isS3Available()) {
        return false;
    }

    try {
        // Usar HeadObjectCommand para verificar se o objeto existe
        const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
        const { config } = require('../config');
        
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID || config.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || config.AWS_SECRET_ACCESS_KEY;
        const region = process.env.AWS_REGION || config.AWS_REGION || 'us-east-1';
        const bucketName = process.env.AWS_S3_BUCKET_NAME || config.AWS_S3_BUCKET_NAME;

        const s3Client = new S3Client({
            region: region,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey
            }
        });

        const command = new HeadObjectCommand({
            Bucket: bucketName,
            Key: thumbnailKey
        });

        try {
            await s3Client.send(command);
            return true; // Objeto existe
        } catch (headError) {
            // Se o erro for 404 (Not Found), o objeto não existe
            if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
                return false;
            }
            // Outros erros são propagados
            throw headError;
        }
    } catch (error) {
        console.error('    [thumbnailExistsInS3] Erro ao verificar thumbnail no S3:', error.message);
        return false;
    }
}

/**
 * Salva thumbnail localmente (apenas para desenvolvimento)
 * @param {Buffer} thumbnailBuffer - Buffer do thumbnail
 * @param {string} originalFilename - Nome do arquivo original
 * @returns {Promise<string>} Caminho relativo do thumbnail salvo
 */
async function saveThumbnailLocally(thumbnailBuffer, originalFilename) {
    try {
        const thumbnailFilename = getThumbnailFilename(originalFilename);
        const filePath = path.join(CUSTOM_DIR, thumbnailFilename);
        
        // Verificar se o diretório existe
        if (!fs.existsSync(CUSTOM_DIR)) {
            fs.mkdirSync(CUSTOM_DIR, { recursive: true });
        }
        
        fs.writeFileSync(filePath, thumbnailBuffer);
        console.log('    [saveThumbnailLocally] Thumbnail salvo localmente:', filePath);
        
        return `/drawings/customizados/${thumbnailFilename}`;
    } catch (error) {
        console.error('    [saveThumbnailLocally] Erro ao salvar thumbnail localmente:', error.message);
        throw error;
    }
}

/**
 * Gera e salva thumbnail (S3 e/ou local)
 * @param {Buffer} imageBuffer - Buffer da imagem original
 * @param {string} originalFilename - Nome do arquivo original
 * @param {string} originalKey - Chave S3 original (opcional)
 * @returns {Promise<{url: string|null, localPath: string|null}>} URLs do thumbnail salvo
 */
async function generateAndSaveThumbnail(imageBuffer, originalFilename, originalKey = null) {
    try {
        console.log('    [generateAndSaveThumbnail] Iniciando geração e salvamento do thumbnail...');
        
        // Gerar thumbnail
        const thumbnailBuffer = await generateThumbnail(imageBuffer, 100);
        
        const result = {
            url: null,
            localPath: null
        };

        // Tentar salvar no S3 primeiro (se configurado)
        if (isS3Available()) {
            try {
                result.url = await uploadThumbnailToS3(thumbnailBuffer, originalFilename, originalKey);
                console.log('    [generateAndSaveThumbnail] Thumbnail salvo no S3 com sucesso');
            } catch (error) {
                console.error('    [generateAndSaveThumbnail] Erro ao salvar thumbnail no S3:', error.message);
                // Continuar para tentar salvar localmente como fallback
            }
        }

        // Tentar salvar localmente (apenas em desenvolvimento, se S3 não funcionou ou não está configurado)
        if (!result.url) {
            try {
                result.localPath = await saveThumbnailLocally(thumbnailBuffer, originalFilename);
                console.log('    [generateAndSaveThumbnail] Thumbnail salvo localmente com sucesso');
            } catch (error) {
                // Em ambientes serverless (Vercel), o sistema de arquivos é read-only
                if (process.env.VERCEL || error.code === 'EROFS') {
                    console.log('    [generateAndSaveThumbnail] Ambiente serverless detectado. Thumbnail não pode ser salvo localmente.');
                } else {
                    console.error('    [generateAndSaveThumbnail] Erro ao salvar thumbnail localmente:', error.message);
                }
            }
        }

        return result;
    } catch (error) {
        console.error('    [generateAndSaveThumbnail] Erro ao gerar e salvar thumbnail:', error.message);
        throw error;
    }
}

/**
 * Gera thumbnail sob demanda a partir de uma URL de imagem original
 * @param {string} originalImageUrl - URL da imagem original
 * @returns {Promise<Buffer>} Buffer do thumbnail gerado
 */
async function generateThumbnailFromUrl(originalImageUrl) {
    try {
        console.log('    [generateThumbnailFromUrl] Gerando thumbnail a partir da URL:', originalImageUrl);
        
        // Extrair chave do S3 da URL
        const originalKey = extractKeyFromUrl(originalImageUrl);
        if (!originalKey) {
            throw new Error('URL inválida do S3');
        }

        // Baixar imagem original do S3
        const { Body, ContentType } = await getObjectFromS3(originalKey);
        
        // Gerar thumbnail
        const thumbnailBuffer = await generateThumbnail(Body, 100);
        
        // Salvar thumbnail no S3
        const thumbnailKey = getThumbnailKey(originalKey);
        const thumbnailUrl = await uploadThumbnailToS3(thumbnailBuffer, path.basename(originalKey), originalKey);
        
        console.log('    [generateThumbnailFromUrl] Thumbnail gerado e salvo com sucesso');
        return thumbnailBuffer;
    } catch (error) {
        console.error('    [generateThumbnailFromUrl] Erro ao gerar thumbnail a partir da URL:', error.message);
        throw error;
    }
}

module.exports = {
    generateThumbnail,
    getThumbnailFilename,
    getThumbnailKey,
    uploadThumbnailToS3,
    thumbnailExistsInS3,
    saveThumbnailLocally,
    generateAndSaveThumbnail,
    generateThumbnailFromUrl
};

