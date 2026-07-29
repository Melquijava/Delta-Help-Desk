import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const permissions = [
  ['users.manage', 'users', 'manage', 'Gerenciar usuarios'],
  ['categories.manage', 'categories', 'manage', 'Gerenciar categorias'],
  ['procedures.manage', 'procedures', 'manage', 'Criar e editar procedimentos'],
  ['procedures.publish', 'procedures', 'publish', 'Publicar procedimentos'],
  ['procedures.archive', 'procedures', 'archive', 'Arquivar procedimentos'],
  ['reports.view', 'reports', 'view', 'Visualizar relatorios'],
  ['audit.view', 'audit', 'view', 'Visualizar auditoria'],
  ['settings.manage', 'settings', 'manage', 'Alterar configuracoes'],
  ['procedures.search', 'procedures', 'search', 'Pesquisar procedimentos'],
  ['procedures.follow', 'procedures', 'follow', 'Seguir procedimentos'],
  ['messages.copy', 'messages', 'copy', 'Copiar mensagens prontas'],
  ['favorites.manage', 'favorites', 'manage', 'Favoritar procedimentos'],
  ['history.view_own', 'history', 'view_own', 'Consultar historico recente'],
  ['usage.resolve', 'usage', 'resolve', 'Registrar resultado do atendimento']
] as const;

const categories = [
  {
    name: 'Internet lenta',
    slug: 'internet-lenta',
    description: 'Procedimentos para diagnosticar lentidao na navegacao.',
    icon: 'gauge',
    color: '#0284c7',
    order: 1
  },
  {
    name: 'Sem conexao',
    slug: 'sem-conexao',
    description: 'Fluxos para clientes sem acesso a internet.',
    icon: 'wifi-off',
    color: '#0f172a',
    order: 2
  },
  {
    name: 'Wi-Fi',
    slug: 'wi-fi',
    description: 'Orientacoes sobre sinal, senha e cobertura Wi-Fi.',
    icon: 'wifi',
    color: '#0ea5e9',
    order: 3
  },
  {
    name: 'Roteador',
    slug: 'roteador',
    description: 'Procedimentos relacionados a roteadores e equipamentos.',
    icon: 'router',
    color: '#0369a1',
    order: 4
  },
  {
    name: 'Configuracao',
    slug: 'configuracao',
    description: 'Ajustes de conta, equipamentos e acessos.',
    icon: 'settings',
    color: '#334155',
    order: 5
  },
  {
    name: 'Financeiro',
    slug: 'financeiro',
    description: 'Segunda via, desbloqueio, pagamento e negociacao.',
    icon: 'receipt',
    color: '#16a34a',
    order: 6
  },
  {
    name: 'Visita tecnica',
    slug: 'visita-tecnica',
    description: 'Agendamento, acompanhamento e orientacoes de visita.',
    icon: 'calendar-clock',
    color: '#f59e0b',
    order: 7
  }
];

type BasicProcedureSeed = {
  categorySlug: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  keywords: string[];
  symptoms: string[];
  difficulty: 'EASY' | 'MEDIUM' | 'ADVANCED';
  estimatedMinutes: number;
  featured?: boolean;
  questionTitle: string;
  questionContent: string;
  actionTitle: string;
  actionContent: string;
  solutionTitle: string;
  solutionContent: string;
  messageTitle: string;
  messageContent: string;
};

