// Serviço para integração com OpenAI
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { openai, CUSTOM_DIR, apiKey } = require('../config');
const { generateFilename } = require('../utils/fileUtils');
const { uploadToS3, isS3Available, extractKeyFromUrl, _uploadObjectToS3 } = require('./s3Service');
const { generateAndSaveThumbnail } = require('./thumbnailService');

// Prompt para geração de desenho
const DRAWING_PROMPT = `

You are an illustration model that generates kids' coloring pages.

TASK
Create a single black-and-white line drawing for children to color.

MAIN SUBJECT
Draw: REPLACE_THEME

STYLE
Cute, friendly, CHILDLIKE style, like a kids' coloring book.
Clear, smooth outlines with consistent stroke width.
Only BLACK outlines on a WHITE background (no gray, no shading, no textures, no color).
Big, simple, closed shapes that are easy for kids to color.
Add a few small, simple decorative elements that match the theme (for example: little clouds, stars, hearts, simple waves, flowers, etc.), but keep the page clean and not crowded.
All elements must have soft, rounded, cute shapes. No realistic or scary style.

OUTLINE & SHAPE RULES (CRITICAL)
All outlines MUST be fully closed shapes — absolutely no gaps, breaks, or open contours.
Every region that should be colorable must be completely enclosed by clear black lines.

Faces, hair, clothing, objects, and decorations must each have their own fully closed outline.
Hair and face MUST be separated by a continuous closed outline.
Arms, clothing, body parts, and accessories must never share an open border — each must be individually enclosed.

Always check that:
- Every shape has an unbroken, continuous outer boundary.
- No two areas depend on a shared open line to define their separation.
- All lines connect cleanly at corners (no micro-gaps or overlaps).
- Every fillable region is a distinct, closed shape for the bucket tool.

No gaps, no shared outlines, no implied edges — everything must be explicitly and fully closed.

COMPOSITION
Landscape orientation (horizontal) like a printable coloring page.
Aspect ratio of 16:9, always LANDSCAPE.
Main characters centered or slightly off-center, large and clearly visible.
Simple background made only of line art (no filled areas, no patterns).

VERY IMPORTANT – OBJECTS AND BORDERS

1) Ground / Water / Base Area (for flood fill)
The ground / floor / water / base of the scene must form a continuous band that touches the left and right edges of the canvas (and can also touch the bottom edge).
This base area is the only element that is allowed to touch or be cut by the canvas border.
The outline of this base must still create a closed region so that a flood-fill/bucket tool can fill it correctly (no gaps or open shapes, even near the borders).

2) All Other Elements
Do not crop or cut any other object at the edges of the image.
No other element (characters, boat, hats, hair, hands, telescope, oars, clouds, stars, hearts, waves, flowers, etc.) may touch or intersect the border of the canvas.
Leave a clean white margin around all these elements (at least 5–10% of the canvas on all sides), so they are fully inside the scene and not cropped.
If any object would be partially outside the frame, move or resize it so that it is completely inside the canvas.

3) Frame
The frame should not have any border or background.

OUTPUT FORMAT
Return a single raster image in PNG format.
Aspect ratio of 16:9, always LANDSCAPE.
Do NOT return SVG, code, XML, or text art.
The result must look like a printable kids' coloring page.

NEGATIVE CONSTRAINTS
No colors other than black outlines on white background.
No border around the image.
No gradients, no shading, no sketchy or messy lines.
No cropped elements at the edges, except for the ground/water/base band described above.
No text, letters, numbers, logos, watermarks, or signatures.
No realistic gore, fear, weapons, or adult themes.`;

