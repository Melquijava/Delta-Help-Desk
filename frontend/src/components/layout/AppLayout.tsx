import type { ReactNode } from 'react';
import {
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  Heart,
  History,
  LogOut,
  Menu,
  Search,
  Settings,
  Shield,
  Users,
  X
} from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { cn } from '../../lib/cn';
import { useSettings } from '../../settings/SettingsContext';
import { Button } from '../ui';

type NavItem = {
  label: string;
  path: string;
  permission?: string;
  icon: ReactNode;
};

const adminItems: NavItem[] = [
  { label: 'Usuarios', path: '/users', permission: 'users.manage', icon: <Users size={18} aria-hidden="true" /> },
  { label: 'Categorias', path: '/categories', permission: 'categories.manage', icon: <ClipboardList size={18} aria-hidden="true" /> },
  { label: 'Procedimentos', path: '/procedures', permission: 'procedures.manage', icon: <BookOpenCheck size={18} aria-hidden="true" /> },
  { label: 'Relatorios', path: '/reports', permission: 'reports.view', icon: <BarChart3 size={18} aria-hidden="true" /> },
  { label: 'Auditoria', path: '/audit', permission: 'audit.view', icon: <Shield size={18} aria-hidden="true" /> },
  { label: 'Configuracoes', path: '/settings', permission: 'settings.manage', icon: <Settings size={18} aria-hidden="true" /> }
];

const attendantItems: NavItem[] = [
  { label: 'Buscar', path: '/', permission: 'procedures.search', icon: <Search size={18} aria-hidden="true" /> },
  { label: 'Favoritos', path: '/attendant/favorites', permission: 'favorites.manage', icon: <Heart size={18} aria-hidden="true" /> },
  { label: 'Recentes', path: '/attendant/recent', permission: 'history.view_own', icon: <History size={18} aria-hidden="true" /> }
];

function LogoBlock() {
  const { settings } = useSettings();

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-white text-brand-700">
        {settings.logoUrl ? <img className="h-8 w-8 object-contain" src={settings.logoUrl} alt="" /> : <BookOpenCheck size={25} aria-hidden="true" />}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-brand-100">{settings.companyName}</p>
        <p className="truncate text-base font-semibold text-white">{settings.systemName}</p>
      </div>
    </div>
  );
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const { hasPermission } = useAuth();
  const { settings } = useSettings();
  const visibleItems = items.filter((item) => {
    if (item.path === '/attendant/favorites' && !settings.allowFavorites) return false;
    return !item.permission || hasPermission(item.permission);
  });

  return (
    <nav className="space-y-1" aria-label="Menu principal">
      {visibleItems.map((item) => (
        <NavLink
          className={({ isActive }) =>
            cn(
              'flex min-h-11 w-full items-center gap-3 rounded px-3 py-2 text-left text-sm font-medium text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
              isActive && item.path !== '/' && 'bg-white/10 text-white'
            )
          }
          key={item.label}
          to={item.path}
          onClick={onNavigate}
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function Sidebar() {
  const { hasPermission } = useAuth();
  const { settings } = useSettings();
  const isAdmin = hasPermission('settings.manage');

  return (
    <aside className="hidden w-72 shrink-0 bg-slate-950 px-4 py-5 lg:block">
      <LogoBlock />
      <div className="mt-8">
        <p className="mb-2 px-3 text-xs font-semibold uppercase text-slate-400">
          {isAdmin ? 'Administracao' : 'Atendimento'}
        </p>
        <NavList items={isAdmin ? adminItems : attendantItems} />
      </div>
      <div className="mt-8 rounded border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">Identidade visual</p>
        <p className="mt-1 text-xs leading-5 text-slate-300">{settings.companyName} - {settings.systemName}</p>
      </div>
    </aside>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout, hasPermission } = useAuth();
  const { settings } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = hasPermission('settings.manage');

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 lg:flex">
      <Sidebar />

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 lg:hidden">
          <aside className="flex h-full w-80 max-w-[88vw] flex-col bg-slate-950 px-4 py-5">
            <div className="flex items-center justify-between">
              <LogoBlock />
              <Button className="h-11 w-11 px-0 text-white hover:bg-white/10" variant="ghost" title="Fechar menu" onClick={() => setMenuOpen(false)} icon={<X size={20} aria-hidden="true" />} />
            </div>
            <div className="mt-8">
              <p className="mb-2 px-3 text-xs font-semibold uppercase text-slate-400">
                {isAdmin ? 'Administracao' : 'Atendimento'}
              </p>
              <NavList items={isAdmin ? adminItems : attendantItems} onNavigate={() => setMenuOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button className="h-11 w-11 px-0 lg:hidden" variant="secondary" title="Abrir menu" onClick={() => setMenuOpen(true)} icon={<Menu size={20} aria-hidden="true" />} />
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-500">{settings.systemName} / Inicio</p>
                <p className="truncate text-sm font-semibold text-slate-950">
                  {isAdmin ? 'Painel administrativo' : 'Painel da atendente'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right text-sm sm:block">
                <p className="font-medium text-slate-900">{user?.name}</p>
                <p className="text-slate-500">{user?.roles.join(', ')}</p>
              </div>
              <Button className="h-11 w-11 px-0" variant="secondary" title="Sair" onClick={() => void logout()} icon={<LogOut size={18} aria-hidden="true" />} />
            </div>
          </div>
        </header>

        <main className={cn('mx-auto w-full max-w-7xl px-4 py-6 sm:px-6', isAdmin ? 'space-y-6' : 'space-y-5')}>
          {children}
        </main>
      </div>
    </div>
  );
}