const basicProcedures: BasicProcedureSeed[] = [
  {
    categorySlug: 'internet-lenta',
    title: 'Teste de velocidade com resultado abaixo do contratado',
    slug: 'teste-de-velocidade-abaixo-do-contratado',
    summary: 'Orienta a atendente a validar condicoes basicas antes de considerar falha de velocidade.',
    description: 'Fluxo simples para conferir Wi-Fi, cabo, aparelhos conectados e forma correta de teste.',
    keywords: ['teste de velocidade', 'velocidade baixa', 'plano contratado', 'speedtest'],
    symptoms: ['download lento', 'teste abaixo do contratado', 'internet abaixo da velocidade'],
    difficulty: 'EASY',
    estimatedMinutes: 8,
    questionTitle: 'O teste foi feito por cabo?',
    questionContent: 'Confirme se o cliente testou em um computador por cabo ou se o teste foi feito somente pelo Wi-Fi.',
    actionTitle: 'Orientar novo teste em condicoes adequadas',
    actionContent: 'Solicite teste com poucos aparelhos conectados, sem downloads ativos e, se possivel, por cabo.',
    solutionTitle: 'Teste normalizado',
    solutionContent: 'Finalize se o teste em condicoes adequadas apresentar velocidade compativel com o plano.',
    messageTitle: 'Como fazer o teste de velocidade',
    messageContent:
      'Para validarmos corretamente, feche downloads e aplicativos de video, deixe poucos aparelhos conectados e realize o teste preferencialmente por cabo. Assim conseguimos comparar melhor o resultado com o plano contratado.'
  },
  {
    categorySlug: 'internet-lenta',
    title: 'Streaming travando ou video carregando lento',
    slug: 'streaming-travando-ou-video-lento',
    summary: 'Diagnostica travamentos em videos, TV Box, aplicativos de streaming e chamadas de video.',
    description: 'Verifica consumo simultaneo, distancia do roteador e qualidade do sinal no aparelho usado.',
    keywords: ['streaming', 'video travando', 'netflix', 'youtube', 'tv box', 'chamada de video'],
    symptoms: ['video carregando', 'imagem travando', 'buffering', 'chamada caindo'],
    difficulty: 'EASY',
    estimatedMinutes: 7,
    questionTitle: 'O problema acontece em apenas um aplicativo?',
    questionContent: 'Pergunte se o travamento ocorre em todos os apps ou somente em uma plataforma especifica.',
    actionTitle: 'Testar outro aplicativo e aproximar do roteador',
    actionContent: 'Oriente o cliente a testar outro app e repetir o teste perto do roteador.',
    solutionTitle: 'Causa isolada no app ou sinal',
    solutionContent: 'Finalize se outro aplicativo funcionar bem ou se o teste proximo ao roteador normalizar.',
    messageTitle: 'Teste de streaming',
    messageContent:
      'Vamos fazer um teste rapido: abra outro aplicativo de video e, se possivel, aproxime o aparelho do roteador. Isso ajuda a identificar se o problema esta no aplicativo, no sinal Wi-Fi ou na conexao.'
  },
  {
    categorySlug: 'sem-conexao',
    title: 'Cliente sem internet em todos os aparelhos',
    slug: 'sem-internet-em-todos-os-aparelhos',
    summary: 'Fluxo inicial para cliente totalmente sem conexao.',
    description: 'Confere energia, cabos, luzes do roteador e reinicializacao antes de encaminhar.',
    keywords: ['sem internet', 'sem conexao', 'nao navega', 'internet caiu'],
    symptoms: ['todos aparelhos sem internet', 'roteador sem acesso', 'sem navegacao'],
    difficulty: 'EASY',
    estimatedMinutes: 10,
    featured: true,
    questionTitle: 'Todos os aparelhos estao sem internet?',
    questionContent: 'Confirme se celulares, computadores e TVs estao sem acesso ou se e apenas um aparelho.',
    actionTitle: 'Verificar energia, cabos e reiniciar',
    actionContent: 'Oriente conferir se o roteador esta ligado, cabos firmes e reiniciar o equipamento.',
    solutionTitle: 'Conexao restabelecida',
    solutionContent: 'Finalize se a navegacao voltar apos energia, cabos ou reinicializacao.',
    messageTitle: 'Primeiros testes sem conexao',
    messageContent:
      'Vamos verificar os itens principais: confirme se o roteador esta ligado, se os cabos estao bem encaixados e reinicie o equipamento retirando da tomada por 30 segundos. Depois me avise quando as luzes estabilizarem.'
  },
  {
    categorySlug: 'sem-conexao',
    title: 'Roteador ligado mas sem navegacao',
    slug: 'roteador-ligado-sem-navegacao',
    summary: 'Ajuda a validar quando as luzes estao acesas, mas o cliente nao navega.',
    description: 'Confere luzes, rede conectada, cabo WAN e teste em mais de um aparelho.',
    keywords: ['roteador ligado', 'sem navegar', 'luzes acesas', 'wan'],
    symptoms: ['conectado sem internet', 'wifi conecta mas nao navega', 'sem acesso mesmo ligado'],
    difficulty: 'MEDIUM',
    estimatedMinutes: 9,
    questionTitle: 'O aparelho conecta no Wi-Fi, mas nao navega?',
    questionContent: 'Confirme se aparece conectado na rede ou se a rede nem aparece para conexao.',
    actionTitle: 'Validar rede conectada e cabo principal',
    actionContent: 'Peça para conferir se esta na rede correta e se o cabo principal esta bem encaixado no roteador.',
    solutionTitle: 'Navegacao recuperada',
    solutionContent: 'Finalize se a troca para a rede correta ou ajuste de cabo resolver.',
    messageTitle: 'Conectado sem navegar',
    messageContent:
      'Mesmo aparecendo conectado, pode haver falha no cabo principal ou na rede selecionada. Confirme se esta conectado na rede correta e se o cabo de entrada do roteador esta bem encaixado.'
  },
  {
    categorySlug: 'wi-fi',
    title: 'Senha do Wi-Fi esquecida ou incorreta',
    slug: 'senha-wi-fi-esquecida-ou-incorreta',
    summary: 'Orienta atendimento quando o cliente nao consegue conectar por senha invalida.',
    description: 'Confere nome da rede, senha informada e possibilidade de redefinicao pelo suporte.',
    keywords: ['senha wifi', 'senha incorreta', 'nao conecta no wifi', 'trocar senha'],
    symptoms: ['senha invalida', 'autenticacao falhou', 'nao conecta no Wi-Fi'],
    difficulty: 'EASY',
    estimatedMinutes: 6,
    questionTitle: 'O erro apresentado e de senha incorreta?',
    questionContent: 'Confirme a mensagem exibida no celular, TV ou computador ao tentar conectar.',
    actionTitle: 'Confirmar rede correta e orientar nova tentativa',
    actionContent: 'Peça para esquecer a rede no aparelho, selecionar a rede correta e digitar a senha novamente.',
    solutionTitle: 'Acesso Wi-Fi recuperado',
    solutionContent: 'Finalize se o aparelho conectar depois de esquecer a rede e inserir a senha correta.',
    messageTitle: 'Orientacao senha Wi-Fi',
    messageContent:
      'Por favor, toque em esquecer rede no aparelho, selecione novamente a rede Wi-Fi correta e digite a senha com atencao a letras maiusculas, minusculas e numeros.'
  },
  {
    categorySlug: 'wi-fi',
    title: 'Rede Wi-Fi nao aparece no aparelho',
    slug: 'rede-wi-fi-nao-aparece',
    summary: 'Fluxo para quando o cliente nao encontra o nome da rede na lista.',
    description: 'Verifica distancia, compatibilidade com 2.4 GHz/5 GHz e reinicializacao do roteador.',
    keywords: ['wifi nao aparece', 'rede sumiu', 'ssid', 'nao encontra rede'],
    symptoms: ['nome da rede nao aparece', 'rede desapareceu', 'celular nao encontra wifi'],
    difficulty: 'EASY',
    estimatedMinutes: 7,
    questionTitle: 'A rede aparece em outros aparelhos?',
    questionContent: 'Confirme se outros celulares ou computadores conseguem ver a rede Wi-Fi.',
    actionTitle: 'Aproximar do roteador e reiniciar',
    actionContent: 'Oriente aproximar o aparelho do roteador e reiniciar o roteador se a rede nao aparecer em nenhum aparelho.',
    solutionTitle: 'Rede localizada',
    solutionContent: 'Finalize se a rede aparecer apos aproximar o aparelho ou reiniciar o roteador.',
    messageTitle: 'Rede Wi-Fi nao localizada',
    messageContent:
      'Vamos testar perto do roteador. Verifique se a rede aparece em outro aparelho e, se nao aparecer em nenhum, reinicie o roteador retirando da tomada por 30 segundos.'
  },
  {
    categorySlug: 'roteador',
    title: 'Luzes do roteador piscando ou apagadas',
    slug: 'luzes-do-roteador-piscando-ou-apagadas',
    summary: 'Orienta verificacao visual basica do roteador.',
    description: 'Confere energia, fonte, cabos e estado das luzes principais.',
    keywords: ['luzes roteador', 'roteador apagado', 'los piscando', 'pon apagada'],
    symptoms: ['roteador sem luz', 'luz vermelha', 'luz piscando', 'equipamento apagado'],
    difficulty: 'EASY',
    estimatedMinutes: 8,
    questionTitle: 'O roteador esta com alguma luz apagada ou vermelha?',
    questionContent: 'Pergunte quais luzes estao acesas, apagadas ou piscando diferente do normal.',
    actionTitle: 'Conferir tomada, fonte e cabos',
    actionContent: 'Oriente testar a tomada, conferir a fonte e verificar se os cabos estao bem encaixados.',
    solutionTitle: 'Equipamento normalizado',
    solutionContent: 'Finalize se as luzes estabilizarem e a conexao voltar.',
    messageTitle: 'Verificacao das luzes',
    messageContent:
      'Por favor, confira se a fonte esta bem conectada, se a tomada esta funcionando e se os cabos estao firmes. Depois observe se as luzes do roteador estabilizam.'
  },
  {
    categorySlug: 'roteador',
    title: 'Roteador reiniciando sozinho',
    slug: 'roteador-reiniciando-sozinho',
    summary: 'Verifica possiveis causas simples para reinicios frequentes.',
    description: 'Confere energia, aquecimento, tomada e fonte antes de acionar suporte.',
    keywords: ['roteador reiniciando', 'reinicia sozinho', 'desliga sozinho', 'queda roteador'],
    symptoms: ['roteador desliga', 'luzes apagam e voltam', 'queda frequente'],
    difficulty: 'MEDIUM',
    estimatedMinutes: 9,
    questionTitle: 'O roteador desliga e liga sozinho varias vezes?',
    questionContent: 'Confirme frequencia do problema e se acontece em horarios especificos.',
    actionTitle: 'Verificar energia e ventilacao',
    actionContent: 'Oriente usar tomada firme, evitar extensoes ruins e manter o roteador em local ventilado.',
    solutionTitle: 'Reinicio estabilizado',
    solutionContent: 'Finalize se o equipamento parar de reiniciar apos ajuste de tomada ou local.',
    messageTitle: 'Roteador reiniciando',
    messageContent:
      'Vamos conferir energia e ventilacao: mantenha o roteador em local aberto, evite deixa-lo coberto e, se possivel, teste em outra tomada por alguns minutos.'
  },
  {
    categorySlug: 'configuracao',
    title: 'Atualizacao de dados cadastrais',
    slug: 'atualizacao-de-dados-cadastrais',
    summary: 'Procedimento para orientar atualizacao de telefone, e-mail ou dados de contato.',
    description: 'Ajuda a conferir dados do titular e registrar solicitacao de atualizacao.',
    keywords: ['dados cadastrais', 'atualizar cadastro', 'telefone', 'email'],
    symptoms: ['telefone desatualizado', 'email errado', 'cadastro incorreto'],
    difficulty: 'EASY',
    estimatedMinutes: 5,
    questionTitle: 'A solicitacao e feita pelo titular?',
    questionContent: 'Confirme se quem esta falando e o titular ou pessoa autorizada na conta.',
    actionTitle: 'Coletar dados atualizados',
    actionContent: 'Solicite os dados novos e registre conforme a politica interna de validacao.',
    solutionTitle: 'Dados registrados para atualizacao',
    solutionContent: 'Finalize apos confirmar e registrar os dados corretamente.',
    messageTitle: 'Confirmacao de atualizacao',
    messageContent:
      'Obrigado pelas informacoes. Vou registrar a atualizacao dos dados de contato conforme solicitado e, se precisar de validacao adicional, nossa equipe informara os proximos passos.'
  },
  {
    categorySlug: 'configuracao',
    title: 'Alteracao de nome da rede Wi-Fi',
    slug: 'alteracao-de-nome-da-rede-wi-fi',
    summary: 'Orienta solicitacao de troca do nome da rede Wi-Fi.',
    description: 'Confere titularidade, novo nome desejado e impacto nos aparelhos conectados.',
    keywords: ['trocar nome wifi', 'alterar ssid', 'nome da rede', 'configurar wifi'],
    symptoms: ['quer mudar nome da rede', 'rede com nome antigo', 'ssid incorreto'],
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    questionTitle: 'O cliente sabe que os aparelhos precisarao reconectar?',
    questionContent: 'Explique que mudar o nome da rede exige conectar novamente os aparelhos.',
    actionTitle: 'Confirmar novo nome da rede',
    actionContent: 'Solicite o nome desejado e confirme se nao contem dados sensiveis.',
    solutionTitle: 'Alteracao orientada',
    solutionContent: 'Finalize apos registrar ou orientar o procedimento conforme acesso disponivel.',
    messageTitle: 'Impacto da troca de nome',
    messageContent:
      'Ao alterar o nome da rede Wi-Fi, os aparelhos conectados precisarao ser conectados novamente com o novo nome. Confirme, por favor, qual nome deseja utilizar.'
  },
  {
    categorySlug: 'financeiro',
    title: 'Solicitar segunda via de boleto',
    slug: 'segunda-via-de-boleto',
    summary: 'Fluxo para orientar envio ou consulta de segunda via.',
    description: 'Confere titularidade, vencimento e canal adequado para envio.',
    keywords: ['segunda via', 'boleto', 'fatura', 'pagamento'],
    symptoms: ['boleto nao chegou', 'precisa pagar', 'fatura vencida'],
    difficulty: 'EASY',
    estimatedMinutes: 5,
    featured: true,
    questionTitle: 'O cliente precisa da segunda via de qual vencimento?',
    questionContent: 'Confirme o mes ou vencimento solicitado antes de orientar o envio.',
    actionTitle: 'Confirmar canal de envio',
    actionContent: 'Confirme se o cliente deseja receber pelo canal disponivel, como e-mail, WhatsApp ou portal.',
    solutionTitle: 'Segunda via orientada',
    solutionContent: 'Finalize apos orientar onde acessar ou registrar envio da segunda via.',
    messageTitle: 'Envio de segunda via',
    messageContent:
      'Vou verificar a segunda via da sua fatura. Por favor, confirme o vencimento desejado e o melhor canal para receber a orientacao de pagamento.'
  },
  {
    categorySlug: 'financeiro',
    title: 'Comprovante enviado e desbloqueio em analise',
    slug: 'comprovante-enviado-desbloqueio-em-analise',
    summary: 'Orienta atendimento quando o cliente informa pagamento recente.',
    description: 'Confere prazo de compensacao, comprovante e status financeiro.',
    keywords: ['comprovante', 'desbloqueio', 'pagamento realizado', 'liberacao'],
    symptoms: ['pagou e nao voltou', 'internet bloqueada', 'aguardando compensacao'],
    difficulty: 'EASY',
    estimatedMinutes: 6,
    questionTitle: 'O pagamento foi feito ha quanto tempo?',
    questionContent: 'Pergunte horario, forma de pagamento e se o cliente possui comprovante.',
    actionTitle: 'Registrar informacoes do pagamento',
    actionContent: 'Anote dados do comprovante conforme fluxo interno e informe prazo de verificacao.',
    solutionTitle: 'Cliente orientado sobre analise',
    solutionContent: 'Finalize apos informar o prazo e registrar a solicitacao.',
    messageTitle: 'Pagamento em verificacao',
    messageContent:
      'Obrigado pelo envio das informacoes. Vou registrar o pagamento para verificacao. A liberacao depende da confirmacao no sistema ou da analise do comprovante, conforme o prazo informado.'
  },
  {
    categorySlug: 'visita-tecnica',
    title: 'Agendamento de visita tecnica',
    slug: 'agendamento-de-visita-tecnica',
    summary: 'Fluxo para registrar necessidade de visita tecnica.',
    description: 'Confere testes basicos, disponibilidade e observacoes para a equipe tecnica.',
    keywords: ['visita tecnica', 'agendar tecnico', 'tecnico em casa', 'suporte presencial'],
    symptoms: ['precisa tecnico', 'problema nao resolvido remoto', 'agendamento'],
    difficulty: 'EASY',
    estimatedMinutes: 7,
    featured: true,
    questionTitle: 'Os testes remotos basicos ja foram realizados?',
    questionContent: 'Confirme se reinicializacao, cabos e testes principais ja foram feitos.',
    actionTitle: 'Coletar disponibilidade e endereco',
    actionContent: 'Confirme endereco, ponto de referencia, telefone de contato e melhores horarios.',
    solutionTitle: 'Visita solicitada',
    solutionContent: 'Finalize apos registrar a solicitacao e orientar o cliente sobre retorno/agendamento.',
    messageTitle: 'Solicitacao de visita',
    messageContent:
      'Como os testes basicos nao resolveram, vou registrar a necessidade de visita tecnica. Por favor, confirme telefone de contato, endereco e melhores horarios para atendimento.'
  },
  {
    categorySlug: 'visita-tecnica',
    title: 'Cliente quer remarcar visita tecnica',
    slug: 'remarcacao-de-visita-tecnica',
    summary: 'Orienta remarcacao de atendimento tecnico presencial.',
    description: 'Confere agendamento atual, motivo e nova disponibilidade.',
    keywords: ['remarcar visita', 'reagendar tecnico', 'mudar horario', 'cancelar visita'],
    symptoms: ['nao podera receber tecnico', 'precisa novo horario', 'remarcacao'],
    difficulty: 'EASY',
    estimatedMinutes: 5,
    questionTitle: 'O cliente deseja remarcar ou cancelar?',
    questionContent: 'Confirme se a solicitacao e apenas mudanca de horario/data ou cancelamento.',
    actionTitle: 'Coletar nova disponibilidade',
    actionContent: 'Pergunte melhores dias, horarios e telefone para contato.',
    solutionTitle: 'Remarcacao registrada',
    solutionContent: 'Finalize apos registrar pedido de remarcacao conforme agenda disponivel.',
    messageTitle: 'Remarcacao de visita',
    messageContent:
      'Sem problemas. Vou registrar sua solicitacao de remarcacao. Por favor, informe os melhores dias e horarios para que a equipe possa verificar a disponibilidade.'
  }
];

