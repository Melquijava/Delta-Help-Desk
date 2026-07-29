# Execucao Local no Windows

Este guia prepara o Delta Help Desk para rodar localmente no Windows usando SQLite em arquivo. Nao e necessario instalar PostgreSQL para este modo.

## 1. Portas usadas

- Backend: `http://localhost:3333`
- Frontend: `http://localhost:5173`
- API base: `http://localhost:3333/api`
- Health: `http://localhost:3333/api/health`
- Diagnostico do banco: `http://localhost:3333/api/health/database`

## 2. Arquivos .env reais

Crie estes arquivos, que nao ficam no Git:

```text
backend/.env
frontend/.env
```

No PowerShell, na raiz do projeto:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

## 3. Configurar backend/.env

Use SQLite local:

```env
NODE_ENV=development
PORT=3333
FRONTEND_URL=http://localhost:5173
DATABASE_URL=file:./data/delta-help-desk.db
JWT_SECRET=troque-este-valor-por-um-segredo-grande
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7
```

Com Prisma, o caminho `file:./data/delta-help-desk.db` e resolvido a partir da pasta `backend/prisma`. O arquivo local fica em `backend/prisma/data/delta-help-desk.db`.

## 4. Configurar frontend/.env

```env
VITE_API_URL=http://localhost:3333/api
```

## 5. Instalar dependencias

Backend:

```powershell
cd backend
npm install
```

Frontend:

```powershell
cd ..\frontend
npm install
```

## 6. Comandos Prisma

Execute dentro de `backend`:

```powershell
cd backend
```

Formatar o schema:

```powershell
npx.cmd prisma format
```

Organiza o arquivo `prisma/schema.prisma`.

Validar o schema:

```powershell
npx.cmd prisma validate
```

Confirma se o Prisma entende o schema e a `DATABASE_URL`.

Gerar Prisma Client:

```powershell
npx.cmd prisma generate
```

Gera o client TypeScript usado pelo backend.

Criar/sincronizar o banco SQLite:

```powershell
npx.cmd prisma db push
```

Cria o arquivo SQLite, tabelas e indices conforme o schema atual. Neste projeto, esse e o comando indicado para o modo SQLite.

Executar seed:

```powershell
npx.cmd prisma db seed
```

Cria administrador, atendente de teste, cargos, permissoes, categorias iniciais e configuracoes.

Abrir Prisma Studio:

```powershell
npx.cmd prisma studio
```

Abre uma interface local, normalmente em `http://localhost:5555`.

Nao execute `prisma migrate reset` automaticamente. Esse comando apaga dados.

## 7. Iniciar backend

```powershell
cd backend
npm run dev
```

Script real:

```json
"dev": "tsx watch src/server.ts"
```

Teste:

```text
http://localhost:3333/api/health
http://localhost:3333/api/health/database
```

## 8. Iniciar frontend

Em outro terminal:

```powershell
cd frontend
npm run dev
```

Script real:

```json
"dev": "vite"
```

Abra:

```text
http://localhost:5173
```

## 9. Credenciais do seed

```text
admin@deltahelpdesk.local
Admin@123456

atendente@deltahelpdesk.local
Atendente@123456
```

## 10. Erros comuns

### npx.ps1 nao pode ser carregado

Use `npx.cmd` no PowerShell:

```powershell
npx.cmd prisma validate
```

### Unable to open the database file

Verifique se a pasta existe:

```text
backend/prisma/data
```

Depois execute:

```powershell
cd backend
npx.cmd prisma db push
```

### Schema engine error no Prisma SQLite

Em alguns ambientes Windows, o binario local do Prisma pode retornar apenas `Schema engine error`. Tente:

```powershell
cd backend
npx.cmd prisma validate
npx.cmd prisma generate
npx.cmd prisma db push
```

Se persistir, teste em WSL, GitHub Actions, Railway ou outro ambiente Linux. O deploy Railway usa Linux e o mesmo comando `prisma db push`.

### Port 3333 is already in use

Altere `PORT` em `backend/.env` e ajuste `VITE_API_URL` no frontend.

### CORS error no navegador

Confira se `FRONTEND_URL` e exatamente a origem do frontend:

```env
FRONTEND_URL=http://localhost:5173
```

Reinicie o backend depois de alterar `.env`.

### API indisponivel no login

Confirme se o backend esta rodando e se `VITE_API_URL` aponta para `http://localhost:3333/api`.
