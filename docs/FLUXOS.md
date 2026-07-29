# Fluxos

## Fluxo da atendente

1. A atendente acessa o sistema.
2. Pesquisa por palavra-chave, categoria ou problema recorrente.
3. Abre um procedimento publicado.
4. Segue etapas de diagnostico.
5. Seleciona respostas ou condicoes do atendimento.
6. Copia mensagens prontas quando necessario.
7. Marca se o problema foi resolvido.
8. O sistema registra historico e dados para relatorios.

## Fluxo do administrador

1. O administrador acessa o painel.
2. Cria ou edita categorias.
3. Cria procedimentos com titulo, descricao e tags.
4. Adiciona etapas, perguntas, opcoes e mensagens prontas.
5. Revisa o procedimento.
6. Publica ou arquiva o procedimento.
7. Consulta relatorios e auditoria.

## Estados de procedimento

- `DRAFT`: rascunho editavel.
- `PUBLISHED`: disponivel para atendentes.
- `ARCHIVED`: removido da operacao diaria, preservado para historico.

## Fluxos fora desta etapa

- Autenticacao completa.
- CRUD completo de procedimentos.
- Relatorios reais.
- Auditoria persistida.
- Controle granular de permissoes.
