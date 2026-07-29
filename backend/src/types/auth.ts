export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE';
  roles: string[];
  permissions: string[];
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
};