// Função para baixar imagem de uma URL
function downloadImage(imageUrl) {
    return new Promise((resolve, reject) => {
        console.log('      [downloadImage] Iniciando download de:', imageUrl);
        const urlObj = new URL(imageUrl);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        protocol.get(imageUrl, (response) => {
            console.log('      [downloadImage] Status code:', response.statusCode);
            if (response.statusCode !== 200) {
                reject(new Error(`Erro ao baixar imagem: ${response.statusCode}`));
                return;
            }
            
            const chunks = [];
            let totalSize = 0;
            response.on('data', (chunk) => {
                chunks.push(chunk);
                totalSize += chunk.length;
            });
            
            response.on('end', () => {
                console.log('      [downloadImage] Download completo. Tamanho total:', totalSize, 'bytes');
                resolve(Buffer.concat(chunks));
            });
            
            response.on('error', (error) => {
                console.error('      [downloadImage] Erro no stream:', error);
                reject(error);
            });
        }).on('error', (error) => {
            console.error('      [downloadImage] Erro na requisição:', error);
            reject(error);
        });
    });
}

// Função para gerar desenho usando OpenAI
async function generateDrawing(theme, category = null) {
    // Validar se a chave da API está configurada
    if (!apiKey || apiKey === 'sua-chave-aqui') {
        const error = new Error('OPENAI_API_KEY não configurada. Por favor, edite o arquivo config.js e adicione sua chave da API.');
        error.statusCode = 500;
        throw error;
    }

    try {
        console.log('    [generateDrawing] Iniciando geração...');
        const prompt = DRAWING_PROMPT.replace('REPLACE_THEME', theme);
        console.log('    [generateDrawing] Prompt criado (tamanho:', prompt.length, 'caracteres)');
        
        console.log('    [generateDrawing] Chamando OpenAI API...');
        // Definir formato de saída
        const outputFormat = 'webp'; // apenas para o modelo gpt-image-1
        const response = await openai.images.generate({
            model: 'gpt-image-1',
            //model: 'dall-e-3',
            prompt: prompt,
            background: 'opaque',
            quality: 'medium',
            output_format: outputFormat,
            //size: '1792x1024', // Aspect ratio 16:9 (aproximado)
            size: '1536x1024',
            //quality: 'standard',
            //response_format: 'url' // Não suportado pelo modelo gpt-image-1-mini
        });

        console.log('    [generateDrawing] Resposta da OpenAI recebida');
        
        // Verificar se a resposta tem dados
        if (!response || !response.data || !Array.isArray(response.data) || response.data.length === 0) {
            throw new Error('Resposta da OpenAI inválida: nenhum dado retornado');
        }
        
        const imageData = response.data[0];
        let imageBuffer;
        
        // Verificar se a resposta contém URL ou base64
        if (imageData.url) {
            console.log('    [generateDrawing] URL da imagem encontrada:', imageData.url);
            // Baixar a imagem usando https nativo
            console.log('    [generateDrawing] Baixando imagem...');
            imageBuffer = await downloadImage(imageData.url);
        } else if (imageData.b64_json) {
            console.log('    [generateDrawing] Imagem em base64 encontrada');
            // Converter base64 para buffer
            imageBuffer = Buffer.from(imageData.b64_json, 'base64');
            console.log('    [generateDrawing] Imagem convertida de base64 (tamanho:', imageBuffer.length, 'bytes)');
        } else {
            console.error('    [generateDrawing] Estrutura da resposta:', JSON.stringify(imageData, null, 2));
            throw new Error('Resposta da OpenAI não contém URL nem base64. Estrutura: ' + JSON.stringify(Object.keys(imageData)));
        }
        console.log('    [generateDrawing] Imagem baixada (tamanho:', imageBuffer.length, 'bytes)');
        
        // Determinar formato e extensão baseado no output_format
        const imageFormat = outputFormat === 'webp' ? 'webp' : 'png';
        const contentType = outputFormat === 'webp' ? 'image/webp' : 'image/png';
        
        // Gerar nome do arquivo com a extensão correta
        const filename = generateFilename(theme, imageFormat);
        
        // Determinar categoria (converter para minúsculo se fornecida)
        const normalizedCategory = category ? category.toLowerCase() : 'customizados';
        
        // Tentar fazer upload para S3 primeiro (se configurado)
        if (isS3Available()) {
            try {
                console.log(`    [generateDrawing] Tentando fazer upload para S3 na categoria: ${normalizedCategory}...`);
                const key = `drawings/${normalizedCategory}/${filename}`;
                const s3Url = await _uploadObjectToS3(imageBuffer, key, contentType);
                console.log('    [generateDrawing] Upload para S3 concluído com sucesso');
                
                // Gerar e salvar thumbnail automaticamente
                try {
                    console.log('    [generateDrawing] Gerando thumbnail...');
                    const thumbnailResult = await generateAndSaveThumbnail(imageBuffer, filename, key);
                    if (thumbnailResult.url) {
                        console.log('    [generateDrawing] Thumbnail gerado e salvo no S3 com sucesso:', thumbnailResult.url);
                    } else if (thumbnailResult.localPath) {
                        console.log('    [generateDrawing] Thumbnail gerado e salvo localmente com sucesso:', thumbnailResult.localPath);
                    } else {
                        console.warn('    [generateDrawing] Thumbnail gerado mas não foi salvo (nenhum storage disponível)');
                    }
                } catch (thumbnailError) {
                    // Não falhar a geração do desenho se o thumbnail falhar
                    console.error('    [generateDrawing] Erro ao gerar thumbnail (não crítico):', thumbnailError.message);
                    console.error('    [generateDrawing] Stack do erro do thumbnail:', thumbnailError.stack);
                }
                
                return {
                    filename: filename,
                    url: s3Url,
                    storage: 's3'
                };
            } catch (error) {
                console.error('    [generateDrawing] Erro ao fazer upload para S3:', error.message);
                console.log('    [generateDrawing] Tentando fallback para salvamento local...');
                // Continuar para tentar salvamento local como fallback
            }
        }
        
        // Fallback: tentar salvar localmente (apenas em desenvolvimento)
        const filePath = path.join(CUSTOM_DIR, filename);
        console.log('    [generateDrawing] Tentando salvar localmente em:', filePath);
        
        try {
            // Verificar se o diretório existe antes de tentar escrever
            if (!fs.existsSync(CUSTOM_DIR)) {
                fs.mkdirSync(CUSTOM_DIR, { recursive: true });
            }
            fs.writeFileSync(filePath, imageBuffer);
            console.log('    [generateDrawing] Arquivo salvo localmente com sucesso');
            
            // Gerar e salvar thumbnail localmente também
            try {
                console.log('    [generateDrawing] Gerando thumbnail localmente...');
                await generateAndSaveThumbnail(imageBuffer, filename);
                console.log('    [generateDrawing] Thumbnail gerado e salvo localmente com sucesso');
            } catch (thumbnailError) {
                // Não falhar a geração do desenho se o thumbnail falhar
                console.error('    [generateDrawing] Erro ao gerar thumbnail localmente (não crítico):', thumbnailError.message);
            }
            
            // Retornar apenas filename para compatibilidade com código existente
            return {
                filename: filename,
                url: `/drawings/${normalizedCategory}/${filename}`,
                storage: 'local'
            };
        } catch (error) {
            // Em ambientes serverless (Vercel), o sistema de arquivos é read-only
            if (process.env.VERCEL || error.code === 'EROFS') {
                console.log('    [generateDrawing] Ambiente serverless detectado e S3 não configurado.');
                console.log('    [generateDrawing] A imagem foi gerada com sucesso, mas não pode ser persistida.');
                console.log('    [generateDrawing] Configure o S3 para salvar as imagens permanentemente.');
                
                // Retornar apenas o filename mesmo sem salvar (para não quebrar a API)
                return {
                    filename: filename,
                    url: null,
                    storage: 'none'
                };
            } else {
                console.error('    [generateDrawing] Erro ao salvar arquivo:', error.message);
                throw error;
            }
        }
    } catch (error) {
        console.error('    [generateDrawing] Erro:', error.message);
        console.error('    [generateDrawing] Stack:', error.stack);
        throw error;
    }
}

module.exports = {
    generateDrawing
};

