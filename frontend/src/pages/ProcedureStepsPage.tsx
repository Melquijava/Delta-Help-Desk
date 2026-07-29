import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BadgeInfo,
  CheckCircle2,
  CheckSquare,
  CircleHelp,
  ClipboardList,
  Copy,
  CornerDownRight,
  Flag,
  GitBranch,
  LocateFixed,
  MessageSquareText,
  ListChecks,
  Play,
  Plus,
  RotateCw,
  Save,
  ShieldAlert,
  Trash2,
  Wrench,
  XCircle,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
  Toast
} from '../components/ui';
import { api } from '../lib/api';

type StepType =
  | 'INFORMATION'
  | 'QUESTION'
  | 'ACTION'
  | 'COPYABLE_MESSAGE'
  | 'ALERT'
  | 'CHECK'
  | 'FINAL_SOLUTION'
  | 'TECHNICAL_ESCALATION';

type StepOption = {
  id: string;
  label: string;
  value: string;
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
};

type Step = {
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

type Procedure = {
  id: string;
  title: string;
  initialStepId: string | null;
};

type ValidationIssue = {
  type: string;
  message: string;
  stepId?: string;
};

type StepForm = {
  title: string;
  instruction: string;
  explanation: string;
  helperMessage: string;
  highlighted: boolean;
  type: StepType;
  position: number;
  nextStepId: string;
  isFinal: boolean;
};

const emptyStepForm: StepForm = {
  title: '',
  instruction: '',
  explanation: '',
  helperMessage: '',
  highlighted: false,
  type: 'INFORMATION',
  position: 1,
  nextStepId: '',
  isFinal: false
};

const stepTypes = [
  'INFORMATION',
  'QUESTION',
  'ACTION',
  'COPYABLE_MESSAGE',
  'ALERT',
  'CHECK',
  'FINAL_SOLUTION',
  'TECHNICAL_ESCALATION'
].map((value) => ({ label: formatStepType(value), value }));

function formatStepType(type: string) {
  return type.replace(/_/g, ' ');
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
  return 'Nao foi possivel completar a acao agora.';
}

export function ProcedureStepsPage() {
  const { id } = useParams();
  const procedureId = id ?? '';
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [form, setForm] = useState<StepForm>(emptyStepForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'form' | 'tree' | 'preview'>('list');
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  const selectedStep = steps.find((step) => step.id === selectedStepId) ?? null;

  const stepOptions = useMemo(
    () => [
      { label: 'Sem proxima etapa', value: '' },
      ...steps
        .filter((step) => step.id !== selectedStepId)
        .map((step) => ({ label: `${step.position}. ${step.title}`, value: step.id }))
    ],
    [selectedStepId, steps]
  );

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [procedureResponse, stepsResponse, validationResponse] = await Promise.all([
        api.get(`/procedures/${procedureId}`),
        api.get(`/procedures/${procedureId}/steps`),
        api.get(`/procedures/${procedureId}/flow/validation`)
      ]);
      setProcedure(procedureResponse.data.data);
      setSteps(stepsResponse.data.data);
      setIssues(validationResponse.data.data.issues);
      if (!selectedStepId && stepsResponse.data.data[0]) {
        selectStep(stepsResponse.data.data[0]);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [procedureId]);

  function selectStep(step: Step) {
    setSelectedStepId(step.id);
    setForm({
      title: step.title,
      instruction: step.instruction ?? '',
      explanation: step.explanation ?? '',
      helperMessage: step.helperMessage ?? '',
      highlighted: step.highlighted,
      type: step.type,
      position: step.position,
      nextStepId: step.nextStepId ?? '',
      isFinal: step.isFinal
    });
    setActiveTab('form');
  }

  function newStep() {
    setSelectedStepId(null);
    setForm({ ...emptyStepForm, position: steps.length + 1 });
    setActiveTab('form');
  }

  function updateField<K extends keyof StepForm>(key: K, value: StepForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveStep() {
    const payload = {
      ...form,
      instruction: form.instruction || null,
      explanation: form.explanation || null,
      helperMessage: form.helperMessage || null,
      nextStepId: form.nextStepId || null
    };

    if (selectedStepId) {
      await api.put(`/procedures/${procedureId}/steps/${selectedStepId}`, payload);
      setMessage('Etapa atualizada.');
    } else {
      const response = await api.post(`/procedures/${procedureId}/steps`, payload);
      setSelectedStepId(response.data.data.id);
      setMessage('Etapa criada.');
    }
    await loadAll();
  }

  async function setInitial(stepId: string) {
    await api.patch(`/procedures/${procedureId}/initial-step`, { stepId });
    setMessage('Etapa inicial definida.');
    await loadAll();
  }

  async function moveStep(stepId: string, direction: 'up' | 'down') {
    await api.patch(`/procedures/${procedureId}/steps/${stepId}/move`, { direction });
    await loadAll();
  }

  async function duplicateStep(stepId: string) {
    await api.post(`/procedures/${procedureId}/steps/${stepId}/duplicate`);
    setMessage('Etapa duplicada.');
    await loadAll();
  }

  async function deleteStep(stepId: string) {
    await api.delete(`/procedures/${procedureId}/steps/${stepId}`);
    setSelectedStepId(null);
    setMessage('Etapa removida.');
    await loadAll();
  }

  async function saveOption(option: Partial<StepOption>, existingId?: string) {
    if (!selectedStepId) return;
    const payload = {
      label: option.label || 'Opcao',
      value: option.value || null,
      description: option.description || null,
      order: option.order ?? selectedStep?.options.length ?? 0,
      nextStepId: option.nextStepId || null
    };
    if (existingId) {
      await api.put(`/procedures/${procedureId}/steps/${selectedStepId}/options/${existingId}`, payload);
    } else {
      await api.post(`/procedures/${procedureId}/steps/${selectedStepId}/options`, payload);
    }
    await loadAll();
  }

  async function deleteOption(optionId: string) {
    if (!selectedStepId) return;
    await api.delete(`/procedures/${procedureId}/steps/${selectedStepId}/options/${optionId}`);
    await loadAll();
  }

  async function saveMessage(messageItem: Partial<CopyableMessage>, existingId?: string) {
    if (!selectedStepId) return;
    const payload = {
      title: messageItem.title || 'Mensagem',
      content: messageItem.content || '',
      order: messageItem.order ?? selectedStep?.messages.length ?? 0,
      status: messageItem.status ?? 'ACTIVE'
    };
    if (existingId) {
      await api.put(`/procedures/${procedureId}/steps/${selectedStepId}/messages/${existingId}`, payload);
    } else {
      await api.post(`/procedures/${procedureId}/steps/${selectedStepId}/messages`, payload);
    }
    await loadAll();
  }

  async function deleteMessage(messageId: string) {
    if (!selectedStepId) return;
    await api.delete(`/procedures/${procedureId}/steps/${selectedStepId}/messages/${messageId}`);
    await loadAll();
  }

  async function duplicateMessage(messageId: string) {
    if (!selectedStepId) return;
    await api.post(`/procedures/${procedureId}/steps/${selectedStepId}/messages/${messageId}/duplicate`);
    await loadAll();
  }

  if (loading) {
    return (
      <AppLayout>
        <LoadingState label="Carregando editor de etapas..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Editor de fluxo"
        title={procedure?.title ?? 'Procedimento'}
        description="Monte o manual guiado usando etapas, alternativas e mensagens copiaveis."
        actions={<Button icon={<Plus size={18} aria-hidden="true" />} onClick={newStep}>Nova etapa</Button>}
      />

      {message && <Toast tone="success" message={message} />}
      {error && <Toast tone="error" message={error} />}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:hidden">
        {(['list', 'form', 'tree', 'preview'] as const).map((tab) => (
          <Button key={tab} variant={activeTab === tab ? 'primary' : 'secondary'} onClick={() => setActiveTab(tab)}>
            {tab === 'list' ? 'Etapas' : tab === 'form' ? 'Editar' : tab === 'tree' ? 'Arvore' : 'Teste'}
          </Button>
        ))}
      </div>

      <section className="grid gap-5 lg:grid-cols-[300px_minmax(420px,1fr)_430px]">
        <aside className={activeTab === 'list' ? 'block' : 'hidden lg:block'}>
          <StepList
            steps={steps}
            selectedStepId={selectedStepId}
            initialStepId={procedure?.initialStepId ?? null}
            onSelect={selectStep}
            onInitial={setInitial}
            onMove={moveStep}
            onDuplicate={duplicateStep}
            onDelete={(stepId) =>
              setConfirmAction({
                title: 'Excluir etapa',
                description: 'A etapa sera removida e conexoes para ela serao limpas.',
                action: () => deleteStep(stepId)
              })
            }
          />
        </aside>

        <section className={activeTab === 'form' ? 'block' : 'hidden lg:block'}>
          <StepFormPanel
            form={form}
            stepOptions={stepOptions}
            selectedStep={selectedStep}
            onChange={updateField}
            onSave={() => void saveStep().catch((saveError) => setError(getErrorMessage(saveError)))}
            onSaveOption={(option, existingId) => void saveOption(option, existingId).catch((saveError) => setError(getErrorMessage(saveError)))}
            onDeleteOption={(optionId) => void deleteOption(optionId).catch((deleteError) => setError(getErrorMessage(deleteError)))}
            onSaveMessage={(messageItem, existingId) => void saveMessage(messageItem, existingId).catch((saveError) => setError(getErrorMessage(saveError)))}
            onDeleteMessage={(messageId) => void deleteMessage(messageId).catch((deleteError) => setError(getErrorMessage(deleteError)))}
            onDuplicateMessage={(messageId) => void duplicateMessage(messageId).catch((duplicateError) => setError(getErrorMessage(duplicateError)))}
          />
        </section>

        <aside className={activeTab === 'tree' || activeTab === 'preview' ? 'block' : 'hidden lg:block'}>
          <div className={activeTab === 'preview' ? 'hidden lg:block' : 'block'}>
            <FlowTreePanel
              steps={steps}
              issues={issues}
              initialStepId={procedure?.initialStepId ?? null}
              selectedStepId={selectedStepId}
              onSelect={selectStep}
            />
          </div>
          <div className={activeTab === 'tree' ? 'hidden lg:block' : 'block'}>
          <PreviewPanel steps={steps} issues={issues} initialStepId={procedure?.initialStepId ?? null} />
          </div>
        </aside>
      </section>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title ?? ''}
        description={confirmAction?.description ?? ''}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) return;
          confirmAction
            .action()
            .catch((actionError) => setError(getErrorMessage(actionError)))
            .finally(() => setConfirmAction(null));
        }}
      />
    </AppLayout>
  );
}

