import { BookOpenCheck, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/AuthContext';
import { Button, Input } from '../components/ui';
import { useSettings } from '../settings/SettingsContext';

const loginSchema = z.object({
  email: z.string({ required_error: 'Informe seu e-mail.' }).trim().min(1, 'Informe seu e-mail.').email('Informe um e-mail valido.'),
  password: z.string({ required_error: 'Informe sua senha.' }).min(1, 'Informe sua senha.')
});

type LoginForm = z.infer<typeof loginSchema>;
type LoginErrors = Partial<Record<keyof LoginForm, string>>;

export function LoginPage() {
  const { login, isAuthenticated, error } = useAuth();
  const { settings } = useSettings();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setErrors({});

    const formData = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password')
    });

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0]
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await login(parsed.data.email, parsed.data.password);
      navigate(from, { replace: true });
    } catch (loginError) {
      setSubmitError(loginError instanceof Error ? loginError.message : 'Nao foi possivel entrar.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 text-slate-950">
      <section className="w-full max-w-md rounded border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-950 text-white">
            {settings.logoUrl ? <img className="h-9 w-9 object-contain" src={settings.logoUrl} alt="" /> : <BookOpenCheck size={24} aria-hidden="true" />}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-brand-700">{settings.companyName}</p>
            <h1 className="text-xl font-semibold">{settings.systemName}</h1>
            <p className="text-sm text-slate-600">Entre para continuar</p>
          </div>
        </div>

        {(submitError || error) && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError ?? error}
          </div>
        )}

        <form className="space-y-4" noValidate onSubmit={onSubmit}>
          <Input
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            error={errors.email}
          />

          <Input
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            error={errors.password}
          />

          <Button
            className="w-full"
            type="submit"
            disabled={isSubmitting}
            icon={isSubmitting ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : undefined}
          >
            Entrar
          </Button>
        </form>
      </section>
    </main>
  );
}
