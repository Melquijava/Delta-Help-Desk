import { BookOpenCheck, Clock3, Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { Badge, Button, EmptyState, LoadingState, PageHeader, Toast } from '../components/ui';
import { api } from '../lib/api';

type ProcedureDifficulty = 'EASY' | 'MEDIUM' | 'ADVANCED';

type ProcedureCardData = {
  id: string;
  title: string;
  summary: string;
  difficulty: ProcedureDifficulty;
  estimatedMinutes: number | null;
  category: { name: string };
  stepCount: number;
  isFavorite: boolean;
};

function difficultyLabel(difficulty: ProcedureDifficulty) {
  const labels: Record<ProcedureDifficulty, string> = {
    EASY: 'Facil',
    MEDIUM: 'Media',
    ADVANCED: 'Avancada'
  };
  return labels[difficulty];
}

export function AttendantCollectionPage() {
  const { kind } = useParams();
  const navigate = useNavigate();
  const isFavorites = kind === 'favorites';
  const [procedures, setProcedures] = useState<ProcedureCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(isFavorites ? '/attendant/favorites' : '/attendant/recent');
      setProcedures(response.data.data);
    } catch {
      setError('Nao foi possivel carregar a lista agora.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite(procedureId: string) {
    try {
      await api.patch(`/attendant/procedures/${procedureId}/favorite`);
      await load();
    } catch {
      setError('Nao foi possivel atualizar favorito.');
    }
  }

  useEffect(() => {
    void load();
  }, [kind]);

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Atendimento"
        title={isFavorites ? 'Favoritos' : 'Usados recentemente'}
        description={isFavorites ? 'Procedimentos sincronizados com o banco para acesso rapido.' : 'Ultimos procedimentos utilizados, sem repeticoes na lista.'}
      />
      {error && <Toast tone="error" message={error} />}
      {loading ? (
        <LoadingState label="Carregando procedimentos..." />
      ) : procedures.length === 0 ? (
        <EmptyState title={isFavorites ? 'Sem favoritos' : 'Sem historico'} description="Abra ou favorite procedimentos publicados para alimentar esta lista." />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {procedures.map((procedure) => (
            <article className="rounded border border-slate-200 bg-white p-4" key={procedure.id}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <Badge tone="blue">{procedure.category.name}</Badge>
                <button
                  className={`flex h-11 w-11 items-center justify-center rounded border ${procedure.isFavorite ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-slate-200 text-slate-500'}`}
                  type="button"
                  onClick={() => void toggleFavorite(procedure.id)}
                  title={procedure.isFavorite ? 'Remover favorito' : 'Favoritar'}
                >
                  <Heart size={18} fill={procedure.isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
                </button>
              </div>
              <h2 className="text-base font-semibold text-slate-950">{procedure.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{procedure.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1">
                  <Clock3 size={14} aria-hidden="true" />
                  {procedure.estimatedMinutes ? `${procedure.estimatedMinutes} min` : 'Tempo nao informado'}
                </span>
                <span className="rounded bg-slate-100 px-2 py-1">{difficultyLabel(procedure.difficulty)}</span>
                <span className="rounded bg-slate-100 px-2 py-1">{procedure.stepCount} etapas</span>
              </div>
              <Button className="mt-4 w-full" variant="secondary" icon={<BookOpenCheck size={18} aria-hidden="true" />} onClick={() => navigate(`/procedures/${procedure.id}/run`)}>
                Abrir procedimento
              </Button>
            </article>
          ))}
        </section>
      )}
    </AppLayout>
  );
}
