# Como Corrigir Permissões IAM para Salvar e Excluir Thumbnails

## Problemas
1. O usuário IAM `color-app-s3-user` não tem permissão para salvar thumbnails em pastas além de `drawings/customizados/`. Os thumbnails precisam ser salvos em todas as pastas: `drawings/animais/thumb_*`, `drawings/gemeas/thumb_*`, etc.
2. O usuário IAM não tem permissão para excluir objetos (`s3:DeleteObject`), necessário para excluir thumbnails antigos.

## Solução: Atualizar a Política IAM

### Passo 1: Acessar o Console IAM
1. Acesse o [Console IAM da AWS](https://console.aws.amazon.com/iam/)
2. Faça login com sua conta AWS

### Passo 2: Encontrar a Política Atual
1. No menu lateral esquerdo, clique em **"Policies"** (Políticas)
2. Na barra de busca, digite o nome da sua política (provavelmente `ColorAppS3Policy` ou similar)
3. Clique na política para abri-la

### Passo 3: Editar a Política
1. Na página da política, clique no botão **"Edit"** (Editar) no canto superior direito
2. Clique na aba **"JSON"** (no topo da página)
3. Você verá algo como:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl"
            ],
            "Resource": "arn:aws:s3:::colop-app-drawings/drawings/customizados/*"
        },
        ...
    ]
}
```

### Passo 4: Atualizar a Política JSON
Substitua o conteúdo JSON completo pelo seguinte (substitua `colop-app-drawings` pelo nome do seu bucket se for diferente):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl"
            ],
            "Resource": [
                "arn:aws:s3:::colop-app-drawings/drawings/customizados/*",
                "arn:aws:s3:::colop-app-drawings/drawings/*/thumb_*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:DeleteObject"
            ],
            "Resource": [
                "arn:aws:s3:::colop-app-drawings/drawings/*/thumb_*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::colop-app-drawings",
            "Condition": {
                "StringLike": {
                    "s3:prefix": "drawings/*"
                }
            }
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject"
            ],
            "Resource": "arn:aws:s3:::colop-app-drawings/drawings/*"
        }
    ]
}
```

**O que mudou:**
- A linha `"Resource": "arn:aws:s3:::colop-app-drawings/drawings/customizados/*"` foi substituída por um array com duas entradas:
  - `"arn:aws:s3:::colop-app-drawings/drawings/customizados/*"` - mantém permissão para uploads em customizados
  - `"arn:aws:s3:::colop-app-drawings/drawings/*/thumb_*"` - **NOVO**: permite salvar thumbnails em qualquer pasta dentro de `drawings/`
- **NOVO Statement**: Adicionada permissão `s3:DeleteObject` para excluir thumbnails em qualquer pasta dentro de `drawings/`

### Passo 5: Salvar a Política
1. Clique no botão **"Next"** (Próximo) no canto inferior direito
2. Na página de revisão, clique em **"Save changes"** (Salvar alterações)
3. Aguarde a confirmação de que a política foi atualizada

### Passo 6: Verificar se a Política Está Anexada ao Usuário
1. No menu lateral, clique em **"Users"** (Usuários)
2. Clique no usuário `color-app-s3-user`
3. Na aba **"Permissions"** (Permissões), verifique se a política atualizada está listada
4. Se não estiver, clique em **"Add permissions"** → **"Attach policies directly"** e selecione a política

### Passo 7: Testar
1. Reinicie o servidor Node.js (se estiver rodando)
2. Tente gerar ou acessar um thumbnail de uma categoria que não seja `customizados`
3. Verifique os logs do servidor - não deve mais aparecer erro de `AccessDenied`
4. Verifique no console S3 se o thumbnail foi salvo corretamente
5. Teste a exclusão de thumbnails executando: `node scripts/delete-thumbnails.js --delete`

## Explicação Técnica

A política anterior permitia `s3:PutObject` apenas em:
- `drawings/customizados/*`

A nova política permite:
- **`s3:PutObject`** em:
  - `drawings/customizados/*` (mantém compatibilidade)
  - `drawings/*/thumb_*` (permite salvar thumbnails em qualquer categoria)
- **`s3:DeleteObject`** em:
  - `drawings/*/thumb_*` (permite excluir thumbnails em qualquer categoria)

O padrão `drawings/*/thumb_*` significa:
- `drawings/` - pasta base
- `*` - qualquer nome de categoria (animais, gemeas, natureza, etc.)
- `/thumb_*` - qualquer arquivo que comece com `thumb_`

## Alternativa: Permissão Mais Ampla (Menos Seguro)

Se você quiser permitir upload em **todas** as pastas (não apenas thumbnails), pode usar:

```json
"Resource": "arn:aws:s3:::colop-app-drawings/drawings/*"
```

⚠️ **Atenção**: Isso permite upload de qualquer arquivo em qualquer pasta dentro de `drawings/`, o que é menos seguro mas mais flexível.

## Verificação Rápida

Após atualizar, você pode verificar se funcionou:
1. Acesse o [Console S3](https://console.aws.amazon.com/s3/)
2. Navegue até seu bucket `colop-app-drawings`
3. Vá para `drawings/gemeas/` (ou outra categoria)
4. Você deve conseguir ver e criar arquivos `thumb_*.png` lá

## Troubleshooting

### Ainda recebendo erro de AccessDenied?
1. Aguarde 1-2 minutos após salvar a política (pode levar um tempo para propagar)
2. Verifique se o nome do bucket está correto na política
3. Verifique se a política está realmente anexada ao usuário `color-app-s3-user`
4. Verifique se está usando as credenciais corretas (Access Key ID e Secret Access Key)

### Como verificar qual usuário está sendo usado?
Os logs do servidor mostram o ARN do usuário no erro:
```
User: arn:aws:iam::392853978608:user/color-app-s3-user
```

Confirme que este é o usuário que tem a política atualizada anexada.

