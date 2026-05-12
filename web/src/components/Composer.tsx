import { Send, Paperclip } from 'lucide-react';
import { useState } from 'react';

interface ComposerProps {
  disabled: boolean;
  onSend: (message: string) => Promise<void>;
}

export function Composer({ disabled, onSend }: ComposerProps) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(): Promise<void> {
    const message = value.trim();
    if (!message || disabled || sending) {
      return;
    }
    setSending(true);
    try {
      await onSend(message);
      setValue('');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="composer">
      <button className="icon-button" type="button" title="Вложения" disabled>
        <Paperclip size={18} />
      </button>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Введите ответ..."
        disabled={disabled}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            void submit();
          }
        }}
      />
      <button
        className="primary-icon-button"
        type="button"
        onClick={() => void submit()}
        disabled={disabled || sending}
      >
        <Send size={18} />
        <span>Отправить</span>
      </button>
    </div>
  );
}
