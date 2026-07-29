import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  CornerDownRight,
  Home,
  RotateCcw,
  Send,
  ShieldAlert,
  XCircle
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { Badge, Button, ConfirmDialog, EmptyState, Input, LoadingState, Modal, Textarea, Toast } from '../components/ui';
import { api } from '../lib/api';
import { useSettings } from '../settings/SettingsContext';

type StepType =
  | 'INFORMATION'
  | 'QUESTION'
  | 'ACTION'
  | 'COPYABLE_MESSAGE'
  | 'ALERT'
  | 'CHECK'
  | 'FINAL_SOLUTION'
  | 'TECHNICAL_ESCALATION';

type UsageStatus = 'IN_PROGRESS' | 'RESOLVED' | 'NOT_RESOLVED' | 'ESCALATED' | 'ABANDONED';

type StepOption = {
  id: string;
  label: string;
  description: string | null;
  order: number;
  nextStepId: string | null;
};

type CopyableMessage = {
  id: string;
  title: string;
  content: string;
  order: number;
  status: 'ACTIVE' | 'INACTIVE';
  copyCount: number;
};

type ProcedureStep = {
  id: string;
  title: string;
  instruction: string | null;
  explanation: string | null;
  helperMessage: string | null;
  highlighted: boolean;
  type: StepType;
  position: number;
  nextStepId: string | null;
  isFinal: boolean;
  options: StepOption[];
  messages: CopyableMessage[];
};

type RunnableProcedure = {
  id: string;
  title: string;
  summary: string;
  description: string | null;
  difficulty: 'EASY' | 'MEDIUM' | 'ADVANCED';
  estimatedMinutes: number | null;
  initialStepId: string | null;
  category: { id: string; name: string };
  steps: ProcedureStep[];
};

type UsagePathItem = {
  id: string;
  stepId: string;
  stepTitle: string;
  selectedOptionId: string | null;
  selectedOptionLabel: string | null;
  order: number;
};

type ProcedureUsage = {
  id: string;
  procedureId: string;
  status: UsageStatus;
  currentStepId: string | null;
  startedAt: string;
  completedAt: string | null;
  resolutionNote: string | null;
  path: UsagePathItem[];
};

const finishOptions = [
  { status: 'RESOLVED' as const, label: 'Problema resolvido', tone: 'success', icon: <CheckCircle2 size={18} aria-hidden="true" /> },
  { status: 'NOT_RESOLVED' as const, label: 'Nao resolvido', tone: 'danger', icon: <XCircle size={18} aria-hidden="true" /> },
  { status: 'ESCALATED' as const, label: 'Encaminhado', tone: 'secondary', icon: <ShieldAlert size={18} aria-hidden="true" /> }
];

function storageKey(procedureId: string) {
  return `delta-help-desk:usage:${procedureId}`;
}

function formatStepType(type: StepType) {
  return type.replace(/_/g, ' ');
}

function isFinalStep(step: ProcedureStep) {
  return step.isFinal || step.type === 'FINAL_SOLUTION' || step.type === 'TECHNICAL_ESCALATION';
}

function extractVariables(content: string) {
  return Array.from(new Set(Array.from(content.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)).map((match) => match[1])));
}

function renderVariables(content: string, values: Record<string, string>) {
  return content.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, variable: string) => values[variable] ?? '');
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'message' in error.response.data &&
    typeof error.response.data.message === 'string'
  ) {
    return error.response.data.message;
  }

  return 'Nao foi possivel processar o atendimento agora.';
}

