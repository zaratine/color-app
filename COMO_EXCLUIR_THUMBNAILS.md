# Como Excluir Todos os Thumbnails do S3

Existem três formas de excluir todos os thumbnails que começam com `thumb_` no S3:

## Opção 1: Script Node.js (Recomendado) ✅

Use o script utilitário criado para listar e excluir thumbnails:

### Listar thumbnails (sem excluir)
```bash
node scripts/delete-thumbnails.js --list
```

### Excluir todos os thumbnails
```bash
node scripts/delete-thumbnails.js --delete
```

O script irá:
- Listar todos os thumbnails encontrados em todas as pastas
- Mostrar estatísticas por pasta
- Excluir em lote (até 1000 por vez)
- Mostrar progresso e erros (se houver)

**Vantagens:**
- Usa as mesmas credenciais do projeto
- Mostra estatísticas detalhadas
- Exclusão em lote eficiente
- Tratamento de erros

---

## Opção 2: AWS CLI

Se você tem a AWS CLI instalada e configurada:

### Listar thumbnails
```bash
aws s3 ls s3://SEU_BUCKET/drawings/ --recursive | grep "/thumb_"
```

### Excluir todos os thumbnails (cuidado!)
```bash
# Primeiro, liste para confirmar
aws s3 ls s3://SEU_BUCKET/drawings/ --recursive | grep "/thumb_" | awk '{print $4}' > thumbnails.txt

# Depois exclua (cuidado - isso exclui tudo!)
aws s3 rm s3://SEU_BUCKET/drawings/ --recursive --exclude "*" --include "*/thumb_*"
```

**Substitua `SEU_BUCKET` pelo nome do seu bucket S3.**

**Vantagens:**
- Não precisa do Node.js
- Comando direto

**Desvantagens:**
- Precisa ter AWS CLI instalado
- Comando mais complexo para múltiplas pastas

---

## Opção 3: Console Web do S3

1. Acesse o [Console do AWS S3](https://s3.console.aws.amazon.com/)
2. Navegue até seu bucket
3. Vá para a pasta `drawings/`
4. Use a busca/filtro para encontrar arquivos com `thumb_` no nome
5. Selecione manualmente e exclua

**Vantagens:**
- Interface visual
- Bom para verificar antes de excluir

**Desvantagens:**
- Trabalhoso se houver muitos arquivos
- Não permite seleção em massa fácil

---

## Recomendação

**Use o script Node.js** (`scripts/delete-thumbnails.js`) porque:
- ✅ É mais seguro (mostra o que será excluído antes)
- ✅ Funciona com as credenciais já configuradas no projeto
- ✅ Mostra estatísticas úteis
- ✅ Exclusão eficiente em lote

---

## Nota Importante

⚠️ **Os thumbnails serão regenerados automaticamente** quando:
- Um usuário acessar uma imagem que não tem thumbnail
- O endpoint `/api/thumbnail` for chamado
- Uma nova imagem for gerada

Portanto, excluir os thumbnails antigos (de 100px) é seguro - eles serão recriados com a nova qualidade (200px) quando necessário.