function StepList({
  steps,
  selectedStepId,
  initialStepId,
  onSelect,
  onInitial,
  onMove,
  onDuplicate,
  onDelete
}: {
  steps: Step[];
  selectedStepId: string | null;
  initialStepId: string | null;
  onSelect: (step: Step) => void;
  onInitial: (stepId: string) => Promise<void>;
  onMove: (stepId: string, direction: 'up' | 'down') => Promise<void>;
  onDuplicate: (stepId: string) => Promise<void>;
  onDelete: (stepId: string) => void;
}) {
  if (steps.length === 0) {
    return <EmptyState title="Sem etapas" description="Crie a primeira etapa para iniciar o fluxo." />;
  }

  return (
    <div className="rounded border border-slate-200 bg-white p-3">
      <h2 className="mb-3 text-base font-semibold">Etapas</h2>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <article className={`rounded border p-3 ${selectedStepId === step.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`} key={step.id}>
            <button className="w-full text-left" type="button" onClick={() => onSelect(step)}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-slate-950">{step.position}. {step.title}</p>
                {initialStepId === step.id && <Badge tone="blue">Inicial</Badge>}
              </div>
              <p className="mt-1 text-xs text-slate-500">{formatStepType(step.type)}</p>
            </button>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="h-11 w-11 px-0" variant="secondary" disabled={index === 0} aria-label={`Mover ${step.title} para cima`} title="Mover para cima" icon={<ArrowUp size={16} aria-hidden="true" />} onClick={() => void onMove(step.id, 'up')} />
              <Button className="h-11 w-11 px-0" variant="secondary" disabled={index === steps.length - 1} aria-label={`Mover ${step.title} para baixo`} title="Mover para baixo" icon={<ArrowDown size={16} aria-hidden="true" />} onClick={() => void onMove(step.id, 'down')} />
              <Button className="h-11 w-11 px-0" variant="secondary" aria-label={`Definir ${step.title} como etapa inicial`} title="Definir como inicial" icon={<ListChecks size={16} aria-hidden="true" />} onClick={() => void onInitial(step.id)} />
              <Button className="h-11 w-11 px-0" variant="secondary" aria-label={`Duplicar ${step.title}`} title="Duplicar" icon={<Copy size={16} aria-hidden="true" />} onClick={() => void onDuplicate(step.id)} />
              <Button className="h-11 w-11 px-0" variant="danger" aria-label={`Excluir ${step.title}`} title="Excluir" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => onDelete(step.id)} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function StepFormPanel({
  form,
  stepOptions,
  selectedStep,
  onChange,
  onSave,
  onSaveOption,
  onDeleteOption,
  onSaveMessage,
  onDeleteMessage,
  onDuplicateMessage
}: {
  form: StepForm;
  stepOptions: Array<{ label: string; value: string }>;
  selectedStep: Step | null;
  onChange: <K extends keyof StepForm>(key: K, value: StepForm[K]) => void;
  onSave: () => void;
  onSaveOption: (option: Partial<StepOption>, existingId?: string) => void;
  onDeleteOption: (optionId: string) => void;
  onSaveMessage: (message: Partial<CopyableMessage>, existingId?: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onDuplicateMessage: (messageId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded border border-slate-200 bg-white p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{selectedStep ? 'Editar etapa' : 'Nova etapa'}</h2>
          <Button icon={<Save size={18} aria-hidden="true" />} onClick={onSave}>Salvar etapa</Button>
        </div>
        <div className="space-y-4">
          <Input label="Titulo" value={form.title} onChange={(event) => onChange('title', event.target.value)} />
          <Textarea label="Instrucao principal" value={form.instruction} onChange={(event) => onChange('instruction', event.target.value)} />
          <Textarea label="Explicacao opcional" value={form.explanation} onChange={(event) => onChange('explanation', event.target.value)} />
          <Input label="Mensagem auxiliar" value={form.helperMessage} onChange={(event) => onChange('helperMessage', event.target.value)} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Tipo" value={form.type} onChange={(event) => onChange('type', event.target.value as StepType)} options={stepTypes} />
            <Input label="Ordem visual" type="number" min={0} value={form.position} onChange={(event) => onChange('position', Number(event.target.value))} />
            <Select label="Proxima etapa padrao" value={form.nextStepId} onChange={(event) => onChange('nextStepId', event.target.value)} options={stepOptions} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-11 items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={form.highlighted} onChange={(event) => onChange('highlighted', event.target.checked)} />
              Destaque visual
            </label>
            <label className="flex min-h-11 items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={form.isFinal} onChange={(event) => onChange('isFinal', event.target.checked)} />
              Etapa final
            </label>
          </div>
        </div>
      </section>

      {selectedStep && (
        <>
          <InlineOptionsEditor step={selectedStep} stepOptions={stepOptions} onSave={onSaveOption} onDelete={onDeleteOption} />
          <InlineMessagesEditor step={selectedStep} onSave={onSaveMessage} onDelete={onDeleteMessage} onDuplicate={onDuplicateMessage} />
        </>
      )}
    </div>
  );
}

function InlineOptionsEditor({
  step,
  stepOptions,
  onSave,
  onDelete
}: {
  step: Step;
  stepOptions: Array<{ label: string; value: string }>;
  onSave: (option: Partial<StepOption>, existingId?: string) => void;
  onDelete: (optionId: string) => void;
}) {
  const [draft, setDraft] = useState<Partial<StepOption>>({ label: '', value: '', description: '', nextStepId: '' });

  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-base font-semibold">Alternativas</h2>
      <div className="space-y-3">
        {step.options.map((option) => (
          <div className="rounded border border-slate-200 p-3" key={option.id}>
            <Input label="Resposta" defaultValue={option.label} onBlur={(event) => onSave({ ...option, label: event.target.value }, option.id)} />
            <Select label="Proxima etapa" value={option.nextStepId ?? ''} onChange={(event) => onSave({ ...option, nextStepId: event.target.value }, option.id)} options={stepOptions} />
            <Button className="mt-2" variant="danger" onClick={() => onDelete(option.id)}>Remover alternativa</Button>
          </div>
        ))}
        <div className="rounded border border-dashed border-slate-300 p-3">
          <Input label="Nova resposta" value={draft.label ?? ''} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} />
          <Select label="Destino" value={draft.nextStepId ?? ''} onChange={(event) => setDraft((current) => ({ ...current, nextStepId: event.target.value }))} options={stepOptions} />
          <Button className="mt-2" variant="secondary" onClick={() => { onSave(draft); setDraft({ label: '', nextStepId: '' }); }}>Adicionar alternativa</Button>
        </div>
      </div>
    </section>
  );
}

function InlineMessagesEditor({
  step,
  onSave,
  onDelete,
  onDuplicate
}: {
  step: Step;
  onSave: (message: Partial<CopyableMessage>, existingId?: string) => void;
  onDelete: (messageId: string) => void;
  onDuplicate: (messageId: string) => void;
}) {
  const [draft, setDraft] = useState<Partial<CopyableMessage>>({ title: '', content: '', order: step.messages.length + 1, status: 'ACTIVE' });

  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-base font-semibold">Mensagens copiaveis</h2>
      <div className="space-y-3">
        {step.messages.map((message) => (
          <div className="rounded border border-slate-200 p-3" key={message.id}>
            <Input label="Titulo" defaultValue={message.title} onBlur={(event) => onSave({ ...message, title: event.target.value }, message.id)} />
            <Textarea label="Mensagem" defaultValue={message.content} onBlur={(event) => onSave({ ...message, content: event.target.value }, message.id)} />
            <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr]">
              <Input label="Ordem" type="number" min={0} defaultValue={message.order} onBlur={(event) => onSave({ ...message, order: Number(event.target.value) }, message.id)} />
              <Select
                label="Status"
                value={message.status}
                onChange={(event) => onSave({ ...message, status: event.target.value as 'ACTIVE' | 'INACTIVE' }, message.id)}
                options={[
                  { label: 'Ativa', value: 'ACTIVE' },
                  { label: 'Inativa', value: 'INACTIVE' }
                ]}
              />
            </div>
            <MessageVariablesPreview content={message.content} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" icon={<Copy size={16} aria-hidden="true" />} onClick={() => onDuplicate(message.id)}>Duplicar mensagem</Button>
              <Button variant="danger" onClick={() => onDelete(message.id)}>Remover mensagem</Button>
            </div>
          </div>
        ))}
        <div className="rounded border border-dashed border-slate-300 p-3">
          <Input label="Titulo" value={draft.title ?? ''} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
          <Textarea label="Mensagem" value={draft.content ?? ''} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} />
          <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr]">
            <Input label="Ordem" type="number" min={0} value={draft.order ?? 0} onChange={(event) => setDraft((current) => ({ ...current, order: Number(event.target.value) }))} />
            <Select
              label="Status"
              value={draft.status ?? 'ACTIVE'}
              onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as 'ACTIVE' | 'INACTIVE' }))}
              options={[
                { label: 'Ativa', value: 'ACTIVE' },
                { label: 'Inativa', value: 'INACTIVE' }
              ]}
            />
          </div>
          <MessageVariablesPreview content={draft.content ?? ''} />
          <Button className="mt-2" variant="secondary" onClick={() => { onSave(draft); setDraft({ title: '', content: '', order: step.messages.length + 2, status: 'ACTIVE' }); }}>Adicionar mensagem</Button>
        </div>
      </div>
    </section>
  );
}

