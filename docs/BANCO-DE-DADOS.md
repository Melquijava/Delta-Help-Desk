# Banco de Dados

## Banco alvo

SQLite em arquivo persistente.

## ORM

Prisma.

## Configuracao

O arquivo `backend/prisma/schema.prisma` usa provider `sqlite` e le a conexao pela variavel `DATABASE_URL`.

Localmente:

```env
DATABASE_URL=file:./data/delta-help-desk.db
```

No Railway, usando volume montado em `/data`:

```env
DATABASE_URL=file:/data/delta-help-desk.db
```

O projeto usa `prisma db push` para criar/sincronizar o SQLite no ambiente de deploy.

## Valores controlados

SQLite nao possui enums nativos no mesmo formato usado antes pelo PostgreSQL. Por isso, estes valores sao armazenados como `String` e validados pelo backend com Zod/TypeScript:

- `UserStatus`: `ACTIVE`, `INACTIVE`.
- `ProcedureStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`.
- `ProcedureDifficulty`: `EASY`, `MEDIUM`, `ADVANCED`.
- `StepType`: `INFORMATION`, `QUESTION`, `ACTION`, `COPYABLE_MESSAGE`, `ALERT`, `CHECK`, `FINAL_SOLUTION`, `TECHNICAL_ESCALATION`.
- `UsageStatus`: `IN_PROGRESS`, `RESOLVED`, `NOT_RESOLVED`, `ESCALATED`, `ABANDONED`.
- `AuditAction`: `CREATE`, `UPDATE`, `DELETE`, `RESTORE`, `PUBLISH`, `ARCHIVE`, `DUPLICATE`, `LOGIN`, `LOGOUT`, `COPY_MESSAGE`.

## Models

- `User`: usuario do sistema, com nome, e-mail unico, senha criptografada, status, cargos, tokens e rastros de uso.
- `Role`: cargo atribuivel a usuarios.
- `Permission`: permissao granular por modulo e acao.
- `UserRole`: vinculo entre usuario e cargo.
- `RolePermission`: vinculo entre cargo e permissao.
- `RefreshToken`: tokens de renovacao para autenticacao futura.
- `Category`: categoria de procedimentos com nome, slug, descricao, icone, ordem e status.
- `Procedure`: procedimento com titulo, slug, resumo, descricao, categoria, palavras-chave, dificuldade, tempo estimado, status, destaque, etapa inicial, autor e publicacao.
- `ProcedureStep`: etapa do procedimento, com tipo, conteudo, ordenacao e proxima etapa padrao.
- `StepOption`: alternativa de uma etapa, podendo apontar para uma proxima etapa especifica.
- `CopyableMessage`: mensagem copiavel vinculada a procedimento e etapa, com contador de copias.
- `ProcedureUsage`: execucao de um procedimento por uma atendente.
- `ProcedureUsageStep`: caminho percorrido durante uma execucao.
- `CopiedMessageLog`: registro de cada copia de mensagem.
- `ProcedureFeedback`: registro de resolucao, avaliacao e comentario.
- `FavoriteProcedure`: procedimentos favoritos por usuario.
- `SearchLog`: pesquisas feitas por atendentes e procedimento selecionado.
- `AuditLog`: auditoria de acoes relevantes.
- `SystemSetting`: configuracoes do sistema.

## Exclusao logica

As entidades principais possuem `deletedAt`:

- `User`
- `Role`
- `Permission`
- `UserRole`
- `RolePermission`
- `RefreshToken`
- `Category`
- `Procedure`
- `ProcedureStep`
- `StepOption`
- `CopyableMessage`
- `FavoriteProcedure`
- `SystemSetting`

Logs operacionais e auditoria preservam historico e nao usam exclusao logica por padrao.

## Indices e unicidade

Campos unicos:

- `User.email`
- `Role.slug`
- `Permission.key`
- `RefreshToken.tokenHash`
- `Category.slug`
- `Procedure.slug`
- `StepOption.stepId + StepOption.value`
- `ProcedureUsageStep.usageId + ProcedureUsageStep.order`
- `ProcedureFeedback.usageId`
- `FavoriteProcedure.userId + FavoriteProcedure.procedureId`
- `SystemSetting.key`

Indices foram adicionados para buscas frequentes por status, categoria, autor, dificuldade, destaque, publicacao, usuario, procedimento, etapa, data, acao de auditoria, query normalizada e exclusao logica.

Campos que antes usavam JSON no PostgreSQL agora sao serializados como texto JSON para compatibilidade com SQLite:

- `Procedure.keywords`
- `Procedure.symptoms`
- `AuditLog.metadata`
- `SystemSetting.value`

## Seed inicial

O seed cria:

- Usuario administrador: `admin@deltahelpdesk.local` / `Admin@123456`.
- Usuario atendente: `atendente@deltahelpdesk.local` / `Atendente@123456`.
- Cargos `admin` e `attendant`.
- Permissoes iniciais para administracao e operacao.
- Categorias: Conexao, Financeiro, Equipamentos e Suporte Tecnico.
- Configuracao `app.name`.

## Diagrama textual dos relacionamentos

```text
User
  1:N RefreshToken
  1:N Procedure como autor
  1:N ProcedureUsage como atendente
  1:N CopiedMessageLog
  1:N ProcedureFeedback
  1:N FavoriteProcedure
  1:N SearchLog
  1:N AuditLog como ator
  N:N Role via UserRole

Role
  N:N User via UserRole
  N:N Permission via RolePermission

Category
  1:N Procedure

Procedure
  N:1 Category
  N:1 User como autor
  1:N ProcedureStep
  guarda `initialStepId` como referencia da etapa inicial
  1:N CopyableMessage
  1:N ProcedureUsage
  1:N ProcedureFeedback
  1:N FavoriteProcedure
  1:N SearchLog como procedimento selecionado
  1:N AuditLog

ProcedureStep
  N:1 Procedure
  N:1 ProcedureStep como proxima etapa padrao
  1:N ProcedureStep como etapas anteriores
  1:N StepOption
  1:N CopyableMessage
  1:N ProcedureUsageStep

StepOption
  N:1 ProcedureStep como etapa de origem
  N:1 ProcedureStep como proxima etapa alternativa
  1:N ProcedureUsageStep como opcao selecionada

ProcedureUsage
  N:1 User como atendente
  N:1 Procedure
  N:1 ProcedureStep como etapa atual opcional
  1:N ProcedureUsageStep
  1:N CopiedMessageLog
  1:1 ProcedureFeedback

CopyableMessage
  N:1 Procedure
  N:1 ProcedureStep
  1:N CopiedMessageLog
```
