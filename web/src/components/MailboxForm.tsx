import { Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MailboxState, OpenLine } from '../api/client.js';

interface MailboxFormProps {
  mailbox: MailboxState | null;
  lines: OpenLine[];
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function MailboxForm({ mailbox, lines, onSave, onDelete }: MailboxFormProps) {
  const [form, setForm] = useState({
    email: '',
    imapHost: '',
    imapPort: 993,
    imapUser: '',
    imapPassword: '',
    smtpHost: '',
    smtpPort: 465,
    smtpUser: '',
    smtpPassword: '',
    useSsl: true,
    olLineId: 0,
  });

  useEffect(() => {
    if (mailbox) {
      setForm((current) => ({
        ...current,
        email: mailbox.email,
        imapHost: mailbox.imapHost,
        imapPort: mailbox.imapPort,
        imapUser: mailbox.imapUser,
        smtpHost: mailbox.smtpHost,
        smtpPort: mailbox.smtpPort,
        smtpUser: mailbox.smtpUser,
        useSsl: mailbox.useSsl,
        olLineId: mailbox.olLineId,
      }));
    }
  }, [mailbox]);

  function patch(key: keyof typeof form, value: string | number | boolean): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(form);
      }}
    >
      <div className="form-grid">
        <label>
          Email
          <input
            value={form.email}
            onChange={(event) => patch('email', event.target.value)}
            type="email"
            required
          />
        </label>
        <label>
          Линия
          <select
            value={form.olLineId}
            onChange={(event) => patch('olLineId', Number(event.target.value))}
            required
          >
            <option value={0}>Выберите линию</option>
            {lines.map((line) => {
              const id = Number(line.ID ?? line.id);
              return (
                <option key={id} value={id}>
                  {line.LINE_NAME ?? line.name ?? `Линия ${id}`}
                </option>
              );
            })}
          </select>
        </label>
        <label>
          IMAP host
          <input
            value={form.imapHost}
            onChange={(event) => patch('imapHost', event.target.value)}
            required
          />
        </label>
        <label>
          IMAP port
          <input
            value={form.imapPort}
            onChange={(event) => patch('imapPort', Number(event.target.value))}
            type="number"
            required
          />
        </label>
        <label>
          IMAP user
          <input
            value={form.imapUser}
            onChange={(event) => patch('imapUser', event.target.value)}
            required
          />
        </label>
        <label>
          IMAP password
          <input
            value={form.imapPassword}
            onChange={(event) => patch('imapPassword', event.target.value)}
            type="password"
            placeholder={mailbox ? '••••• сохранён' : ''}
            required={!mailbox}
          />
        </label>
        <label>
          SMTP host
          <input
            value={form.smtpHost}
            onChange={(event) => patch('smtpHost', event.target.value)}
            required
          />
        </label>
        <label>
          SMTP port
          <input
            value={form.smtpPort}
            onChange={(event) => patch('smtpPort', Number(event.target.value))}
            type="number"
            required
          />
        </label>
        <label>
          SMTP user
          <input
            value={form.smtpUser}
            onChange={(event) => patch('smtpUser', event.target.value)}
            required
          />
        </label>
        <label>
          SMTP password
          <input
            value={form.smtpPassword}
            onChange={(event) => patch('smtpPassword', event.target.value)}
            type="password"
            placeholder={mailbox ? '••••• сохранён' : ''}
            required={!mailbox}
          />
        </label>
      </div>
      <label className="check-row">
        <input
          checked={form.useSsl}
          onChange={(event) => patch('useSsl', event.target.checked)}
          type="checkbox"
        />
        SSL/TLS
      </label>
      <div className="form-actions">
        <button className="primary-icon-button" type="submit">
          <Save size={18} />
          <span>Сохранить</span>
        </button>
        {mailbox ? (
          <button className="danger-button" type="button" onClick={() => void onDelete()}>
            <Trash2 size={18} />
            <span>Отключить</span>
          </button>
        ) : null}
      </div>
      {mailbox?.lastError ? <p className="error-text">{mailbox.lastError}</p> : null}
    </form>
  );
}