function extractVariables(content: string) {
  return Array.from(new Set(Array.from(content.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)).map((match) => match[1])));
}

function MessageVariablesPreview({ content }: { content: string }) {
  const variables = extractVariables(content);
  if (variables.length === 0) {
    return <p className="mt-2 text-xs text-slate-500">Sem variaveis nesta mensagem.</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {variables.map((variable) => (
        <span className="rounded bg-brand-50 px-2 py-1 text-xs text-brand-800" key={variable}>
          {`{{${variable}}}`}
        </span>
      ))}
    </div>
  );
}

function FlowTreePanel({
  steps,
  issues,
  initialStepId,
  selectedStepId,
  onSelect
}: {
  steps: Step[];
  issues: ValidationIssue[];
  initialStepId: string | null;
  selectedStepId: string | null;
  onSelect: (step: Step) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stepsById = useMemo(() => new Map(steps.map((step) => [step.id, step])), [steps]);
  const invalidStepIds = useMemo(() => new Set(issues.map((issue) => issue.stepId).filter(Boolean) as string[]), [issues]);
  const rootStep = (initialStepId && stepsById.get(initialStepId)) || steps[0] || null;

  function centerTree() {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({
      left: Math.max(0, (element.scrollWidth - element.clientWidth) / 2),
      top: 0,
      behavior: 'smooth'
    });
  }

  function renderNode(stepId: string | null, label: string, path: string[], depth = 0): ReactNode {
    if (!stepId) {
      return <MissingDestinationNode key={`${label}-${depth}`} label={label} depth={depth} />;
    }

    const step = stepsById.get(stepId);
    if (!step) {
      return <MissingDestinationNode key={`${stepId}-${depth}`} label={label} depth={depth} />;
    }

    if (path.includes(stepId)) {
      return <LoopNode key={`${stepId}-loop-${depth}`} step={step} label={label} depth={depth} onSelect={onSelect} />;
    }

    const nextPath = [...path, stepId];
    const optionBranches = [...step.options].sort((first, second) => first.order - second.order);
    const hasConclusion = step.isFinal || step.type === 'FINAL_SOLUTION' || step.type === 'TECHNICAL_ESCALATION';
    const hasBranches = optionBranches.length > 0 || Boolean(step.nextStepId);
    const shouldShowMissingDestination = !hasConclusion && !hasBranches;

    return (
      <div className="relative" key={`${step.id}-${label}-${depth}`}>
        <TreeStepCard
          step={step}
          label={label}
          depth={depth}
          invalid={invalidStepIds.has(step.id)}
          initial={initialStepId === step.id}
          selected={selectedStepId === step.id}
          onSelect={onSelect}
        />
        <div className="ml-5 border-l border-slate-200 pl-4">
          {optionBranches.map((option) => renderNode(option.nextStepId, option.label, nextPath, depth + 1))}
          {step.nextStepId && renderNode(step.nextStepId, 'Proxima etapa padrao', nextPath, depth + 1)}
          {shouldShowMissingDestination && <MissingDestinationNode key={`${step.id}-missing`} label="Sem proxima etapa" depth={depth + 1} />}
        </div>
      </div>
    );
  }

  if (steps.length === 0) {
    return <EmptyState title="Arvore vazia" description="Crie etapas para visualizar o caminho do procedimento." />;
  }

  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <GitBranch size={18} className="text-brand-700" aria-hidden="true" />
          <h2 className="text-base font-semibold">Arvore do procedimento</h2>
        </div>
        <div className="hidden gap-2 lg:flex">
          <Button className="h-10 w-10 px-0" variant="secondary" title="Reduzir zoom" icon={<ZoomOut size={16} aria-hidden="true" />} onClick={() => setZoom((value) => Math.max(0.75, Number((value - 0.1).toFixed(2))))} />
          <Button className="h-10 w-10 px-0" variant="secondary" title="Aumentar zoom" icon={<ZoomIn size={16} aria-hidden="true" />} onClick={() => setZoom((value) => Math.min(1.35, Number((value + 0.1).toFixed(2))))} />
          <Button className="h-10 w-10 px-0" variant="secondary" title="Centralizar" icon={<LocateFixed size={16} aria-hidden="true" />} onClick={centerTree} />
        </div>
      </div>

      <div className="hidden lg:block">
        <div ref={scrollRef} className="max-h-[680px] overflow-auto rounded border border-slate-100 bg-slate-50 p-4">
          <div className="min-w-[640px] transition-transform" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            {rootStep ? renderNode(rootStep.id, 'Etapa inicial', [], 0) : <MissingDestinationNode label="Etapa inicial nao definida" depth={0} />}
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <div className="max-h-[560px] overflow-auto rounded border border-slate-100 bg-slate-50 p-3">
          {rootStep ? renderNode(rootStep.id, 'Etapa inicial', [], 0) : <MissingDestinationNode label="Etapa inicial nao definida" depth={0} />}
        </div>
      </div>
    </section>
  );
}

