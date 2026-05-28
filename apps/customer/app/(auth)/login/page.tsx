import { Suspense } from 'react';
import LoginForm from './LoginForm';
import { APP_NAME } from '@/lib/constants';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold">{APP_NAME}</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to your account</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
