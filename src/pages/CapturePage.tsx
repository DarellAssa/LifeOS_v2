import { useState, useCallback } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Inbox, StickyNote, Sparkles, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type Tab = 'inbox' | 'notes';

export default function CapturePage() {
  const { data, addInboxItem, createNote, deleteInboxItem, setInboxStatus } = useAppContext();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [tab, setTab] = useState<Tab>('inbox');

  const unprocessed = data.inboxItems.filter(i => i.status === 'unprocessed');
  const notes = data.notes.slice(0, 10);

  const handleCapture = () => {
    if (!input.trim()) return;
    addInboxItem(input.trim(), 'manual');
    setInput('');
  };

  const handleOpenCopilot = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-copilot', { detail: { message: 'Help me triage my inbox items — decide what to convert to tasks, notes, or dismiss.' } }));
  }, []);

  return (
    <div className="max-w-xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Capture</h1>
        <p className="text-sm text-muted-foreground">Quick thoughts, links, ideas — organize later</p>
      </div>

      {/* Capture input */}
      <div className="space-y-3">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Capture anything…"
          className="min-h-[80px] text-base resize-none bg-card"
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleCapture();
            }
          }}
        />
        <div className="flex items-center gap-2">
          <Button onClick={handleCapture} disabled={!input.trim()} className="gap-2">
            <Inbox className="h-4 w-4" /> Add to Inbox
          </Button>
          <span className="text-xs text-muted-foreground">⌘+Enter</span>
        </div>
      </div>

      {/* Triage CTA */}
      {unprocessed.length > 2 && (
        <button
          onClick={handleOpenCopilot}
          className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors hover:bg-secondary"
        >
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span className="flex-1 text-left">Triage {unprocessed.length} items with Copilot</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-secondary p-1">
        {(['inbox', 'notes'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${
              tab === t ? 'bg-card text-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'inbox' ? `Inbox (${unprocessed.length})` : 'Notes'}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'inbox' && (
        <div className="divide-y divide-border">
          {unprocessed.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Inbox zero — nice!
            </div>
          )}
          {unprocessed.map(item => (
            <div key={item.id} className="flex items-start gap-3 px-2 py-3">
              <Inbox className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm">{item.title || item.content}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(item.createdAt), 'MMM d, h:mm a')}</p>
              </div>
              <Button size="sm" variant="ghost" className="text-xs shrink-0 h-7" onClick={() => setInboxStatus(item.id, 'archived')}>
                Done
              </Button>
            </div>
          ))}
          {data.inboxItems.length > unprocessed.length && (
            <button onClick={() => navigate('/inbox')} className="text-sm text-primary hover:underline flex items-center gap-1 pt-3">
              Open full inbox <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="divide-y divide-border">
          {notes.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No notes yet
            </div>
          )}
          {notes.map(note => (
            <div key={note.id} className="flex items-start gap-3 px-2 py-3">
              <StickyNote className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{note.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{note.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