function TreeStepCard({
  step,
  label,
  depth,
  invalid,
  initial,
  selected,
  onSelect
}: {
  step: Step;
  label: string;
  depth: number;
  invalid: boolean;
  initial: boolean;
  selected: boolean;
  onSelect: (step: Step) => void;
}) {
  const finalStep = step.isFinal || step.type === 'FINAL_SOLUTION' || step.type === 'TECHNICAL_ESCALATION';
  const statusClass = invalid
    ? 'border-amber-300 bg-amber-50'
    : selected
      ? 'border-brand-500 bg-brand-50'
      : finalStep
        ? 'border-emerald-200 bg-emerald-50'
        : initial
          ? 'border-brand-300 bg-white'
          : 'border-slate-200 bg-white';

  return (
    <div className="relative py-2" style={{ marginLeft: depth ? 0 : undefined }}>
      {depth > 0 && <CornerDownRight className="absolute -left-5 top-5 text-slate-300" size={16} aria-hidden="true" />}
      <button
        className={`w-full rounded border p-3 text-left shadow-sm transition hover:border-brand-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 ${statusClass}`}
        type="button"
        onClick={() => onSelect(step)}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-white text-brand-700 shadow-sm">{getStepIcon(step.type)}</span>
          <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
          {initial && <Badge tone="blue">Inicial</Badge>}
          {finalStep && <Badge tone="green">Final</Badge>}
          {invalid && <Badge tone="amber">Verificar</Badge>}
        </div>
        <p className="font-semibold text-slate-950">{step.position}. {step.title}</p>
        <p className="mt-1 text-xs text-slate-500">{formatStepType(step.type)}</p>
        {step.options.length > 0 && (
          <p className="mt-2 text-xs leading-5 text-slate-600">
            Alternativas: {step.options.slice(0, 3).map((option) => option.label).join(', ')}
            {step.options.length > 3 ? ` +${step.options.length - 3}` : ''}
          </p>
        )}
      </button>
    </div>
  );
}

