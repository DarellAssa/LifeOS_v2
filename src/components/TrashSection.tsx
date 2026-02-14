import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Trash2, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchTrashedItems,
  dbRestoreItem,
  dbHardDeleteItem,
  dbRestoreAll,
  dbEmptyTrash,
  TrashEntityType,
  TrashedItem,
} from '@/lib/db';
import { differenceInDays } from 'date-fns';

const ENTITY_TABS: { key: TrashEntityType; label: string }[] = [
  { key: 'tasks', label: 'Tasks' },
  { key: 'goals', label: 'Goals' },
  { key: 'calendar_events', label: 'Events' },
  { key: 'focus_blocks', label: 'Focus' },
  { key: 'habits', label: 'Habits' },
  { key: 'inbox_items', label: 'Inbox' },
  { key: 'notes', label: 'Notes' },
  { key: 'templates', label: 'Templates' },
  { key: 'automation_rules', label: 'Automations' },
];

export default function TrashSection() {
  const { user } = useAuth();
  const [items, setItems] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TrashEntityType>('tasks');
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete' | 'empty';
    item?: TrashedItem;
    table?: TrashEntityType;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const userId = user?.id;

  const loadItems = async () => {
    if (!userId) return;
    setLoading(true);
    const data = await fetchTrashedItems(userId);
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const itemsByType = useMemo(() => {
    const map: Record<TrashEntityType, TrashedItem[]> = {} as any;
    ENTITY_TABS.forEach(t => { map[t.key] = []; });
    items.forEach(item => {
      if (map[item.entityType]) map[item.entityType].push(item);
    });
    return map;
  }, [items]);

  const currentItems = itemsByType[activeTab] || [];
  const totalTrashed = items.length;

  const handleRestore = async (item: TrashedItem) => {
    if (!userId) return;
    setActionLoading(true);
    await dbRestoreItem(userId, item.entityType, item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
    toast({ title: 'Restored', description: `"${item.title}" has been restored.` });
    setActionLoading(false);
  };

  const handlePermanentDelete = async () => {
    if (!userId || !confirmAction?.item) return;
    setActionLoading(true);
    const item = confirmAction.item;
    await dbHardDeleteItem(userId, item.entityType, item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
    toast({ title: 'Permanently deleted', description: `"${item.title}" has been removed forever.` });
    setConfirmAction(null);
    setActionLoading(false);
  };

  const handleRestoreAll = async () => {
    if (!userId) return;
    setActionLoading(true);
    await dbRestoreAll(userId, activeTab);
    setItems(prev => prev.filter(i => i.entityType !== activeTab));
    const label = ENTITY_TABS.find(t => t.key === activeTab)?.label || activeTab;
    toast({ title: 'All restored', description: `All trashed ${label.toLowerCase()} have been restored.` });
    setActionLoading(false);
  };

  const handleEmptyTrash = async () => {
    if (!userId) return;
    setActionLoading(true);
    await dbEmptyTrash(userId, activeTab);
    setItems(prev => prev.filter(i => i.entityType !== activeTab));
    const label = ENTITY_TABS.find(t => t.key === activeTab)?.label || activeTab;
    toast({ title: 'Trash emptied', description: `All trashed ${label.toLowerCase()} have been permanently deleted.` });
    setConfirmAction(null);
    setActionLoading(false);
  };

  const daysAgo = (dateStr: string) => {
    const d = differenceInDays(new Date(), new Date(dateStr));
    if (d === 0) return 'today';
    if (d === 1) return '1 day ago';
    return `${d} days ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            {totalTrashed} item{totalTrashed !== 1 ? 's' : ''} in trash
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TrashEntityType)}>
        <TabsList className="flex-wrap h-auto gap-1">
          {ENTITY_TABS.map(tab => {
            const count = itemsByType[tab.key]?.length || 0;
            return (
              <TabsTrigger key={tab.key} value={tab.key} className="text-xs">
                {tab.label}
                {count > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 min-w-[16px] px-1">
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {ENTITY_TABS.map(tab => (
          <TabsContent key={tab.key} value={tab.key} className="mt-4 space-y-3">
            {currentItems.length > 0 && (
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={handleRestoreAll}
                  disabled={actionLoading}
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Restore all
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 text-destructive hover:text-destructive"
                  onClick={() => setConfirmAction({ type: 'empty', table: activeTab })}
                  disabled={actionLoading}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Empty trash
                </Button>
              </div>
            )}

            {currentItems.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">No deleted {tab.label.toLowerCase()} items.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {currentItems.map(item => (
                  <Card key={item.id}>
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Deleted {daysAgo(item.deletedAt)}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => handleRestore(item)}
                          disabled={actionLoading}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" /> Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 text-destructive hover:text-destructive"
                          onClick={() => setConfirmAction({ type: 'delete', item })}
                          disabled={actionLoading}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <p className="text-[10px] text-muted-foreground text-center">
        Items in trash will be auto-cleaned after 30 days (coming soon).
      </p>

      {/* Confirmation dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {confirmAction?.type === 'delete' ? 'Permanently delete?' : 'Empty trash?'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.type === 'delete'
                ? `"${confirmAction.item?.title}" will be permanently deleted. This cannot be undone.`
                : `All trashed ${ENTITY_TABS.find(t => t.key === confirmAction?.table)?.label.toLowerCase() || ''} items will be permanently deleted. This cannot be undone.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={() => setConfirmAction(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmAction?.type === 'delete' ? handlePermanentDelete : handleEmptyTrash}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {confirmAction?.type === 'delete' ? 'Delete forever' : 'Empty trash'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