export function GuidedProcedurePage() {
  const { id } = useParams();
  const procedureId = id ?? '';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();
  const [procedure, setProcedure] = useState<RunnableProcedure | null>(null);
  const [usage, setUsage] = useState<ProcedureUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishStatus, setFinishStatus] = useState<'RESOLVED' | 'NOT_RESOLVED' | 'ESCALATED'>('RESOLVED');
  const [finalNote, setFinalNote] = useState('');
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [confirmExit, setConfirmExit] = useState(false);
  const [copyModalMessage, setCopyModalMessage] = useState<CopyableMessage | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const stepsById = useMemo(() => new Map((procedure?.steps ?? []).map((step) => [step.id, step])), [procedure]);
  const currentStep = usage?.currentStepId ? stepsById.get(usage.currentStepId) ?? null : null;
  const progress = procedure && usage ? Math.min(100, Math.round((usage.path.length / Math.max(procedure.steps.length, 1)) * 100)) : 0;
  const isFinished = usage ? usage.status !== 'IN_PROGRESS' : false;

  async function loadProcedureAndUsage() {
    setLoading(true);
    setError(null);

    try {
      const procedureResponse = await api.get(`/attendant/procedures/${procedureId}`);
      const loadedProcedure = procedureResponse.data.data;
      setProcedure(loadedProcedure);

      const storedUsageId = window.localStorage.getItem(storageKey(procedureId));
      if (storedUsageId) {
        try {
          const usageResponse = await api.get(`/attendant/usages/${storedUsageId}`);
          const loadedUsage = usageResponse.data.data;
          if (loadedUsage.status === 'IN_PROGRESS') {
            setUsage(loadedUsage);
            return;
          }
        } catch {
          window.localStorage.removeItem(storageKey(procedureId));
        }
      }

      const usageResponse = await api.post(`/attendant/procedures/${procedureId}/usages`);
      setUsage(usageResponse.data.data);
      window.localStorage.setItem(storageKey(procedureId), usageResponse.data.data.id);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProcedureAndUsage();
  }, [procedureId]);

  async function moveToStep(stepId: string, selectedOptionId?: string | null) {
    if (!usage) return;
    setBusy(true);
    setError(null);

    try {
      const response = await api.post(`/attendant/usages/${usage.id}/steps`, { stepId, selectedOptionId });
      setUsage(response.data.data);
    } catch (moveError) {
      setError(getErrorMessage(moveError));
    } finally {
      setBusy(false);
    }
  }

  async function goBack() {
    if (!usage || usage.path.length <= 1) return;
    setBusy(true);
    try {
      const response = await api.patch(`/attendant/usages/${usage.id}/back`);
      setUsage(response.data.data);
    } catch (backError) {
      setError(getErrorMessage(backError));
    } finally {
      setBusy(false);
    }
  }

  async function restart() {
    if (!usage) return;
    setBusy(true);
    try {
      const response = await api.patch(`/attendant/usages/${usage.id}/restart`);
      setUsage(response.data.data);
      setMessage('Atendimento reiniciado.');
    } catch (restartError) {
      setError(getErrorMessage(restartError));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!usage) return;
    if (finishStatus === 'NOT_RESOLVED' && settings.requireNoteOnNotResolved && !finalNote.trim()) {
      setError('Informe uma observacao para marcar como nao resolvido.');
      return;
    }
    if (finishStatus === 'ESCALATED' && settings.requireNoteOnEscalation && !finalNote.trim()) {
      setError('Informe uma observacao para encaminhar ao suporte tecnico.');
      return;
    }

    setBusy(true);
    try {
      const response = await api.patch(`/attendant/usages/${usage.id}/finish`, {
        status: finishStatus,
        resolutionNote: finalNote || null,
        rating: settings.allowFeedback ? rating : null,
        feedbackComment: settings.allowFeedback ? feedbackComment || null : null
      });
      setUsage(response.data.data);
      window.localStorage.removeItem(storageKey(procedureId));
      setFinishOpen(false);
      setMessage('Atendimento concluido.');
    } catch (finishError) {
      setError(getErrorMessage(finishError));
    } finally {
      setBusy(false);
    }
  }

  async function abandonAndExit() {
    if (!usage || usage.status !== 'IN_PROGRESS') {
      navigate('/');
      return;
    }

    setBusy(true);
    try {
      await api.patch(`/attendant/usages/${usage.id}/abandon`, { resolutionNote: 'Atendimento abandonado pela atendente.' });
      window.localStorage.removeItem(storageKey(procedureId));
      navigate('/');
    } catch (abandonError) {
      setError(getErrorMessage(abandonError));
    } finally {
      setBusy(false);
      setConfirmExit(false);
    }
  }

  async function writeClipboard(text: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!copied) {
      throw new Error('CLIPBOARD_UNAVAILABLE');
    }
  }

  function prepareMessageCopy(copyableMessage: CopyableMessage) {
    const variables = extractVariables(copyableMessage.content);
    if (variables.length === 0) {
      void copyMessage(copyableMessage, copyableMessage.content);
      return;
    }

    setVariableValues(
      Object.fromEntries(
        variables.map((variable) => [
          variable,
          variable === 'nome_atendente' ? user?.name ?? '' : ''
        ])
      )
    );
    setCopyModalMessage(copyableMessage);
  }

  async function copyMessage(copyableMessage: CopyableMessage, content: string) {
    if (!usage) return;

    try {
      await writeClipboard(content);
      await api.post(`/attendant/usages/${usage.id}/messages/${copyableMessage.id}/copy`);
      setMessage('Texto copiado.');
      setCopyModalMessage(null);
    } catch (copyError) {
      setError(copyError instanceof Error && copyError.message === 'CLIPBOARD_UNAVAILABLE' ? 'Nao foi possivel copiar automaticamente. Selecione o texto e copie manualmente.' : getErrorMessage(copyError));
    }
  }

  async function copyFinalSummary() {
    if (!usage) return;
    const summary = [
      `Procedimento: ${procedure?.title ?? ''}`,
      `Resultado: ${usage.status}`,
      usage.resolutionNote ? `Observacao: ${usage.resolutionNote}` : null,
      'Caminho:',
      ...usage.path.map((item) => `${item.order}. ${item.stepTitle}${item.selectedOptionLabel ? ` - ${item.selectedOptionLabel}` : ''}`)
    ].filter(Boolean).join('\n');

    try {
      await writeClipboard(summary);
      setMessage('Resumo final copiado.');
    } catch {
      setError('Nao foi possivel copiar automaticamente. Selecione o texto e copie manualmente.');
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <LoadingState label="Carregando procedimento guiado..." />
      </AppLayout>
    );
  }

  if (!procedure || !usage || !currentStep) {
    return (
      <AppLayout>
        <EmptyState title="Procedimento indisponivel" description={error ?? 'Nao foi possivel abrir este procedimento.'} action={<Button onClick={() => navigate('/')}>Voltar</Button>} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {message && <Toast tone="success" message={message} />}
      {error && <Toast tone="error" message={error} />}

      <section className="space-y-4 pb-28 lg:pb-0">
        <header className="rounded border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Badge tone="blue">{procedure.category.name}</Badge>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">{procedure.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{procedure.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<Home size={18} aria-hidden="true" />} onClick={() => setConfirmExit(true)}>Sair</Button>
              <Button variant="secondary" icon={<RotateCcw size={18} aria-hidden="true" />} onClick={() => void restart()} disabled={busy || isFinished}>Reiniciar</Button>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>Progresso</span>
              <span>{progress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded bg-slate-100" role="progressbar" aria-label="Progresso do procedimento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div className="h-full rounded bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </header>

        <main className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <section className="rounded border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone={isFinalStep(currentStep) ? 'green' : currentStep.type === 'ALERT' ? 'amber' : 'blue'}>
                {formatStepType(currentStep.type)}
              </Badge>
              {currentStep.highlighted && <Badge tone="amber">Destaque</Badge>}
              {isFinished && <Badge tone="green">Concluido</Badge>}
            </div>

            <h2 className="text-2xl font-semibold leading-tight text-slate-950">{currentStep.title}</h2>
            <p className="mt-4 whitespace-pre-line text-base leading-7 text-slate-800">
              {currentStep.instruction ?? 'Sem instrucao cadastrada para esta etapa.'}
            </p>

            {currentStep.explanation && (
              <div className="mt-5 rounded border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {currentStep.explanation}
              </div>
            )}

            {currentStep.helperMessage && (
              <div className="mt-4 rounded border border-brand-100 bg-brand-50 p-4 text-sm leading-6 text-brand-900">
                {currentStep.helperMessage}
              </div>
            )}

            {currentStep.messages.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-base font-semibold text-slate-950">Mensagens copiaveis</h3>
                {currentStep.messages.map((copyableMessage) => (
                  <article className="rounded border border-slate-200 bg-slate-50 p-4" key={copyableMessage.id}>
                    <p className="font-semibold text-slate-950">{copyableMessage.title}</p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{copyableMessage.content}</p>
                    <Button className="mt-3 w-full sm:w-auto" icon={<ClipboardCopy size={18} aria-hidden="true" />} onClick={() => prepareMessageCopy(copyableMessage)}>
                      Copiar mensagem
                    </Button>
                  </article>
                ))}
              </div>
            )}

            {isFinished ? (
              <CompletionPanel usage={usage} onCopySummary={() => void copyFinalSummary()} />
            ) : (
              <StepActions step={currentStep} busy={busy} onMove={moveToStep} onFinish={(status) => { setFinishStatus(status); setFinishOpen(true); }} />
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded border border-slate-200 bg-white p-4">
              <h3 className="text-base font-semibold text-slate-950">Caminho percorrido</h3>
              <ol className="mt-3 space-y-2">
                {usage.path.map((item) => (
                  <li className="rounded bg-slate-50 p-3 text-sm" key={item.id}>
                    <p className="font-medium text-slate-950">{item.order}. {item.stepTitle}</p>
                    {item.selectedOptionLabel && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <CornerDownRight size={14} aria-hidden="true" />
                        {item.selectedOptionLabel}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        </main>
      </section>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 shadow-lg lg:hidden">
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" icon={<ArrowLeft size={18} aria-hidden="true" />} onClick={() => void goBack()} disabled={busy || usage.path.length <= 1 || isFinished}>Voltar</Button>
          <Button variant="secondary" icon={<RotateCcw size={18} aria-hidden="true" />} onClick={() => void restart()} disabled={busy || isFinished}>Reiniciar</Button>
          <Button variant="secondary" icon={<Home size={18} aria-hidden="true" />} onClick={() => setConfirmExit(true)}>Sair</Button>
        </div>
      </footer>

      <div className="hidden gap-2 lg:flex">
        <Button variant="secondary" icon={<ArrowLeft size={18} aria-hidden="true" />} onClick={() => void goBack()} disabled={busy || usage.path.length <= 1 || isFinished}>Voltar uma etapa</Button>
      </div>

      <FinishModal
        open={finishOpen}
        status={finishStatus}
        note={finalNote}
        rating={rating}
        feedbackComment={feedbackComment}
        busy={busy}
        onStatus={setFinishStatus}
        onNote={setFinalNote}
        onRating={setRating}
        onFeedbackComment={setFeedbackComment}
        allowFeedback={settings.allowFeedback}
        requireNote={
          (finishStatus === 'NOT_RESOLVED' && settings.requireNoteOnNotResolved) ||
          (finishStatus === 'ESCALATED' && settings.requireNoteOnEscalation)
        }
        onClose={() => setFinishOpen(false)}
        onFinish={() => void finish()}
      />

      <MessageCopyModal
        message={copyModalMessage}
        values={variableValues}
        onValueChange={(key, value) => setVariableValues((current) => ({ ...current, [key]: value }))}
        onClose={() => setCopyModalMessage(null)}
        onCopy={(copyableMessage, rendered) => void copyMessage(copyableMessage, rendered)}
      />

      <ConfirmDialog
        open={confirmExit}
        title="Sair do atendimento"
        description="O atendimento em andamento sera registrado como abandonado."
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => void abandonAndExit()}
      />
    </AppLayout>
  );
}

function StepActions({
  step,
  busy,
  onMove,
  onFinish
}: {
  step: ProcedureStep;
  busy: boolean;
  onMove: (stepId: string, selectedOptionId?: string | null) => Promise<void>;
  onFinish: (status: 'RESOLVED' | 'NOT_RESOLVED' | 'ESCALATED') => void;
}) {
  const final = isFinalStep(step);

  return (
    <div className="mt-8 space-y-4">
      {step.options.length > 0 && (
        <div className="grid gap-3">
          {step.options.map((option) => (
            <Button
              className="min-h-14 w-full justify-start text-left text-base"
              key={option.id}
              variant="secondary"
              disabled={busy || !option.nextStepId}
              onClick={() => option.nextStepId && void onMove(option.nextStepId, option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}

      {step.nextStepId && (
        <Button className="min-h-14 w-full text-base" disabled={busy} icon={<Send size={18} aria-hidden="true" />} onClick={() => step.nextStepId && void onMove(step.nextStepId)}>
          Continuar
        </Button>
      )}

      {final && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-4">
          <p className="mb-3 text-sm font-semibold text-emerald-950">Informe o resultado do atendimento</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {finishOptions.map((option) => (
              <Button key={option.status} variant={option.status === 'NOT_RESOLVED' ? 'danger' : option.status === 'ESCALATED' ? 'secondary' : 'primary'} icon={option.icon} onClick={() => onFinish(option.status)}>
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompletionPanel({ usage, onCopySummary }: { usage: ProcedureUsage; onCopySummary: () => void }) {
  const labels: Record<UsageStatus, string> = {
    IN_PROGRESS: 'Em andamento',
    RESOLVED: 'Problema resolvido',
    NOT_RESOLVED: 'Nao resolvido',
    ESCALATED: 'Encaminhado',
    ABANDONED: 'Abandonado'
  };

  return (
    <div className="mt-8 rounded border border-emerald-200 bg-emerald-50 p-4">
      <p className="font-semibold text-emerald-950">{labels[usage.status]}</p>
      {usage.resolutionNote && <p className="mt-2 text-sm leading-6 text-emerald-900">{usage.resolutionNote}</p>}
      <Button className="mt-4" variant="secondary" icon={<ClipboardCopy size={18} aria-hidden="true" />} onClick={onCopySummary}>
        Copiar resumo final
      </Button>
    </div>
  );
}

function MessageCopyModal({
  message,
  values,
  onValueChange,
  onClose,
  onCopy
}: {
  message: CopyableMessage | null;
  values: Record<string, string>;
  onValueChange: (key: string, value: string) => void;
  onClose: () => void;
  onCopy: (message: CopyableMessage, rendered: string) => void;
}) {
  if (!message) {
    return null;
  }

  const variables = extractVariables(message.content);
  const rendered = renderVariables(message.content, values);

  return (
    <Modal open={Boolean(message)} title="Preencher variaveis" onClose={onClose}>
      <div className="space-y-4">
        {variables.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {variables.map((variable) => (
              <Input
                key={variable}
                label={`{{${variable}}}`}
                value={values[variable] ?? ''}
                onChange={(event) => onValueChange(variable, event.target.value)}
              />
            ))}
          </div>
        )}
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Preview</p>
          <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{rendered}</p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button icon={<ClipboardCopy size={18} aria-hidden="true" />} onClick={() => onCopy(message, rendered)}>Copiar mensagem</Button>
        </div>
      </div>
    </Modal>
  );
}

function FinishModal({
  open,
  status,
  note,
  rating,
  feedbackComment,
  busy,
  onStatus,
  onNote,
  onRating,
  onFeedbackComment,
  allowFeedback,
  requireNote,
  onClose,
  onFinish
}: {
  open: boolean;
  status: 'RESOLVED' | 'NOT_RESOLVED' | 'ESCALATED';
  note: string;
  rating: number;
  feedbackComment: string;
  busy: boolean;
  onStatus: (status: 'RESOLVED' | 'NOT_RESOLVED' | 'ESCALATED') => void;
  onNote: (note: string) => void;
  onRating: (rating: number) => void;
  onFeedbackComment: (comment: string) => void;
  allowFeedback: boolean;
  requireNote: boolean;
  onClose: () => void;
  onFinish: () => void;
}) {
  return (
    <Modal open={open} title="Concluir atendimento" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {finishOptions.map((option) => (
            <Button key={option.status} variant={status === option.status ? 'primary' : 'secondary'} icon={option.icon} onClick={() => onStatus(option.status)}>
              {option.label}
            </Button>
          ))}
        </div>
        <Textarea label={requireNote ? 'Observacao final obrigatoria' : 'Observacao final'} value={note} onChange={(event) => onNote(event.target.value)} placeholder="Registre detalhes importantes do atendimento." />
        {allowFeedback && (
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Nota do procedimento</p>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <Button key={value} variant={rating === value ? 'primary' : 'secondary'} onClick={() => onRating(value)}>
                  {value}
                </Button>
              ))}
            </div>
          </div>
        )}
        {allowFeedback && <Textarea label="Comentario do feedback" value={feedbackComment} onChange={(event) => onFeedbackComment(event.target.value)} placeholder="Opcional: diga se o fluxo ajudou ou onde travou." />}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={busy} onClick={onFinish}>{busy ? 'Salvando...' : 'Concluir'}</Button>
        </div>
      </div>
    </Modal>
  );
}