function MissingDestinationNode({ label, depth }: { label: string; depth: number }) {
  return (
    <div className="relative py-2">
      {depth > 0 && <CornerDownRight className="absolute -left-5 top-5 text-amber-400" size={16} aria-hidden="true" />}
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        <div className="flex items-center gap-2 font-semibold">
          <XCircle size={17} aria-hidden="true" />
          {label}
        </div>
        <p className="mt-1 text-xs">Caminho sem destino definido.</p>
      </div>
    </div>
  );
}

function LoopNode({ step, label, depth, onSelect }: { step: Step; label: string; depth: number; onSelect: (step: Step) => void }) {
  return (
    <div className="relative py-2">
      {depth > 0 && <CornerDownRight className="absolute -left-5 top-5 text-red-300" size={16} aria-hidden="true" />}
      <button
        className="w-full rounded border border-red-300 bg-red-50 p-3 text-left text-sm text-red-950 shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100"
        type="button"
        onClick={() => onSelect(step)}
      >
        <div className="mb-1 flex items-center gap-2 font-semibold">
          <RotateCw size={17} aria-hidden="true" />
          Loop detectado em {label}
        </div>
        <p>{step.title}</p>
      </button>
    </div>
  );
}

function getStepIcon(type: StepType) {
  const icons: Record<StepType, ReactNode> = {
    INFORMATION: <BadgeInfo size={17} aria-hidden="true" />,
    QUESTION: <CircleHelp size={17} aria-hidden="true" />,
    ACTION: <ClipboardList size={17} aria-hidden="true" />,
    COPYABLE_MESSAGE: <MessageSquareText size={17} aria-hidden="true" />,
    ALERT: <ShieldAlert size={17} aria-hidden="true" />,
    CHECK: <CheckSquare size={17} aria-hidden="true" />,
    FINAL_SOLUTION: <Flag size={17} aria-hidden="true" />,
    TECHNICAL_ESCALATION: <Wrench size={17} aria-hidden="true" />
  };

  return icons[type];
}

