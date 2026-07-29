# Arquitetura

## Visao geral

O Delta Help Desk e dividido em duas aplicacoes:

- `frontend`: interface web usada por administradores e atendentes.
- `backend`: API REST responsavel por autenticacao, regras de negocio, persistencia e auditoria.

## Camadas

### Frontend

- React com Vite e TypeScript.
- Rotas com React Router.
- Requisicoes HTTP com Axios.
- Formularios com React Hook Form.
- Validacao com Zod.
- Estilizacao com Tailwind CSS.
- Icones com Lucide React.

### Backend

- Node.js com Express e TypeScript.
- Prisma como ORM.
- SQLite em arquivo persistente como banco principal.
- Validacao de entrada com Zod.
- Autenticacao com JWT e bcrypt.
- Seguranca basica com Helmet e CORS.
- Configuracao por variaveis de ambiente com dotenv.

## Comunicacao

O frontend consome a API via REST usando a variavel `VITE_API_URL`.

Em producao no Railway, o backend tambem serve o build do frontend. Assim, o projeto pode rodar como um unico servico:

```text
GET /api/...       -> API Express
GET /*            -> frontend React compilado
SQLite em /data   -> volume persistente Railway
```

Endpoint inicial:

```text
GET /api/health
```

## Persistencia

O Prisma usa SQLite. Em desenvolvimento local, a `DATABASE_URL` recomendada e:

```env
DATABASE_URL=file:./data/delta-help-desk.db
```

No Railway, configure um volume montado em `/data` e use:

```env
DATABASE_URL=file:/data/delta-help-desk.db
```

Esse desenho reduz a dependencia de um servico PostgreSQL separado. Ele e adequado para uma central interna pequena, com poucos usuarios simultaneos e dados leves. Para uso com muitas instancias, alta concorrencia ou necessidade de replicas, o PostgreSQL volta a ser a opcao mais segura.

## Separacao de responsabilidades

- Administradores configuram usuarios, categorias, procedimentos, etapas, opcoes e publicacao.
- Atendentes pesquisam, executam fluxos, copiam mensagens, favoritam e registram resultado.
- Auditoria e relatorios devem ficar no backend para preservar rastreabilidade.

## Organizacao futura sugerida

Backend:

```text
src/
  config/
  modules/
  middlewares/
  routes/
  services/
  utils/
```

Frontend:

```text
src/
  components/
  features/
  lib/
  pages/
  routes/
  styles/
```
