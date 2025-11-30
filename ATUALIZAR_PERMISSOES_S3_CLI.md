# Como Atualizar Permissões IAM para Usar AWS CLI

Este guia explica como atualizar as permissões IAM para permitir que o AWS CLI faça download de todo o conteúdo do bucket S3.

## Problema Atual

O usuário IAM `color-app-s3-user` não tem permissão para listar o bucket (`s3:ListBucket`), o que é necessário para o comando `aws s3 sync` funcionar.

## Solução: Atualizar a Política IAM

### Passo 1: Acessar o Console IAM

1. Acesse o [Console IAM da AWS](https://console.aws.amazon.com/iam/)
2. Faça login com sua conta AWS

### Passo 2: Encontrar a Política Atual

1. No menu lateral esquerdo, clique em **"Policies"** (Políticas)
2. Na barra de busca, digite `ColorAppS3Policy` (ou o nome da política que você criou)
3. Clique na política para abri-la

### Passo 3: Editar a Política

1. Na página da política, clique no botão **"Edit"** (Editar) no canto superior direito
2. Clique na aba **"JSON"** (no topo da página)
3. Você verá o JSON atual da política

### Passo 4: Substituir o JSON

1. **Selecione todo o conteúdo JSON** (Ctrl+A / Cmd+A)
2. **Delete o conteúdo**
3. **Copie o conteúdo do arquivo `iam-policy-s3-download.json`** que está na raiz do projeto
4. **Cole no campo JSON** do console AWS
5. **Verifique** se o nome do bucket está correto: `colop-app-drawings`

### Passo 5: Salvar a Política

1. Clique no botão **"Next"** (Próximo) no canto inferior direito
2. Na página de revisão, revise as mudanças
3. Clique em **"Save changes"** (Salvar alterações)
4. Aguarde a confirmação de que a política foi atualizada

### Passo 6: Verificar se Funcionou

Após atualizar a política, teste no terminal:

```bash
# Testar listagem do bucket
aws s3 ls s3://colop-app-drawings/

# Se funcionar, fazer o download completo
aws s3 sync s3://colop-app-drawings/drawings ~/Downloads/drawings_backup --no-progress
```

## O que a Política Permite Agora

✅ **s3:ListBucket** - Listar objetos no bucket (necessário para `aws s3 sync`)  
✅ **s3:GetObject** - Baixar objetos do bucket  
✅ **s3:PutObject** - Fazer upload de novos objetos  
✅ **s3:DeleteObject** - Deletar qualquer arquivo em `drawings/*` (incluindo PNGs originais e thumbnails)

## Nota Importante

A política permite listar **todo o bucket**, mas as ações de GetObject e PutObject continuam restritas à pasta `drawings/*`, mantendo a segurança.

