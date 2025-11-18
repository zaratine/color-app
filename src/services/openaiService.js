// Serviço para integração com OpenAI
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { openai, CUSTOM_DIR, apiKey } = require('../config');
const { generateFilename } = require('../utils/fileUtils');

// Prompt para geração de desenho
const DRAWING_PROMPT = `You are an illustration model that generates kids' coloring pages.

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
async function generateDrawing(theme) {
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
        const response = await openai.images.generate({
            model: 'gpt-image-1',
            prompt: prompt,
            output_format: 'png'
            //size: '1792x1024', // Aspect ratio 16:9 (aproximado)
            //quality: 'standard',
            //response_format: 'url' // Não suportado pelo modelo gpt-image-1-mini
        });

        console.log('    [generateDrawing] Resposta da OpenAI recebida');
        const imageUrl = response.data[0].url;
        console.log('    [generateDrawing] URL da imagem:', imageUrl);
        
        // Baixar a imagem usando https nativo
        console.log('    [generateDrawing] Baixando imagem...');
        const imageBuffer = await downloadImage(imageUrl);
        console.log('    [generateDrawing] Imagem baixada (tamanho:', imageBuffer.length, 'bytes)');
        
        // Gerar nome do arquivo e salvar
        const filename = generateFilename(theme);
        const filePath = path.join(CUSTOM_DIR, filename);
        console.log('    [generateDrawing] Tentando salvar em:', filePath);
        
        // Tentar salvar o arquivo (pode falhar em ambientes serverless como Vercel)
        try {
            // Verificar se o diretório existe antes de tentar escrever
            if (!fs.existsSync(CUSTOM_DIR)) {
                fs.mkdirSync(CUSTOM_DIR, { recursive: true });
            }
            fs.writeFileSync(filePath, imageBuffer);
            console.log('    [generateDrawing] Arquivo salvo com sucesso');
        } catch (error) {
            // Em ambientes serverless (Vercel), o sistema de arquivos é read-only
            // Retornamos o filename mesmo assim, mas o arquivo não será salvo permanentemente
            if (process.env.VERCEL || error.code === 'EROFS') {
                console.log('    [generateDrawing] Ambiente serverless detectado. Arquivo não será salvo permanentemente.');
                console.log('    [generateDrawing] A imagem foi gerada com sucesso, mas não pode ser persistida no sistema de arquivos.');
            } else {
                console.error('    [generateDrawing] Erro ao salvar arquivo:', error.message);
                throw error;
            }
        }
        
        return filename;
    } catch (error) {
        console.error('    [generateDrawing] Erro:', error.message);
        console.error('    [generateDrawing] Stack:', error.stack);
        throw error;
    }
}

module.exports = {
    generateDrawing
};

