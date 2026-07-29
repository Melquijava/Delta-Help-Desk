import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { api } from '../lib/api';

const technicalSupportContactSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  hours: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

export const appSettingsSchema = z.object({
  companyName: z.string(),
  logoUrl: z.string().nullable().optional(),
  systemName: z.string(),
  welcomeMessage: z.string(),
  itemsPerPage: z.number(),
  sessionTimeoutMinutes: z.number(),
  allowFeedback: z.boolean(),
  allowFavorites: z.boolean(),
  showFeaturedProcedures: z.boolean(),
  requireNoteOnNotResolved: z.boolean(),
  requireNoteOnEscalation: z.boolean(),
  primaryColor: z.string(),
  technicalSupportContact: technicalSupportContactSchema
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const defaultAppSettings: AppSettings = {
  companyName: 'Delta',
  logoUrl: null,
  systemName: 'Delta Help Desk',
  welcomeMessage: 'Encontre rapidamente o procedimento certo para orientar o cliente.',
  itemsPerPage: 10,
  sessionTimeoutMinutes: 60,
  allowFeedback: true,
  allowFavorites: true,
  showFeaturedProcedures: true,
  requireNoteOnNotResolved: true,
  requireNoteOnEscalation: true,
  primaryColor: '#0284c7',
  technicalSupportContact: {
    name: 'Suporte tecnico Delta',
    email: null,
    phone: null,
    hours: null,
    notes: null
  }
};

type SettingsContextValue = {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function applyIdentity(settings: AppSettings) {
  document.documentElement.style.setProperty('--brand-primary', settings.primaryColor);
  document.documentElement.style.setProperty('--brand-primary-soft', `${settings.primaryColor}1a`);
  document.title = settings.systemName;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshSettings() {
    setError(null);
    try {
      const response = await api.get('/settings/public');
      const nextSettings = appSettingsSchema.parse(response.data.data);
      setSettings(nextSettings);
      applyIdentity(nextSettings);
    } catch {
      setError('Nao foi possivel carregar configuracoes. Usando padroes locais.');
      applyIdentity(defaultAppSettings);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshSettings();
  }, []);

  const value = useMemo(
    () => ({
      settings,
      isLoading,
      error,
      refreshSettings
    }),
    [error, isLoading, settings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }

  return context;
}