function PreviewPanel({ steps, issues, initialStepId }: { steps: Step[]; issues: ValidationIssue[]; initialStepId: string | null }) {
  const [currentStepId, setCurrentStepId] = useState<string | null>(initialStepId ?? steps[0]?.id ?? null);
  const current = steps.find((step) => step.id === currentStepId) ?? steps[0] ?? null;

  useEffect(() => {
    setCurrentStepId(initialStepId ?? steps[0]?.id ?? null);
  }, [initialStepId, steps]);

  return (
    <div className="space-y-4">
      <section className="rounded border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <GitBranch size={18} className="text-brand-700" aria-hidden="true" />
          <h2 className="text-base font-semibold">Conexoes e validacao</h2>
        </div>
        {issues.length === 0 ? (
          <Toast tone="success" message="Fluxo valido para publicacao." />
        ) : (
          <div className="space-y-2">
            {issues.map((issue, index) => (
              <div className="flex gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900" key={`${issue.type}-${index}`}>
                <AlertTriangle size={16} aria-hidden="true" />
                {issue.message}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Play size={18} className="text-brand-700" aria-hidden="true" />
          <h2 className="text-base font-semibold">Teste do procedimento</h2>
        </div>
        {current ? (
          <div className="space-y-3">
            <Badge tone="blue">{formatStepType(current.type)}</Badge>
            <h3 className="text-lg font-semibold">{current.title}</h3>
            <p className="text-sm leading-6 text-slate-700">{current.instruction ?? 'Sem instrucao principal.'}</p>
            {(current.isFinal || current.type === 'FINAL_SOLUTION' || current.type === 'TECHNICAL_ESCALATION') && (
              <Toast tone="success" message="Conclusao alcancada." />
            )}
            <div className="space-y-2">
              {current.options.map((option) => (
                <Button key={option.id} className="w-full justify-start" variant="secondary" onClick={() => setCurrentStepId(option.nextStepId)}>
                  {option.label}
                </Button>
              ))}
              {current.nextStepId && (
                <Button className="w-full" onClick={() => setCurrentStepId(current.nextStepId)} icon={<CheckCircle2 size={18} aria-hidden="true" />}>
                  Continuar
                </Button>
              )}
            </div>
          </div>
        ) : (
          <EmptyState title="Sem teste disponivel" description="Crie etapas para testar o procedimento." />
        )}
      </section>
    </div>
  );
}