async function createBasicProcedure(seed: BasicProcedureSeed, authorId: string) {
  const exists = await prisma.procedure.findUnique({
    where: { slug: seed.slug },
    select: { id: true }
  });

  if (exists) {
    return;
  }

  const category = await prisma.category.findUniqueOrThrow({
    where: { slug: seed.categorySlug }
  });

  const procedure = await prisma.procedure.create({
    data: {
      title: seed.title,
      slug: seed.slug,
      summary: seed.summary,
      description: seed.description,
      categoryId: category.id,
      keywords: JSON.stringify(seed.keywords),
      symptoms: JSON.stringify(seed.symptoms),
      difficulty: seed.difficulty,
      estimatedMinutes: seed.estimatedMinutes,
      featured: seed.featured ?? false,
      status: 'PUBLISHED',
      authorId,
      publishedAt: new Date()
    }
  });

  const question = await prisma.procedureStep.create({
    data: {
      procedureId: procedure.id,
      type: 'QUESTION',
      title: seed.questionTitle,
      content: seed.questionContent,
      position: 1
    }
  });

  const action = await prisma.procedureStep.create({
    data: {
      procedureId: procedure.id,
      type: 'ACTION',
      title: seed.actionTitle,
      content: seed.actionContent,
      helperMessage: 'Use a mensagem copiavel quando precisar orientar o cliente.',
      position: 2
    }
  });

  const solution = await prisma.procedureStep.create({
    data: {
      procedureId: procedure.id,
      type: 'FINAL_SOLUTION',
      title: seed.solutionTitle,
      content: seed.solutionContent,
      isFinal: true,
      highlighted: true,
      position: 3
    }
  });

  await Promise.all([
    prisma.procedure.update({
      where: { id: procedure.id },
      data: { initialStepId: question.id }
    }),
    prisma.procedureStep.update({
      where: { id: action.id },
      data: { nextStepId: solution.id }
    })
  ]);

  await prisma.stepOption.createMany({
    data: [
      { stepId: question.id, label: 'Sim', value: 'sim', order: 1, nextStepId: action.id },
      { stepId: question.id, label: 'Nao', value: 'nao', order: 2, nextStepId: solution.id }
    ]
  });

  await prisma.copyableMessage.create({
    data: {
      procedureId: procedure.id,
      stepId: action.id,
      title: seed.messageTitle,
      content: seed.messageContent,
      order: 1,
      status: 'ACTIVE'
    }
  });
}

