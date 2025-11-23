# Análise de Gargalos - Carregamento de Listagens

## 🔴 Gargalo Crítico #1: Verificação Sequencial de Thumbnails no Backend

**Localização:** `src/services/s3Service.js` - função `getDrawingsFromS3()` (linha 296)

**Problema:**
Para cada desenho encontrado no S3, o código faz uma chamada **sequencial** ao S3 para verificar se o thumbnail existe:

```296:309:src/services/s3Service.js
                // Buscar metadata do thumbnail (existe e data de modificação)
                const thumbnailMetadata = await getThumbnailMetadata(thumbnailKey);
                if (thumbnailMetadata.exists) {
                    // Thumbnail existe, usar URL direta do S3 com versionamento baseado no timestamp
                    const baseUrl = getS3PublicUrl(thumbnailKey);
                    // Adicionar parâmetro de versão baseado no timestamp de modificação
                    // Isso força o navegador a buscar nova versão quando o thumbnail é regenerado
                    const versionParam = thumbnailMetadata.lastModified ? `?v=${thumbnailMetadata.lastModified}` : '';
                    thumbnailUrl = `${baseUrl}${versionParam}`;
                    console.log(`   ✅ Thumbnail encontrado: ${thumbnailKey} (versão: ${thumbnailMetadata.lastModified})`);
                } else {
                    // Thumbnail não existe, usar endpoint que gera sob demanda
                    thumbnailUrl = `/api/thumbnail?url=${encodeURIComponent(publicUrl)}`;
                    console.log(`   ⚠️  Thumbnail não encontrado, usando endpoint sob demanda: ${thumbnailKey}`);
                }
```

**Impacto:**
- Se houver **50 desenhos**, serão feitas **50 chamadas sequenciais** ao S3
- Cada chamada `HeadObjectCommand` leva ~100-300ms (dependendo da latência)
- **Tempo total estimado: 5-15 segundos** só para verificar thumbnails
- Isso acontece **a cada requisição** `/api/drawings` (sem cache no backend)

**Solução sugerida:**
1. **Opção A (Recomendada):** Remover a verificação prévia e sempre usar o endpoint `/api/thumbnail` que verifica e gera sob demanda. O endpoint já tem cache e é otimizado.
2. **Opção B:** Fazer verificações em paralelo usando `Promise.all()` em lotes (ex: 10 por vez)
3. **Opção C:** Cachear o resultado no backend (Redis ou memória) por um período

---

## 🟡 Gargalo Médio #2: Listagem Completa do S3 a Cada Requisição

**Localização:** `src/services/s3Service.js` - função `getDrawingsFromS3()` (linha 210)

**Problema:**
A função `listObjects()` lista **todos** os objetos do S3 com prefixo `drawings/` a cada requisição:

```158:194:src/services/s3Service.js
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
```

**Impacto:**
- Lista todos os objetos do S3 a cada requisição (sem cache no backend)
- Se houver muitos objetos, pode levar 1-3 segundos
- Isso acontece antes mesmo de processar os thumbnails

**Solução sugerida:**
1. Implementar cache no backend (em memória ou Redis) com TTL de 5-10 minutos
2. Invalidar cache apenas quando novos desenhos são adicionados

---

## 🟡 Gargalo Médio #3: Processamento Sequencial no Loop

**Localização:** `src/services/s3Service.js` - função `getDrawingsFromS3()` (linha 248)

**Problema:**
O loop processa cada objeto **sequencialmente**:

```248:321:src/services/s3Service.js
        // Processar cada objeto (usar for...of para suportar await)
        for (const obj of objects) {
            const key = obj.Key;
            console.log(`📦 Processando chave: ${key}`);
            
            // Ignorar se não for um arquivo de imagem
            const isImage = imageExtensions.some(ext => 
                key.toLowerCase().endsWith(ext)
            );
            
            if (!isImage) {
                console.log(`   ⏭️  Ignorado (não é imagem): ${key}`);
                continue;
            }
            
            // Ignorar thumbnails na listagem principal (só queremos as imagens originais)
            if (key.includes('/thumb_') || key.endsWith('thumb_')) {
                console.log(`   ⏭️  Ignorado (é thumbnail): ${key}`);
                continue;
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
                
                // Verificar se o thumbnail existe antes de criar a URL
                const thumbnailKey = getThumbnailKey(key);
                let thumbnailUrl = null;
                
                // Buscar metadata do thumbnail (existe e data de modificação)
                const thumbnailMetadata = await getThumbnailMetadata(thumbnailKey);
                if (thumbnailMetadata.exists) {
                    // Thumbnail existe, usar URL direta do S3 com versionamento baseado no timestamp
                    const baseUrl = getS3PublicUrl(thumbnailKey);
                    // Adicionar parâmetro de versão baseado no timestamp de modificação
                    // Isso força o navegador a buscar nova versão quando o thumbnail é regenerado
                    const versionParam = thumbnailMetadata.lastModified ? `?v=${thumbnailMetadata.lastModified}` : '';
                    thumbnailUrl = `${baseUrl}${versionParam}`;
                    console.log(`   ✅ Thumbnail encontrado: ${thumbnailKey} (versão: ${thumbnailMetadata.lastModified})`);
                } else {
                    // Thumbnail não existe, usar endpoint que gera sob demanda
                    thumbnailUrl = `/api/thumbnail?url=${encodeURIComponent(publicUrl)}`;
                    console.log(`   ⚠️  Thumbnail não encontrado, usando endpoint sob demanda: ${thumbnailKey}`);
                }
                
                database[category].drawings.push({
                    filename: filename,
                    url: publicUrl,
                    thumbnailUrl: thumbnailUrl
                });
                console.log(`   ➕ Arquivo adicionado à categoria "${category}"`);
            } else {
                console.log(`   ⚠️  Chave ignorada (formato inválido): ${key}`);
                console.log(`   💡 Formato esperado: drawings/{categoria}/{arquivo}`);
            }
        }
```

**Impacto:**
- Cada iteração espera a anterior terminar
- Com 50 desenhos e verificações de thumbnail, pode levar 10-20 segundos no total

**Solução sugerida:**
- Processar em paralelo usando `Promise.all()` ou `Promise.allSettled()` em lotes

---

## 🟢 Gargalo Menor #4: Múltiplos Logs no Console

**Localização:** Vários arquivos

**Problema:**
Há muitos `console.log()` que podem impactar performance em produção

**Impacto:**
- Baixo, mas pode somar alguns milissegundos

**Solução sugerida:**
- Usar biblioteca de logging com níveis (winston, pino) e desabilitar logs em produção

---

## 📊 Resumo dos Tempos Estimados

Para um cenário com **50 desenhos**:

| Operação | Tempo Estimado | Impacto |
|----------|---------------|---------|
| Listar objetos do S3 | 1-3s | Médio |
| Verificar 50 thumbnails (sequencial) | 5-15s | **CRÍTICO** |
| Processar e estruturar dados | 0.5-1s | Baixo |
| **TOTAL** | **6.5-19s** | **Muito lento** |

---

## 🎯 Prioridade de Correção

1. **URGENTE:** Remover verificação sequencial de thumbnails (Gargalo #1)
2. **ALTA:** Implementar cache no backend (Gargalo #2)
3. **MÉDIA:** Processar em paralelo (Gargalo #3)
4. **BAIXA:** Otimizar logs (Gargalo #4)

---

## 💡 Recomendações Imediatas

### Solução Rápida (Menos invasiva):
Remover a verificação prévia de thumbnails e sempre usar `/api/thumbnail`:

```javascript
// Em vez de verificar se existe, sempre usar o endpoint
thumbnailUrl = `/api/thumbnail?url=${encodeURIComponent(publicUrl)}`;
```

O endpoint `/api/thumbnail` já tem lógica para:
- Verificar se existe no S3
- Gerar sob demanda se não existir
- Cachear no navegador (Cache-Control: max-age=31536000)

### Solução Completa (Recomendada):
1. Remover verificação prévia de thumbnails
2. Implementar cache em memória no backend (TTL: 5-10 min)
3. Processar objetos em paralelo em lotes de 10-20

