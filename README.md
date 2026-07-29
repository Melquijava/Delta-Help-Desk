# Delta Help Desk

Sistema web interno para centralizar procedimentos, diagnosticos guiados e mensagens prontas para atendentes de SAC de um provedor de internet.

Este projeto e separado do Delta ISP Control. Todos os arquivos desta base ficam dentro da pasta `Delta Help Desk`.

## Tecnologias

### Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- React Router
- Axios
- React Hook Form
- Zod
- Lucide React

### Backend

- Node.js
- Express
- TypeScript
- SQLite em arquivo persistente
- Prisma
- Zod
- JWT
- bcrypt
- Helmet
- CORS
- dotenv

## Estrutura

```text
frontend/
backend/
docs/
```

## Instalar dependencias

```bash
npm install

cd backend
npm install

cd ../frontend
npm install
```

## Configurar ambiente

Copie os arquivos de exemplo:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

No Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

## Executar em desenvolvimento

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

URLs padrao:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3333`
- Health check: `http://localhost:3333/api/health`

## Banco de dados

O projeto esta preparado para usar SQLite via Prisma.

Localmente, use:

```env
DATABASE_URL=file:./data/delta-help-desk.db
```

No Railway, crie um volume montado em `/data` e configure:

```env
DATABASE_URL=file:/data/delta-help-desk.db
NODE_ENV=production
JWT_SECRET=gere-um-segredo-com-32-caracteres-ou-mais
```

O comando de start do Railway executa `prisma db push` e `prisma db seed` antes de iniciar a API.

## Scripts

Backend:

- `npm run dev`: inicia API em modo desenvolvimento.
- `npm run build`: compila TypeScript.
- `npm run start`: executa build compilado.
- `npm run lint`: executa ESLint.
- `npm run format`: aplica Prettier.
- `npm run prisma:generate`: gera Prisma Client.
- `npm run db:push`: sincroniza o schema Prisma no SQLite.
- `npm run db:seed`: cria dados iniciais.

Raiz do projeto:

- `npm run railway:build`: instala e compila backend e frontend para Railway.
- `npm start`: prepara o SQLite e inicia o backend servindo a API e o frontend.

Frontend:

- `npm run dev`: inicia Vite.
- `npm run build`: compila TypeScript e gera build.
- `npm run preview`: serve build local.
- `npm run lint`: executa ESLint.
- `npm run format`: aplica Prettier.

## Status atual

Base inicial criada com documentacao, configuracoes, Prisma minimo, endpoint de saude e tela provisoria consumindo a API.
