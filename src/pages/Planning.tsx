import { useState, useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { startOfWeek, endOfWeek, subWeeks, format, isWithinInterval } from 'date-fns';
import { CheckSquare, AlertTriangle, TrendingUp } from 'lucide-react';

export default function Planning() {
  const { data, addWeeklyPlan, updateWeeklyPlan } = useAppContext();
  const now = new Date();
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = subWeeks(thisWeekStart, 1);
  const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });

  // Last week summary
  const lastWeekTasks = data.tasks.filter(t => t.dueDate && isWithinInterval(new Date(t.dueDate), { start: lastWeekStart, end: lastWeekEnd }));
  const lastWeekCompleted = lastWeekTasks.filter(t => t.status === 'done');
  const lastWeekMissed = lastWeekTasks.filter(t => t.status !== 'done');

  // This week planning
  const thisWeekStr = format(thisWeekStart, 'yyyy-MM-dd');
  const existingPlan = data.weeklyPlans.find(p => p.weekStartDate === thisWeekStr);
  const [selectedIds, setSelectedIds] = useState<string[]>(existingPlan?.committedTaskIds ?? []);

  const uncommittedTasks = data.tasks.filter(t => t.status !== 'done');

  const savePlan = () => {
    if (existingPlan) {
      updateWeeklyPlan(existingPlan.id, { committedTaskIds: selectedIds });
    } else {
      addWeeklyPlan({ id: crypto.randomUUID(), weekStartDate: thisWeekStr, committedTaskIds: selectedIds, createdAt: new Date().toISOString() });
    }
  };

  const toggleTask = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Planning</h1>

      <Tabs defaultValue="weekly">
        <TabsList><TabsTrigger value="weekly">Weekly Review</TabsTrigger><TabsTrigger value="monthly">Monthly Goals</TabsTrigger></TabsList>

        <TabsContent value="weekly" className="space-y-6 mt-4">
          {/* Last week recap */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Last Week Recap</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{lastWeekTasks.length}</p>
                  <p className="text-xs text-muted-foreground">Total planned</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{lastWeekCompleted.length}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{lastWeekMissed.length}</p>
                  <p className="text-xs text-muted-foreground">Missed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plan this week */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Plan This Week</CardTitle>
                <Badge variant="secondary">{selectedIds.length} selected</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {uncommittedTasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks available. Create tasks first!</p>}
              {uncommittedTasks.map(task => (
                <label key={task.id} className="flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/30">
                  <Checkbox checked={selectedIds.includes(task.id)} onCheckedChange={() => toggleTask(task.id)} />
                  <div className="flex-1">
                    <p className="text-sm">{task.title}</p>
                    {task.dueDate && <p className="text-xs text-muted-foreground">Due {task.dueDate}</p>}
                  </div>
                  <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">{task.priority}</Badge>
                </label>
              ))}
              {uncommittedTasks.length > 0 && (
                <Button onClick={savePlan} className="w-full mt-4">Save Weekly Plan</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6 mt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Monthly Goals Focus</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.goals.filter(g => g.status === 'active').length === 0 && <p className="text-sm text-muted-foreground">No active goals. Create goals first!</p>}
              {data.goals.filter(g => g.status === 'active').map(goal => (
                <div key={goal.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{goal.title}</p>
                    <p className="text-xs text-muted-foreground">{goal.progressValue}% — Due {goal.targetDate}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{goal.category}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
