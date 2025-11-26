// Rotas da API
const express = require('express');
const router = express.Router();
const { getDrawings, createDrawing } = require('../controllers/drawingsController');
const { extractKeyFromUrl, getObjectFromS3, getThumbnailKey, isS3Available, objectExistsInS3, uploadThumbnailToS3: uploadThumbnailToS3Direct } = require('../services/s3Service');
const { generateThumbnailFromUrl, thumbnailExistsInS3, getOriginalKeyFromThumbnailKey, generateThumbnail } = require('../services/thumbnailService');

// GET /api/drawings - Lista todos os desenhos
router.get('/drawings', getDrawings);

// POST /api/generate-drawing - Gera um novo desenho
router.post('/generate-drawing', createDrawing);

// GET /api/proxy-image - Proxy para servir imagens do S3 com CORS
router.get('/proxy-image', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        
        if (!imageUrl) {
            // Retornar imagem placeholder em vez de JSON para evitar ORB
            res.status(400);
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
        }

        // Extrair chave do S3 da URL
        const key = extractKeyFromUrl(imageUrl);
        
        if (!key) {
            // Retornar imagem placeholder em vez de JSON para evitar ORB
            res.status(400);
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
        }

        // Verificar se é um thumbnail (contém /thumb_ no caminho)
        const isThumbnail = key.includes('/thumb_');
        
        if (isThumbnail) {
            // Verificar se o thumbnail existe no S3
            const thumbnailExists = await objectExistsInS3(key);
            
            if (!thumbnailExists) {
                console.log(`    [GET /api/proxy-image] Thumbnail não encontrado: ${key}`);
                console.log(`    [GET /api/proxy-image] Gerando thumbnail sob demanda...`);
                
                // Extrair chave da imagem original
                const originalKey = getOriginalKeyFromThumbnailKey(key);
                
                if (!originalKey) {
                    console.error(`    [GET /api/proxy-image] Não foi possível extrair chave original de: ${key}`);
                    // Retornar imagem placeholder
                    res.status(404);
                    res.setHeader('Content-Type', 'image/png');
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    return res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
                }
                
                // Verificar se a imagem original existe
                const originalExists = await objectExistsInS3(originalKey);
                if (!originalExists) {
                    console.error(`    [GET /api/proxy-image] Imagem original não encontrada: ${originalKey}`);
                    // Retornar imagem placeholder
                    res.status(404);
                    res.setHeader('Content-Type', 'image/png');
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    return res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
                }
                
                try {
                    // Buscar imagem original do S3
                    console.log(`    [GET /api/proxy-image] Buscando imagem original: ${originalKey}`);
                    const { Body: originalImageBuffer } = await getObjectFromS3(originalKey);
                    
                    // Gerar thumbnail
                    console.log(`    [GET /api/proxy-image] Gerando thumbnail a partir da imagem original...`);
                    const thumbnailBuffer = await generateThumbnail(originalImageBuffer);
                    
                    // Salvar thumbnail no S3 para uso futuro
                    try {
                        console.log(`    [GET /api/proxy-image] Salvando thumbnail no S3: ${key}`);
                        // Usar a função direta do s3Service que recebe (buffer, key)
                        const thumbnailUrl = await uploadThumbnailToS3Direct(thumbnailBuffer, key);
                        console.log(`    [GET /api/proxy-image] ✅ Thumbnail salvo no S3 com sucesso: ${thumbnailUrl}`);
                        
                        // Verificar se foi salvo corretamente
                        const saved = await objectExistsInS3(key);
                        if (saved) {
                            console.log(`    [GET /api/proxy-image] ✅ Confirmação: Thumbnail existe no S3`);
                        } else {
                            console.warn(`    [GET /api/proxy-image] ⚠️  Aviso: Thumbnail pode não ter sido salvo corretamente`);
                        }
                    } catch (saveError) {
                        console.error(`    [GET /api/proxy-image] ❌ Erro ao salvar thumbnail no S3:`, saveError.message);
                        console.error(`    [GET /api/proxy-image] Stack do erro:`, saveError.stack);
                        // Continuar mesmo se não conseguir salvar (thumbnail já foi gerado)
                    }
                    
                    // Configurar headers CORS
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'GET');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                    res.setHeader('Content-Type', 'image/webp');
                    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache por 1 ano
                    
                    // Enviar thumbnail gerado
                    console.log(`    [GET /api/proxy-image] Thumbnail gerado e enviado com sucesso`);
                    return res.send(thumbnailBuffer);
                } catch (genError) {
                    console.error(`    [GET /api/proxy-image] Erro ao gerar thumbnail:`, genError.message);
                    // Retornar imagem placeholder em vez de JSON
                    res.status(500);
                    res.setHeader('Content-Type', 'image/png');
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    return res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
                }
            }
        }

        // Buscar objeto do S3 (thumbnail existente ou imagem normal)
        const { Body, ContentType } = await getObjectFromS3(key);

        // Configurar headers CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', ContentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache por 1 ano

        // Enviar imagem
        res.send(Body);
    } catch (error) {
        console.error('    [GET /api/proxy-image] Erro no proxy de imagem:', error.message);
        console.error('    [GET /api/proxy-image] Stack:', error.stack);
        
        // Sempre retornar imagem (não JSON) para evitar ORB
        // Retornar imagem placeholder transparente 1x1
        res.status(500);
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        // Imagem PNG transparente 1x1
        const placeholder = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
        res.send(placeholder);
    }
});

