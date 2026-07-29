import { createBrowserRouter } from 'react-router-dom';
import { AuditPage } from '../pages/AuditPage';
import { CategoriesPage } from '../pages/CategoriesPage';
import { GuidedProcedurePage } from '../pages/GuidedProcedurePage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { ProceduresPage } from '../pages/ProceduresPage';
import { ProcedureStepsPage } from '../pages/ProcedureStepsPage';
import { ReportsPage } from '../pages/ReportsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { AttendantCollectionPage } from '../pages/AttendantCollectionPage';
import { UsersPage } from '../pages/UsersPage';
import { PrivateRoute } from './PrivateRoute';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/',
    element: <PrivateRoute />,
    children: [
      {
        index: true,
        element: <HomePage />
      },
      {
        path: 'users',
        element: <UsersPage />
      },
      {
        path: 'categories',
        element: <CategoriesPage />
      },
      {
        path: 'procedures',
        element: <ProceduresPage />
      },
      {
        path: 'procedures/:id/steps',
        element: <ProcedureStepsPage />
      },
      {
        path: 'procedures/:id/run',
        element: <GuidedProcedurePage />
      },
      {
        path: 'attendant/:kind',
        element: <AttendantCollectionPage />
      },
      {
        path: 'reports',
        element: <ReportsPage />
      },
      {
        path: 'audit',
        element: <AuditPage />
      },
      {
        path: 'settings',
        element: <SettingsPage />
      }
    ]
  }
]);
