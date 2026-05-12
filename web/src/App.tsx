import { Inbox, Settings } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from './api/client.js';
import { readBitrixFrameAuth } from './auth/b24Iframe.js';
import { Inbox as InboxPage } from './pages/Inbox.js';
import { Settings as SettingsPage } from './pages/Settings.js';

type Route = 'inbox' | 'settings';

function currentRoute(): Route {
  return window.location.hash.startsWith('#/settings') ? 'settings' : 'inbox';
}

export function App() {
  const [route, setRoute] = useState<Route>(currentRoute());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useMemo(() => readBitrixFrameAuth(), []);

  useEffect(() => {
    function onHashChange(): void {
      setRoute(currentRoute());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    async function boot(): Promise<void> {
      if (!auth) {
        setError('Ожидание авторизации Битрикс24');
        return;
      }
      await api.createSession(auth);
      setReady(true);
    }
    void boot().catch((bootError: unknown) => {
      setError(bootError instanceof Error ? bootError.message : 'Ошибка авторизации');
    });
  }, [auth]);

  if (error && !ready) {
    return <div className="boot-state">{error}</div>;
  }

  if (!ready) {
    return <div className="boot-state">Загрузка...</div>;
  }

  return (
    <div className="shell">
      <nav className="top-nav">
        <a className={route === 'inbox' ? 'nav-link active' : 'nav-link'} href="#/inbox">
          <Inbox size={18} />
          <span>Inbox</span>
        </a>
        <a className={route === 'settings' ? 'nav-link active' : 'nav-link'} href="#/settings">
          <Settings size={18} />
          <span>Настройки</span>
        </a>
      </nav>
      {route === 'settings' ? <SettingsPage /> : <InboxPage />}
    </div>
  );
}
