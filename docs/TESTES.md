# Testes e seguranca

Este documento registra a estrategia de testes do Delta Help Desk e os pontos de seguranca revisados nesta etapa.

## Comandos principais

Backend:

```bash
cd backend
npm run lint
npm run test
npm run build
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Cobertura automatizada atual

Os testes automatizados do backend usam `node:test` via `tsx`.

Arquivo `backend/tests/auth.service.test.ts`:

- login valido
- senha invalida
- usuario inativo
- refresh token com revogacao do token anterior
- token invalido
- rota protegida sem token
- falta de permissao
- access token com permissoes

Arquivo `backend/tests/security-and-flow.test.ts`:

- sanitizacao de auditoria
- rejeicao de configuracoes inseguras
- rate limit de login
- access token expirado
- procedimento sem etapa inicial
- alternativa sem proxima etapa
- fluxo sem solucao final
- loop acidental
- fluxo valido com pergunta, alternativa e solucao final

## Matriz recomendada de smoke test local

Use as credenciais do seed:

- Admin: `admin@deltahelpdesk.local` / `Admin@123456`
- Atendente: `atendente@deltahelpdesk.local` / `Atendente@123456`

### Autenticacao e permissoes

1. Entrar como admin.
2. Abrir Usuarios, Categorias, Procedimentos, Relatorios, Auditoria e Configuracoes.
3. Sair.
4. Entrar como atendente.
5. Confirmar que menus administrativos nao aparecem.
6. Tentar acessar manualmente `/users`, `/categories`, `/procedures`, `/reports`, `/audit` e `/settings`.
7. Resultado esperado: bloqueio visual no frontend ou `403` no backend.

### Usuarios

1. Criar usuario com e-mail novo.
2. Tentar criar outro usuario com mesmo e-mail.
3. Alterar cargos.
4. Desativar usuario.
5. Confirmar que senha/hash nao aparece em respostas ou auditoria.

### Categorias

1. Criar categoria.
2. Editar nome, slug, icone, cor e ordem.
3. Subir/descer categoria.
4. Desativar e excluir logicamente.
5. Confirmar auditoria.

### Procedimentos e editor

1. Criar procedimento em rascunho.
2. Tentar publicar sem etapas.
3. Criar etapa inicial.
4. Criar pergunta com alternativa sem proxima etapa.
5. Validar que o fluxo fica invalido.
6. Criar fluxo sem solucao final.
7. Validar que o fluxo fica invalido.
8. Criar loop acidental.
9. Validar que o fluxo fica invalido.
10. Corrigir para chegar em solucao final.
11. Publicar.
12. Arquivar e confirmar que atendente nao acessa.

### Execucao guiada

1. Entrar como atendente.
2. Buscar procedimento publicado.
3. Abrir execucao guiada.
4. Avancar por alternativas.
5. Voltar uma etapa.
6. Atualizar a pagina e confirmar retomada do atendimento.
7. Copiar mensagem.
8. Concluir como resolvido.
9. Concluir outro atendimento como nao resolvido/encaminhado e verificar exigencia de observacao.
10. Sair no meio do atendimento e confirmar abandono.

### Favoritos, feedback e mensagens

1. Favoritar procedimento.
2. Remover favorito.
3. Copiar mensagem com variaveis.
4. Confirmar registro em estatisticas e auditoria quando aplicavel.
5. Enviar feedback ao concluir.
6. Verificar relatorios de pior avaliacao e taxa de resolucao.

### Relatorios e auditoria

1. Gerar cada relatorio visual.
2. Exportar PDF, Excel e CSV.
3. Confirmar empresa, data/hora, usuario responsavel, filtros e totais.
4. Consultar Auditoria com filtros por acao, entidade e periodo.
5. Abrir comparacao antes/depois.

### API indisponivel

1. Parar o backend.
2. Abrir o frontend.
3. Tentar login e tela inicial.
4. Resultado esperado: mensagem clara de indisponibilidade, sem tela quebrada.

## Revisao de seguranca

- Entradas principais validadas com Zod nas rotas.
- Rotas administrativas protegidas por `authenticate` e `authorize`.
- Login possui rate limit por IP.
- Helmet habilitado.
- CORS restrito a `FRONTEND_URL`.
- JSON body limitado a `1mb`.
- Handler global retorna mensagens genericas e nao expoe stack em producao.
- JWT exige segredo forte em producao.
- Refresh token e opaco e salvo apenas como hash.
- Senhas sao criptografadas com bcrypt.
- Operacoes compostas sensiveis usam transacoes.
- Listagens grandes usam paginacao ou `take`.
- Auditoria mascara senha, token, hash, authorization, cookie, e-mail e telefone.

## Pontos de atencao

- Os testes automatizados atuais cobrem regras centrais sem depender de banco real.
- Para cobertura end-to-end completa, o proximo passo recomendado e adicionar um arquivo SQLite de teste isolado e executar rotas Express com um cliente HTTP de teste.
- O pacote `exceljs` possui alerta moderado transitivo conhecido no `npm audit`; atualizar com `--force` indicava downgrade/incompatibilidade, entao nao foi aplicado automaticamente.
