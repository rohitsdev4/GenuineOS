'use client';

import { useState, useMemo } from 'react';
import { CalendarIcon, Clock, CheckCircle2, Circle, AlertTriangle, XCircle } from 'lucide-react';
import { useFetchData } from '@/hooks/use-data';
import { formatDate, priorityColors, statusColors } from '@/lib/helpers';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';

interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  dueTime?: string;
  siteId?: string;
  createdAt: string;
}

export default function CalendarTab() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const { data: tasksData, isLoading } = useFetchData({ model: 'task' });
  const tasks: TaskItem[] = tasksData?.data || [];

  // Local date string (no UTC conversion — avoids timezone offset bugs)
  const toLocalDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Map dates with tasks for dot indicators
  const taskDates = useMemo(() => {
    const dates: Set<string> = new Set();
    tasks.forEach((t: TaskItem) => {
      if (t.dueDate) {
        const d = new Date(t.dueDate);
        if (!isNaN(d.getTime())) {
          dates.add(toLocalDateStr(d));
        }
      }
    });
    return dates;
  }, [tasks]);

  // Filter tasks for selected date
  const selectedDateTasks = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = toLocalDateStr(selectedDate);

    return tasks.filter((t: TaskItem) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      if (isNaN(d.getTime())) return false;
      return toLocalDateStr(d) === dateStr;
    });
  }, [tasks, selectedDate]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      case 'in-progress':
        return <Clock className="w-4 h-4 text-purple-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'low':
        return <Badge variant="outline" className={`${priorityColors[priority]} text-[10px] h-5 px-1.5 capitalize`}>Low</Badge>;
      case 'medium':
        return <Badge variant="outline" className={`${priorityColors[priority]} text-[10px] h-5 px-1.5 capitalize`}>Medium</Badge>;
      case 'high':
        return <Badge variant="outline" className={`${priorityColors[priority]} text-[10px] h-5 px-1.5 capitalize`}>High</Badge>;
      case 'urgent':
        return <Badge variant="outline" className={`${priorityColors[priority]} text-[10px] h-5 px-1.5 capitalize flex items-center gap-0.5`}>
          <AlertTriangle className="w-3 h-3" />
          Urgent
        </Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] h-5 px-1.5 capitalize">{priority}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Calendar</h2>
        <p className="text-sm text-muted-foreground">View tasks by date and manage your schedule</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Calendar */}
        <Card className="p-4 md:w-fit flex-shrink-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="w-fit"
            modifiers={{
              hasTasks: (date: Date) => {
                const dateStr = toLocalDateStr(date);
                return taskDates.has(dateStr);
              },
            }}
            modifiersClassNames={{
              hasTasks: 'has-tasks',
            }}
          />
          <style jsx global>{`
            .has-tasks button::after {
              content: '';
              position: absolute;
              bottom: 2px;
              left: 50%;
              transform: translateX(-50%);
              width: 4px;
              height: 4px;
              border-radius: 50%;
              background-color: #10b981;
            }
          `}</style>
        </Card>

        {/* Task list for selected date */}
        <Card className="flex-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {selectedDate
                ? `Tasks for ${formatDate(selectedDate, 'DD MMM YYYY')}`
                : 'Select a date'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !selectedDate ? (
              <EmptyState
                icon={CalendarIcon}
                title="Select a date"
                description="Click on a date to see tasks scheduled for that day."
              />
            ) : selectedDateTasks.length === 0 ? (
              <EmptyState
                icon={CalendarIcon}
                title="No tasks for this date"
                description="There are no tasks scheduled for this date."
              />
            ) : (
              <ScrollArea className="max-h-96">
                <div className="space-y-2">
                  {selectedDateTasks.map((task: TaskItem) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {getStatusIcon(task.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </p>
                          {task.dueTime && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 flex-shrink-0">
                              <Clock className="w-3 h-3" />
                              {task.dueTime}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {getPriorityLabel(task.priority)}
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-5 px-1.5 capitalize ${statusColors[task.status] || ''}`}
                          >
                            {task.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