// GET /api/thumbnail - Gera thumbnail sob demanda se não existir
router.get('/thumbnail', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'Parâmetro "url" é obrigatório' });
        }

        // Extrair chave do S3 da URL original
        const originalKey = extractKeyFromUrl(imageUrl);
        
        if (!originalKey) {
            return res.status(400).json({ error: 'URL inválida do S3' });
        }

        // Verificar se S3 está disponível
        if (!isS3Available()) {
            return res.status(503).json({ error: 'S3 não está configurado' });
        }

        // Obter chave do thumbnail
        const thumbnailKey = getThumbnailKey(originalKey);
        
        // Verificar se thumbnail já existe
        const exists = await thumbnailExistsInS3(thumbnailKey);
        
        let thumbnailBuffer;
        
        if (exists) {
            // Thumbnail existe, buscar do S3
            console.log('    [GET /api/thumbnail] Thumbnail encontrado no S3, buscando...');
            const { Body } = await getObjectFromS3(thumbnailKey);
            thumbnailBuffer = Body;
        } else {
            // Thumbnail não existe, gerar sob demanda
            console.log('    [GET /api/thumbnail] Thumbnail não encontrado, gerando sob demanda...');
            console.log('    [GET /api/thumbnail] Chave original:', originalKey);
            console.log('    [GET /api/thumbnail] Chave do thumbnail:', thumbnailKey);
            
            // Gerar thumbnail (a função generateThumbnailFromUrl já salva no S3)
            thumbnailBuffer = await generateThumbnailFromUrl(imageUrl);
            
            // Verificar se foi salvo corretamente
            const saved = await thumbnailExistsInS3(thumbnailKey);
            if (saved) {
                console.log('    [GET /api/thumbnail] ✅ Thumbnail gerado e salvo no S3 com sucesso');
            } else {
                console.warn('    [GET /api/thumbnail] ⚠️  Thumbnail gerado mas não foi salvo no S3');
            }
        }

        // Configurar headers CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache por 1 ano

        // Enviar thumbnail
        res.send(thumbnailBuffer);
    } catch (error) {
        console.error('Erro ao gerar/buscar thumbnail:', error);
        res.status(500).json({ error: 'Erro ao gerar/buscar thumbnail', message: error.message });
    }
});

module.exports = router;

