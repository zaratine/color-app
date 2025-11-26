// Serviço para gerenciar thumbnails de imagens
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { CUSTOM_DIR } = require('../config');
const { uploadToS3, uploadThumbnailToS3: uploadThumbnailToS3Service, objectExistsInS3, isS3Available, getS3PublicUrl, getThumbnailKey, getThumbnailFilename, extractKeyFromUrl, getObjectFromS3, listObjects } = require('./s3Service');

/**
 * Gera um thumbnail de uma imagem
 * @param {Buffer} imageBuffer - Buffer da imagem original
 * @param {number} width - Largura do thumbnail (padrão: 200px)
 * @returns {Promise<Buffer>} Buffer do thumbnail gerado
 */
async function generateThumbnail(imageBuffer, width = 168) {
    try {
        console.log(`    [generateThumbnail] Gerando thumbnail com largura ${width}px...`);
        const thumbnailBuffer = await sharp(imageBuffer)
            .resize(width, null, {
                withoutEnlargement: true,
                fit: 'inside',
                kernel: 'lanczos3' // Algoritmo de alta qualidade para redimensionamento
            })
            .webp({
                quality: 80,
                effort: 4
            })
            .toBuffer();
        
        console.log(`    [generateThumbnail] Thumbnail gerado (tamanho: ${thumbnailBuffer.length} bytes)`);
        return thumbnailBuffer;
    } catch (error) {
        console.error('    [generateThumbnail] Erro ao gerar thumbnail:', error.message);
        throw error;
    }
}

/**
 * Extrai a chave S3 original a partir da chave do thumbnail
 * @param {string} thumbnailKey - Chave S3 do thumbnail (ex: "drawings/customizados/thumb_desenho.png")
 * @returns {string|null} Chave S3 original (ex: "drawings/customizados/desenho.png") ou null se não for um thumbnail
 */
function getOriginalKeyFromThumbnailKey(thumbnailKey) {
    // Verificar se é um thumbnail (contém /thumb_ no caminho)
    const thumbIndex = thumbnailKey.indexOf('/thumb_');
    if (thumbIndex === -1) {
        // Não é um thumbnail
        return null;
    }
    
    // Extrair diretório e nome do arquivo
    const lastSlashIndex = thumbnailKey.lastIndexOf('/');
    if (lastSlashIndex === -1) {
        return null;
    }
    
    const directory = thumbnailKey.substring(0, lastSlashIndex + 1);
    const thumbnailFilename = thumbnailKey.substring(lastSlashIndex + 1);
    
    // Remover prefixo "thumb_" do nome do arquivo
    if (!thumbnailFilename.startsWith('thumb_')) {
        return null;
    }
    
    const originalFilename = thumbnailFilename.substring(6); // Remove "thumb_"
    
    return `${directory}${originalFilename}`;
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

        // Usar a função do s3Service que usa o cliente compartilhado
        return await uploadThumbnailToS3Service(thumbnailBuffer, key);
    } catch (error) {
        console.error('    [uploadThumbnailToS3] Erro ao fazer upload do thumbnail:', error.message);
        console.error('    [uploadThumbnailToS3] Stack:', error.stack);
        throw error;
    }
}

/**
 * Verifica se um thumbnail existe no S3
 * @param {string} thumbnailKey - Chave S3 do thumbnail
 * @returns {Promise<boolean>} true se o thumbnail existe, false caso contrário
 */
async function thumbnailExistsInS3(thumbnailKey) {
    return await objectExistsInS3(thumbnailKey);
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
        const thumbnailBuffer = await generateThumbnail(imageBuffer);
        
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
                console.error('    [generateAndSaveThumbnail] Stack do erro:', error.stack);
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
        const thumbnailBuffer = await generateThumbnail(Body);
        
        // Tentar salvar thumbnail no S3 (não crítico se falhar)
        const thumbnailKey = getThumbnailKey(originalKey);
        try {
            const thumbnailUrl = await uploadThumbnailToS3(thumbnailBuffer, path.basename(originalKey), originalKey);
            console.log('    [generateThumbnailFromUrl] ✅ Thumbnail gerado e salvo no S3 com sucesso');
        } catch (uploadError) {
            // Erro ao salvar não é crítico - continuar e retornar o thumbnail gerado
            console.warn('    [generateThumbnailFromUrl] ⚠️  Thumbnail gerado mas não foi salvo no S3:', uploadError.message);
            console.warn('    [generateThumbnailFromUrl] ⚠️  O thumbnail será retornado mesmo assim');
            // Continuar - não lançar erro
        }
        
        return thumbnailBuffer;
    } catch (error) {
        console.error('    [generateThumbnailFromUrl] Erro ao gerar thumbnail a partir da URL:', error.message);
        throw error;
    }
}

module.exports = {
    generateThumbnail,
    getOriginalKeyFromThumbnailKey,
    uploadThumbnailToS3,
    thumbnailExistsInS3,
    saveThumbnailLocally,
    generateAndSaveThumbnail,
    generateThumbnailFromUrl
};

