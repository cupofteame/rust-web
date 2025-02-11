'use client';

import { useState, useEffect } from 'react';
import { Account, getAccounts, deleteAccount, setAuthToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserCircleIcon, ArrowRightOnRectangleIcon, TrashIcon, UserPlusIcon } from '@heroicons/react/24/outline';

export default function Home() {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (token) {
      setAuthToken(token);
      loadAccounts();
    } else {
      router.push('/login');
    }
  }, [token, router]);

  async function loadAccounts() {
    if (accounts.length === 0) {
      setIsLoading(true);
    }
    
    try {
      const data = await getAccounts();
      setAccounts(data);
      setError('');
    } catch (err) {
      setError('Failed to load accounts');
      if (err instanceof Error && err.message.includes('Invalid token')) {
        logout();
        router.push('/login');
      }
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  }

  async function handleDeleteAccount(id: string) {
    try {
      const wasCurrentUser = await deleteAccount(id);
      if (wasCurrentUser) {
        logout();
        router.push('/login');
      } else {
        await loadAccounts();
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      if (err instanceof Error && err.message.includes('Invalid token')) {
        logout();
        router.push('/login');
      }
    }
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <main className="min-h-screen p-4 sm:p-8 animate-fade-in">
      <div className="container">
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <div className="text-center sm:text-left">
            <h1 className="mb-2">Account Panel</h1>
            <p className="text-muted">I am messing with rust!</p>
          </div>
          
          <div className="flex gap-4 items-center">
            {user ? (
              <>
                <span className="text-sm text-muted">
                  Logged in as <strong className="text-foreground">{user.username}</strong>
                </span>
                <button
                  onClick={handleLogout}
                  className="btn btn-secondary inline-flex items-center gap-2"
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/register"
                  className="btn btn-secondary inline-flex items-center gap-2"
                >
                  <UserPlusIcon className="w-5 h-5" />
                  Register
                </Link>
                <Link
                  href="/login"
                  className="btn btn-primary inline-flex items-center gap-2"
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5" />
                  Login
                </Link>
              </>
            )}
          </div>
        </header>

        {error && (
          <div className="error-message mb-6">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {isInitialLoad ? (
            <div className="card text-center">
              <p className="text-muted animate-pulse-subtle">Loading accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="card text-center">
              <h2 className="text-xl font-semibold mb-2">No Accounts Found</h2>
              <p className="text-muted mb-4">Get started by registering your first account!</p>
              <Link href="/register" className="btn btn-primary">
                Register Now
              </Link>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="text-center text-muted text-sm py-2 animate-pulse-subtle">
                  Refreshing...
                </div>
              )}
              <div className="grid gap-4">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="card flex items-center justify-between hover:scale-[1.01] transition-transform"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserCircleIcon className="w-8 h-8 text-primary" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-lg">{account.username}</span>
                        <span className="text-muted">{account.email}</span>
                        <span className="text-xs text-muted font-mono mt-1">{account.id}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteAccount(account.id)}
                      className="btn btn-danger ml-4 inline-flex items-center gap-2"
                    >
                      <TrashIcon className="w-5 h-5" />
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
