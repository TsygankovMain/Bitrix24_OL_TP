import { Bot, Info, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { BotState, MailboxState, OpenLine } from '../api/client.js';
import { api } from '../api/client.js';
import { BotForm } from '../components/BotForm.js';
import { MailboxForm } from '../components/MailboxForm.js';

type Tab = 'mail' | 'bot' | 'about';

export function Settings() {
  const [tab, setTab] = useState<Tab>('mail');
  const [lines, setLines] = useState<OpenLine[]>([]);
  const [mailbox, setMailbox] = useState<MailboxState | null>(null);
  const [bot, setBot] = useState<BotState | null>(null);
  const [status, setStatus] = useState('');

  async function load(): Promise<void> {
    const [nextLines, nextMailbox, nextBot] = await Promise.all([
      api.openLines(),
      api.mailbox(),
      api.bot(),
    ]);
    setLines(nextLines);
    setMailbox(nextMailbox);
    setBot(nextBot);
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveMailbox(payload: Record<string, unknown>): Promise<void> {
    await api.saveMailbox(payload);
    setStatus('Почта сохранена');
    await load();
  }

  async function deleteMailbox(): Promise<void> {
    await api.deleteMailbox();
    setStatus('Почта отключена');
    await load();
  }

  async function saveBot(payload: Record<string, unknown>): Promise<void> {
    await api.saveBot(payload);
    setStatus('Бот сохранён');
    await load();
  }

  return (
    <main className="settings">
      <div className="settings-tabs" role="tablist">
        <button
          className={tab === 'mail' ? 'tab active' : 'tab'}
          type="button"
          onClick={() => setTab('mail')}
        >
          <Mail size={18} />
          <span>Почта</span>
        </button>
        <button
          className={tab === 'bot' ? 'tab active' : 'tab'}
          type="button"
          onClick={() => setTab('bot')}
        >
          <Bot size={18} />
          <span>Бот</span>
        </button>
        <button
          className={tab === 'about' ? 'tab active' : 'tab'}
          type="button"
          onClick={() => setTab('about')}
        >
          <Info size={18} />
          <span>О приложении</span>
        </button>
      </div>
      <section className="settings-body">
        {status ? <div className="status-line">{status}</div> : null}
        {tab === 'mail' ? (
          <MailboxForm
            mailbox={mailbox}
            lines={lines}
            onSave={saveMailbox}
            onDelete={deleteMailbox}
          />
        ) : null}
        {tab === 'bot' ? <BotForm bot={bot} lines={lines} onSave={saveBot} /> : null}
        {tab === 'about' ? (
          <div className="about-pane">
            <dl>
              <dt>Версия</dt>
              <dd>0.1.0</dd>
              <dt>Inbox</dt>
              <dd>Polling 5 секунд</dd>
              <dt>Email</dt>
              <dd>1 ящик на портал</dd>
            </dl>
          </div>
        ) : null}
      </section>
    </main>
  );
}
