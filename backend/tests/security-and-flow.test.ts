import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { loginRateLimit } from '../src/middlewares/login-rate-limit.middleware.js';
import { sanitizeAuditData } from '../src/services/audit.service.js';
import { settingsSchema } from '../src/services/settings.service.js';
import { validateStepGraph, type FlowValidationStep } from '../src/services/procedure-steps.service.js';
import { authenticate } from '../src/middlewares/auth.middleware.js';
import { env } from '../src/config/env.js';

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    }
  };
}

function step(overrides: Partial<FlowValidationStep>): FlowValidationStep {
  return {
    id: 'step-1',
    title: 'Etapa',
    type: 'QUESTION',
    isFinal: false,
    nextStepId: null,
    options: [],
    ...overrides
  };
}

test('auditoria mascara senha, token, hash, email e telefone', () => {
  const sanitized = sanitizeAuditData({
    email: 'cliente@example.com',
    phone: '(11) 99999-8888',
    password: 'segredo',
    refreshToken: 'token',
    passwordHash: 'hash',
    nested: { authorization: 'Bearer token' }
  }) as Record<string, unknown>;

  assert.equal(sanitized.email, 'cl***@example.com');
  assert.equal(sanitized.phone, '11***88');
  assert.equal(sanitized.password, '[REDACTED]');
  assert.equal(sanitized.refreshToken, '[REDACTED]');
  assert.equal(sanitized.passwordHash, '[REDACTED]');
  assert.deepEqual(sanitized.nested, { authorization: '[REDACTED]' });
});

test('configuracoes rejeitam valores inseguros', () => {
  const result = settingsSchema.safeParse({
    companyName: 'Delta',
    logoUrl: 'javascript:alert(1)',
    systemName: 'Delta Help Desk',
    welcomeMessage: 'Bem-vindo',
    itemsPerPage: 1000,
    sessionTimeoutMinutes: 5,
    allowFeedback: true,
    allowFavorites: true,
    showFeaturedProcedures: true,
    requireNoteOnNotResolved: true,
    requireNoteOnEscalation: true,
    primaryColor: 'blue',
    technicalSupportContact: {}
  });

  assert.equal(result.success, false);
});

test('rate limit bloqueia excesso de tentativas de login', () => {
  const request = { ip: `127.0.0.${Math.floor(Math.random() * 1000)}` };
  const responses = Array.from({ length: 6 }, () => createResponse());
  let nextCalls = 0;

  for (const response of responses) {
    loginRateLimit(request as never, response as never, () => {
      nextCalls += 1;
    });
  }

  assert.equal(nextCalls, 5);
  assert.equal(responses[5].statusCode, 429);
});

test('access token expirado e rejeitado', async () => {
  const token = jwt.sign(
    {
      sub: 'user-1',
      email: 'atendente@deltahelpdesk.local',
      roles: ['attendant'],
      permissions: ['procedures.search']
    },
    env.JWT_SECRET,
    { expiresIn: '-1s' }
  );
  const response = createResponse();
  let nextCalled = false;

  await authenticate(
    { headers: { authorization: `Bearer ${token}` } } as never,
    response as never,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(response.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('validacao detecta procedimento sem etapa inicial', () => {
  const finalStep = step({ id: 'final', title: 'Solucao', type: 'FINAL_SOLUTION', isFinal: true });
  const result = validateStepGraph([finalStep], null);

  assert.equal(result.isValid, false);
  assert.ok(result.issues.some((issue) => issue.type === 'NO_INITIAL_STEP'));
});

test('validacao detecta alternativa sem proxima etapa', () => {
  const result = validateStepGraph(
    [
      step({
        id: 'question',
        title: 'Pergunta',
        options: [{ nextStepId: null }]
      }),
      step({ id: 'final', title: 'Solucao', type: 'FINAL_SOLUTION', isFinal: true })
    ],
    'question'
  );

  assert.equal(result.isValid, false);
  assert.ok(result.issues.some((issue) => issue.type === 'OPTION_WITHOUT_DESTINATION'));
});

test('validacao detecta fluxo sem solucao final', () => {
  const result = validateStepGraph(
    [step({ id: 'a', nextStepId: 'b' }), step({ id: 'b', title: 'Acao', type: 'ACTION' })],
    'a'
  );

  assert.equal(result.isValid, false);
  assert.ok(result.issues.some((issue) => issue.type === 'NO_FINAL_STEP'));
});

test('validacao detecta loop acidental', () => {
  const result = validateStepGraph(
    [
      step({ id: 'a', nextStepId: 'b' }),
      step({ id: 'b', nextStepId: 'a' }),
      step({ id: 'final', title: 'Solucao', type: 'FINAL_SOLUTION', isFinal: true })
    ],
    'a'
  );

  assert.equal(result.isValid, false);
  assert.ok(result.issues.some((issue) => issue.type === 'LOOP_DETECTED'));
});

test('validacao aprova fluxo com pergunta, alternativa e solucao final', () => {
  const result = validateStepGraph(
    [
      step({ id: 'question', title: 'Pergunta', options: [{ nextStepId: 'final' }] }),
      step({ id: 'final', title: 'Solucao', type: 'FINAL_SOLUTION', isFinal: true })
    ],
    'question'
  );

  assert.equal(result.isValid, true);
  assert.equal(result.issues.length, 0);
});
