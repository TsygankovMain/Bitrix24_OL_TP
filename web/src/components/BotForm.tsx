import { Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { BotState, OpenLine } from '../api/client.js';

interface BotFormProps {
  bot: BotState | null;
  lines: OpenLine[];
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}

export function BotForm({ bot, lines, onSave }: BotFormProps) {
  const [form, setForm] = useState<BotState & { vibecodeApiKey?: string }>({
    enabled: false,
    systemPrompt: '',
    faq: [],
    attachedOlLines: [],
    handoffAfterMessages: 3,
    worktimeOnly: false,
    hasVibecodeApiKey: false,
  });

  useEffect(() => {
    if (bot) {
      setForm({ ...bot, vibecodeApiKey: '' });
    }
  }, [bot]);

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleLine(lineId: number): void {
    const next = form.attachedOlLines.includes(lineId)
      ? form.attachedOlLines.filter((id) => id !== lineId)
      : [...form.attachedOlLines, lineId];
    patch('attachedOlLines', next);
  }

  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({ ...form });
      }}
    >
      <label className="check-row">
        <input
          checked={form.enabled}
          onChange={(event) => patch('enabled', event.target.checked)}
          type="checkbox"
        />
        Включить бота
      </label>
      <label>
        Системный промпт
        <textarea
          className="large-textarea"
          value={form.systemPrompt}
          onChange={(event) => patch('systemPrompt', event.target.value)}
        />
      </label>
      <label>
        VibeCode API key
        <input
          value={form.vibecodeApiKey ?? ''}
          onChange={(event) => patch('vibecodeApiKey', event.target.value)}
          type="password"
          placeholder={form.hasVibecodeApiKey ? '••••• сохранён' : ''}
        />
      </label>
      <div className="line-picker">
        {lines.map((line) => {
          const id = Number(line.ID ?? line.id);
          return (
            <label key={id} className="check-row compact">
              <input
                checked={form.attachedOlLines.includes(id)}
                onChange={() => toggleLine(id)}
                type="checkbox"
              />
              {line.LINE_NAME ?? line.name ?? `Линия ${id}`}
            </label>
          );
        })}
      </div>
      <label>
        Передать оператору после N реплик
        <input
          value={form.handoffAfterMessages}
          onChange={(event) => patch('handoffAfterMessages', Number(event.target.value))}
          type="number"
          min={1}
          max={20}
        />
      </label>
      <label className="check-row">
        <input
          checked={form.worktimeOnly}
          onChange={(event) => patch('worktimeOnly', event.target.checked)}
          type="checkbox"
        />
        Только в нерабочее время
      </label>
      <div className="faq-head">
        <h3>FAQ</h3>
        <button
          className="icon-button"
          type="button"
          onClick={() => patch('faq', [...form.faq, { q: '', a: '' }])}
          disabled={form.faq.length >= 50}
          title="Добавить"
        >
          <Plus size={18} />
        </button>
      </div>
      <div className="faq-list">
        {form.faq.map((pair, index) => (
          <div className="faq-row" key={index}>
            <input
              value={pair.q}
              onChange={(event) => {
                const next = [...form.faq];
                next[index] = { ...pair, q: event.target.value };
                patch('faq', next);
              }}
              placeholder="Вопрос"
            />
            <textarea
              value={pair.a}
              onChange={(event) => {
                const next = [...form.faq];
                next[index] = { ...pair, a: event.target.value };
                patch('faq', next);
              }}
              placeholder="Ответ"
            />
            <button
              className="icon-button"
              type="button"
              title="Удалить"
              onClick={() =>
                patch(
                  'faq',
                  form.faq.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button className="primary-icon-button" type="submit">
          <Save size={18} />
          <span>Сохранить</span>
        </button>
      </div>
    </form>
  );
}