async function main() {
  const [adminPasswordHash, attendantPasswordHash] = await Promise.all([
    bcrypt.hash('Admin@123456', 12),
    bcrypt.hash('Atendente@123456', 12)
  ]);

  const permissionRecords = await Promise.all(
    permissions.map(([key, module, action, description]) =>
      prisma.permission.upsert({
        where: { key },
        update: { module, action, description, deletedAt: null },
        create: { key, module, action, description }
      })
    )
  );

  const adminRole = await prisma.role.upsert({
    where: { slug: 'admin' },
    update: {
      name: 'Administrador',
      description: 'Acesso completo ao Delta Help Desk.',
      deletedAt: null
    },
    create: {
      name: 'Administrador',
      slug: 'admin',
      description: 'Acesso completo ao Delta Help Desk.'
    }
  });

  const attendantRole = await prisma.role.upsert({
    where: { slug: 'attendant' },
    update: {
      name: 'Atendente',
      description: 'Acesso operacional aos procedimentos publicados.',
      deletedAt: null
    },
    create: {
      name: 'Atendente',
      slug: 'attendant',
      description: 'Acesso operacional aos procedimentos publicados.'
    }
  });

  await Promise.all(
    permissionRecords.map((permission) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id
          }
        },
        update: { deletedAt: null },
        create: {
          roleId: adminRole.id,
          permissionId: permission.id
        }
      })
    )
  );

  const attendantPermissionKeys = [
    'procedures.search',
    'procedures.follow',
    'messages.copy',
    'favorites.manage',
    'history.view_own',
    'usage.resolve'
  ];

  await Promise.all(
    permissionRecords
      .filter((permission) => attendantPermissionKeys.includes(permission.key))
      .map((permission) =>
        prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: attendantRole.id,
              permissionId: permission.id
            }
          },
          update: { deletedAt: null },
          create: {
            roleId: attendantRole.id,
            permissionId: permission.id
          }
        })
      )
  );

  const admin = await prisma.user.upsert({
    where: { email: 'admin@deltahelpdesk.local' },
    update: {
      name: 'Administrador Delta',
      phone: null,
      registration: 'ADM-001',
      passwordHash: adminPasswordHash,
      status: 'ACTIVE',
      notes: 'Usuario administrador criado pelo seed inicial.',
      deletedAt: null
    },
    create: {
      name: 'Administrador Delta',
      email: 'admin@deltahelpdesk.local',
      phone: null,
      registration: 'ADM-001',
      passwordHash: adminPasswordHash,
      status: 'ACTIVE',
      notes: 'Usuario administrador criado pelo seed inicial.'
    }
  });

  const attendant = await prisma.user.upsert({
    where: { email: 'atendente@deltahelpdesk.local' },
    update: {
      name: 'Atendente de Teste',
      phone: null,
      registration: 'ATE-001',
      passwordHash: attendantPasswordHash,
      status: 'ACTIVE',
      notes: 'Usuario atendente criado pelo seed inicial.',
      deletedAt: null
    },
    create: {
      name: 'Atendente de Teste',
      email: 'atendente@deltahelpdesk.local',
      phone: null,
      registration: 'ATE-001',
      passwordHash: attendantPasswordHash,
      status: 'ACTIVE',
      notes: 'Usuario atendente criado pelo seed inicial.'
    }
  });

  await Promise.all([
    prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: { deletedAt: null },
      create: { userId: admin.id, roleId: adminRole.id }
    }),
    prisma.userRole.upsert({
      where: { userId_roleId: { userId: attendant.id, roleId: attendantRole.id } },
      update: { deletedAt: null },
      create: { userId: attendant.id, roleId: attendantRole.id }
    })
  ]);

  await Promise.all(
    categories.map((category) =>
      prisma.category.upsert({
        where: { slug: category.slug },
        update: { ...category, status: 'ACTIVE', deletedAt: null },
        create: { ...category, status: 'ACTIVE' }
      })
    )
  );

  await prisma.category.updateMany({
    where: {
      slug: {
        in: ['conexao', 'equipamentos', 'suporte-tecnico']
      }
    },
    data: {
      status: 'INACTIVE',
      deletedAt: new Date()
    }
  });

  const settings = [
    ['companyName', 'Delta', 'Nome da empresa exibido no sistema.'],
    ['logoUrl', null, 'Referencia do logotipo da empresa.'],
    ['systemName', 'Delta Help Desk', 'Nome do sistema exibido na interface.'],
    ['welcomeMessage', 'Encontre rapidamente o procedimento certo para orientar o cliente.', 'Mensagem de boas-vindas para atendentes.'],
    ['itemsPerPage', 10, 'Quantidade padrao de itens por pagina.'],
    ['sessionTimeoutMinutes', 60, 'Tempo maximo sugerido de sessao em minutos.'],
    ['allowFeedback', true, 'Permite registrar feedback ao concluir atendimentos.'],
    ['allowFavorites', true, 'Permite favoritar procedimentos.'],
    ['showFeaturedProcedures', true, 'Exibe procedimentos em destaque na tela da atendente.'],
    ['requireNoteOnNotResolved', true, 'Exige observacao ao marcar atendimento como nao resolvido.'],
    ['requireNoteOnEscalation', true, 'Exige observacao ao encaminhar atendimento.'],
    ['primaryColor', '#0284c7', 'Cor principal da identidade visual.'],
    [
      'technicalSupportContact',
      { name: 'Suporte tecnico Delta', email: null, phone: null, hours: null, notes: null },
      'Dados de contato do suporte tecnico.'
    ]
  ] as const;

  await Promise.all(
    settings.map(([key, value, description]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: {
          value: JSON.stringify(value),
          description,
          isPublic: true,
          updatedById: admin.id,
          deletedAt: null
        },
        create: {
          key,
          value: JSON.stringify(value),
          description,
          isPublic: true,
          updatedById: admin.id
        }
      })
    )
  );

  await prisma.systemSetting.upsert({
    where: { key: 'app.name' },
    update: {
      value: JSON.stringify('Delta Help Desk'),
      description: 'Nome publico legado do sistema.',
      isPublic: true,
      updatedById: admin.id,
      deletedAt: null
    },
    create: {
      key: 'app.name',
      value: JSON.stringify('Delta Help Desk'),
      description: 'Nome publico legado do sistema.',
      isPublic: true,
      updatedById: admin.id
    }
  });

  for (const procedureSeed of basicProcedures) {
    await createBasicProcedure(procedureSeed, admin.id);
  }

  const demoExists = await prisma.procedure.findUnique({
    where: { slug: 'internet-lenta-ou-sinal-fraco' },
    select: { id: true }
  });

  if (!demoExists) {
    const internetCategory = await prisma.category.findUniqueOrThrow({
      where: { slug: 'internet-lenta' }
    });

    const demoProcedure = await prisma.procedure.create({
      data: {
        title: 'Internet lenta ou sinal fraco',
        slug: 'internet-lenta-ou-sinal-fraco',
        summary: 'Fluxo guiado para diagnosticar lentidao, Wi-Fi ruim, baixa velocidade e conexao oscilando.',
        description:
          'Procedimento para orientar a atendente em verificacoes simples antes de concluir resolucao ou encaminhamento tecnico.',
        categoryId: internetCategory.id,
        keywords: JSON.stringify([
          'internet lenta',
          'internet fraca',
          'Wi-Fi ruim',
          'baixa velocidade',
          'travando',
          'sinal fraco',
          'conexao oscilando'
        ]),
        symptoms: JSON.stringify([
          'lentidao em sites e aplicativos',
          'travamentos em streaming',
          'sinal fraco no Wi-Fi',
          'queda de desempenho em alguns aparelhos'
        ]),
        difficulty: 'EASY',
        estimatedMinutes: 12,
        featured: true,
        status: 'PUBLISHED',
        authorId: admin.id,
        publishedAt: new Date()
      }
    });

    const stepStart = await prisma.procedureStep.create({
      data: {
        procedureId: demoProcedure.id,
        type: 'QUESTION',
        title: 'A lentidao ocorre em todos os aparelhos?',
        content: 'Confirme se o problema acontece em todos os celulares, computadores e TVs ou apenas em um aparelho.',
        position: 1
      }
    });

    const stepNetworkType = await prisma.procedureStep.create({
      data: {
        procedureId: demoProcedure.id,
        type: 'QUESTION',
        title: 'O problema ocorre no Wi-Fi ou tambem no cabo?',
        content: 'Pergunte se algum teste por cabo ja foi feito e se a lentidao aparece tambem em equipamento cabeado.',
        position: 2
      }
    });

    const stepRestart = await prisma.procedureStep.create({
      data: {
        procedureId: demoProcedure.id,
        type: 'ACTION',
        title: 'Reinicializar o roteador',
        content:
          'Oriente o cliente a retirar o roteador da tomada por aproximadamente 30 segundos e ligar novamente. Aguarde as luzes estabilizarem.',
        helperMessage: 'Use a mensagem copiavel desta etapa para orientar o cliente.',
        position: 3
      }
    });

    const stepDevices = await prisma.procedureStep.create({
      data: {
        procedureId: demoProcedure.id,
        type: 'QUESTION',
        title: 'Ha muitos aparelhos ou cameras conectadas?',
        content:
          'Verifique quantidade de celulares, TVs, computadores, cameras de seguranca e se a senha foi compartilhada com terceiros.',
        explanation:
          'Mais aparelhos conectados podem consumir a conexao ao mesmo tempo e reduzir o desempenho percebido.',
        position: 4
      }
    });

    const stepDistance = await prisma.procedureStep.create({
      data: {
        procedureId: demoProcedure.id,
        type: 'CHECK',
        title: 'Testar proximo ao roteador',
        content:
          'Peça para o cliente testar perto do roteador e observar se existem paredes, moveis grandes ou distancia elevada entre aparelho e roteador.',
        position: 5
      }
    });

    const stepFrequency = await prisma.procedureStep.create({
      data: {
        procedureId: demoProcedure.id,
        type: 'INFORMATION',
        title: 'Verificar rede 2.4 GHz ou 5 GHz',
        content:
          'A rede 5 GHz costuma entregar mais velocidade a curta distancia. A rede 2.4 GHz costuma alcancar melhor locais mais distantes, mas pode ter velocidade menor.',
        position: 6
      }
    });

    const stepCableTest = await prisma.procedureStep.create({
      data: {
        procedureId: demoProcedure.id,
        type: 'ACTION',
        title: 'Solicitar teste por cabo',
        content:
          'Quando possivel, solicite teste em um computador conectado por cabo ao roteador para separar problema de Wi-Fi de problema geral da conexao.',
        position: 7
      }
    });

    const stepApps = await prisma.procedureStep.create({
      data: {
        procedureId: demoProcedure.id,
        type: 'QUESTION',
        title: 'Existem aplicativos consumindo banda?',
        content:
          'Pergunte se ha downloads, jogos, streaming em alta qualidade, cameras enviando imagem ou backups em andamento.',
        position: 8
      }
    });

    const stepEquipment = await prisma.procedureStep.create({
      data: {
        procedureId: demoProcedure.id,
        type: 'CHECK',
        title: 'Equipamento compativel com o plano',
        content:
          'Confira se o equipamento usado pelo cliente suporta a velocidade contratada e se o teste esta sendo feito em condicoes adequadas.',
        position: 9
      }
    });

    const stepSolution = await prisma.procedureStep.create({
      data: {
        procedureId: demoProcedure.id,
        type: 'FINAL_SOLUTION',
        title: 'Sinal normalizado ou causa identificada',
        content:
          'Finalize quando a conexao melhorar apos reinicializacao, reducao de consumo simultaneo, teste proximo ao roteador ou ajuste de rede.',
        isFinal: true,
        highlighted: true,
        position: 10
      }
    });

    const stepEscalation = await prisma.procedureStep.create({
      data: {
        procedureId: demoProcedure.id,
        type: 'TECHNICAL_ESCALATION',
        title: 'Encaminhar para suporte tecnico',
        content:
          'Encaminhe quando a lentidao persistir em todos os aparelhos, inclusive por cabo, apos os testes basicos e sem consumo excessivo identificado.',
        isFinal: true,
        highlighted: true,
        position: 11
      }
    });

    await Promise.all([
      prisma.procedure.update({
        where: { id: demoProcedure.id },
        data: { initialStepId: stepStart.id }
      }),
      prisma.procedureStep.update({ where: { id: stepRestart.id }, data: { nextStepId: stepDevices.id } }),
      prisma.procedureStep.update({ where: { id: stepDistance.id }, data: { nextStepId: stepFrequency.id } }),
      prisma.procedureStep.update({ where: { id: stepFrequency.id }, data: { nextStepId: stepCableTest.id } }),
      prisma.procedureStep.update({ where: { id: stepCableTest.id }, data: { nextStepId: stepApps.id } }),
      prisma.procedureStep.update({ where: { id: stepApps.id }, data: { nextStepId: stepEquipment.id } }),
      prisma.procedureStep.update({ where: { id: stepEquipment.id }, data: { nextStepId: stepEscalation.id } })
    ]);

    await prisma.stepOption.createMany({
      data: [
        { stepId: stepStart.id, label: 'Sim, em todos', value: 'todos', order: 1, nextStepId: stepNetworkType.id },
        { stepId: stepStart.id, label: 'Nao, apenas um aparelho', value: 'um-aparelho', order: 2, nextStepId: stepSolution.id },
        { stepId: stepNetworkType.id, label: 'Somente no Wi-Fi', value: 'wifi', order: 1, nextStepId: stepRestart.id },
        { stepId: stepNetworkType.id, label: 'Tambem no cabo', value: 'cabo', order: 2, nextStepId: stepRestart.id },
        { stepId: stepDevices.id, label: 'Sim, muitos aparelhos/cameras', value: 'muitos', order: 1, nextStepId: stepDistance.id },
        { stepId: stepDevices.id, label: 'Nao, poucos aparelhos', value: 'poucos', order: 2, nextStepId: stepDistance.id },
        { stepId: stepDevices.id, label: 'Senha compartilhada', value: 'senha-compartilhada', order: 3, nextStepId: stepDistance.id }
      ]
    });

    await prisma.copyableMessage.createMany({
      data: [
        {
          procedureId: demoProcedure.id,
          stepId: stepRestart.id,
          title: 'Orientacao para reiniciar roteador',
          content:
            'Para realizarmos um teste, por favor, retire o roteador da tomada, aguarde aproximadamente 30 segundos e ligue novamente. Assim que as luzes estabilizarem, me informe se a conexao apresentou melhora.',
          order: 1
        },
        {
          procedureId: demoProcedure.id,
          stepId: stepDevices.id,
          title: 'Explicacao sobre muitos aparelhos',
          content:
            'Mais aparelhos conectados podem usar a internet ao mesmo tempo, como celulares, TVs, cameras e computadores. Isso pode reduzir o desempenho percebido, principalmente durante videos, downloads ou chamadas.',
          order: 1
        },
        {
          procedureId: demoProcedure.id,
          stepId: stepDistance.id,
          title: 'Teste proximo ao roteador',
          content:
            'Pode, por gentileza, ficar proximo ao roteador e testar novamente a navegacao? Paredes, distancia e obstaculos podem diminuir a qualidade do sinal Wi-Fi.',
          order: 1
        },
        {
          procedureId: demoProcedure.id,
          stepId: stepCableTest.id,
          title: 'Solicitacao de teste por cabo',
          content:
            'Se for possivel, conecte um computador ao roteador usando cabo de rede e realize um novo teste. Isso nos ajuda a identificar se a lentidao esta relacionada ao Wi-Fi ou a conexao em geral.',
          order: 1
        },
        {
          procedureId: demoProcedure.id,
          stepId: stepEscalation.id,
          title: 'Encaminhamento tecnico',
          content:
            'Como a lentidao persistiu apos os testes basicos, vou encaminhar seu atendimento para avaliacao tecnica. Nossa equipe verificara os proximos passos e retornara com a orientacao adequada.',
          order: 1
        }
      ]
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
