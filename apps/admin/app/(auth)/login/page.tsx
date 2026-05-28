import { Suspense } from 'react';
import LoginForm from './LoginForm';

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold">Senso Admin</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to the admin portal</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
