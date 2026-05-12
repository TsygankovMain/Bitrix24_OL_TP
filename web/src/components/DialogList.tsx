import { RefreshCcw } from 'lucide-react';
import type { Dialog } from '../api/client.js';

interface DialogListProps {
  dialogs: Dialog[];
  selectedChatId?: number;
  loading: boolean;
  onSelect: (dialog: Dialog) => void;
  onRefresh: () => void;
}

export function DialogList({
  dialogs,
  selectedChatId,
  loading,
  onSelect,
  onRefresh,
}: DialogListProps) {
  return (
    <aside className="dialog-list">
      <div className="panel-head">
        <h1>Диалоги</h1>
        <button className="icon-button" type="button" onClick={onRefresh} title="Обновить">
          <RefreshCcw size={18} className={loading ? 'spin' : ''} />
        </button>
      </div>
      <div className="dialog-items">
        {dialogs.map((dialog) => (
          <button
            key={`${dialog.id}-${dialog.chatId}`}
            className={dialog.chatId === selectedChatId ? 'dialog-item active' : 'dialog-item'}
            type="button"
            onClick={() => onSelect(dialog)}
          >
            <span className="dialog-title">{dialog.title}</span>
            <span className="dialog-time">
              {dialog.date ? new Date(dialog.date).toLocaleTimeString('ru-RU') : ''}
            </span>
            <span className="dialog-preview">{dialog.lastMessage || 'Нет сообщений'}</span>
          </button>
        ))}
        {!loading && dialogs.length === 0 ? (
          <div className="empty-state">Нет активных диалогов</div>
        ) : null}
      </div>
    </aside>
  );
}
