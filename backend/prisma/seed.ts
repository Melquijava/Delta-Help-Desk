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
