import { useCallback, useEffect, useState } from 'react';
import type { Dialog, Message } from '../api/client.js';
import { api } from '../api/client.js';
import { Composer } from '../components/Composer.js';
import { DialogList } from '../components/DialogList.js';
import { MessagePane } from '../components/MessagePane.js';

export function Inbox() {
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [selected, setSelected] = useState<Dialog | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingDialogs, setLoadingDialogs] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const loadDialogs = useCallback(async () => {
    setLoadingDialogs(true);
    try {
      const next = await api.dialogs();
      setDialogs(next);
      if (!selected && next[0]) {
        setSelected(next[0]);
      }
    } finally {
      setLoadingDialogs(false);
    }
  }, [selected]);

  const loadMessages = useCallback(async (dialog: Dialog | null) => {
    if (!dialog) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    try {
      setMessages(await api.messages(dialog.chatId));
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    void loadDialogs();
    const timer = window.setInterval(() => void loadDialogs(), 5000);
    return () => window.clearInterval(timer);
  }, [loadDialogs]);

  useEffect(() => {
    void loadMessages(selected);
    const timer = window.setInterval(() => void loadMessages(selected), 5000);
    return () => window.clearInterval(timer);
  }, [loadMessages, selected]);

  async function send(message: string): Promise<void> {
    if (!selected) {
      return;
    }
    await api.send(selected.id, message);
    await loadMessages(selected);
  }

  return (
    <main className="inbox">
      <DialogList
        dialogs={dialogs}
        selectedChatId={selected?.chatId}
        loading={loadingDialogs}
        onSelect={setSelected}
        onRefresh={() => void loadDialogs()}
      />
      <div className="conversation">
        <MessagePane
          title={selected?.title ?? 'Диалог'}
          messages={messages}
          loading={loadingMessages}
        />
        <Composer disabled={!selected} onSend={send} />
      </div>
    </main>
  );
}
