import type { Message } from '../api/client.js';

interface MessagePaneProps {
  title: string;
  messages: Message[];
  loading: boolean;
}

export function MessagePane({ title, messages, loading }: MessagePaneProps) {
  return (
    <section className="message-pane">
      <div className="panel-head message-title">
        <h2>{title}</h2>
      </div>
      <div className="messages">
        {loading ? <div className="empty-state">Загрузка...</div> : null}
        {!loading && messages.length === 0 ? (
          <div className="empty-state">Выберите диалог</div>
        ) : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={message.senderId === '0' ? 'message inbound' : 'message outbound'}
          >
            <div className="message-text">{message.text}</div>
            {message.files.length > 0 ? (
              <div className="message-files">
                {message.files.map((file) => (
                  <span key={file.id}>{file.name}</span>
                ))}
              </div>
            ) : null}
            <time>{message.date ? new Date(message.date).toLocaleTimeString('ru-RU') : ''}</time>
          </article>
        ))}
      </div>
    </section>
  );
}
