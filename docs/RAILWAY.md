# Deploy no Railway com volume `/data`

Este projeto esta preparado para rodar no Railway usando SQLite em um volume persistente.

## Ideia

- O backend usa Prisma com SQLite.
- O arquivo do banco fica em `/data/delta-help-desk.db`.
- O volume `/data` preserva os dados entre deploys.
- O backend serve a API em `/api`.
- Em producao, o backend tambem serve o build do frontend React.

## Limites desta escolha

SQLite em volume funciona bem para uso interno, baixa concorrencia e dados pequenos, como procedimentos e mensagens.

Evite esta opcao se o sistema precisar de:

- varias instancias do backend ao mesmo tempo;
- escrita muito concorrente;
- replicas horizontais;
- backup gerenciado automatico como banco dedicado;
- consultas analiticas grandes.

Para o Delta Help Desk interno, com poucos administradores e atendentes, a opcao e leve e adequada.

## Variaveis no Railway

Configure no servico:

```env
NODE_ENV=production
PORT=3333
DATABASE_URL=file:/data/delta-help-desk.db
JWT_SECRET=troque-por-um-segredo-com-32-caracteres-ou-mais
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7
FRONTEND_URL=https://SEU-DOMINIO.up.railway.app
VITE_API_URL=/api
```

Depois que o Railway gerar o dominio publico, atualize `FRONTEND_URL` com esse dominio.

## Volume

1. Abra o projeto no Railway.
2. Entre no servico do Delta Help Desk.
3. Crie um volume.
4. Configure o mount path como:

```text
/data
```

5. Mantenha `DATABASE_URL=file:/data/delta-help-desk.db`.

## Build e start

O arquivo `railway.json` define:

Build:

```bash
npm run railway:build
```

Start:

```bash
npm start
```

O start executa:

```bash
npm --prefix backend run db:push
npm --prefix backend run db:seed
node backend/dist/server.js
```

`db:push` cria/atualiza as tabelas no SQLite.  
`db:seed` cria administrador, atendente, cargos, permissoes, categorias e configuracoes iniciais.

## Subir para GitHub

Na raiz do projeto:

```bash
git init
git add .
git commit -m "Prepare Delta Help Desk for Railway SQLite volume deploy"
git branch -M main
git remote add origin URL_DO_REPOSITORIO
git push -u origin main
```

Se o repositorio ja existir, use apenas:

```bash
git add .
git commit -m "Prepare Railway deploy with SQLite volume"
git push
```

## Credenciais iniciais

```text
admin@deltahelpdesk.local
Admin@123456
```

```text
atendente@deltahelpdesk.local
Atendente@123456
```

Troque as senhas depois do primeiro acesso.

## Backup simples

O arquivo importante e:

```text
/data/delta-help-desk.db
```

Para backup, copie esse arquivo pelo mecanismo de volumes/backups do Railway ou por um job administrativo futuro.
