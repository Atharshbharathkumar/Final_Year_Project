import React, { useCallback } from 'react';
import { GlassCard, Badge, Button, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import { Bell, Clock, CheckCheck } from 'lucide-react';
import { campusApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';

const toneStyles = {
  danger: 'bg-rose-500/5 border-rose-500/20',
  warning: 'bg-amber-500/5 border-amber-500/20',
  success: 'bg-emerald-500/5 border-emerald-500/20',
  info: 'bg-dark-bg border-dark-border',
};

const NotificationsPage = () => {
  const { addToast } = useToast();
  const fetchNotifications = useCallback(() => campusApi.notifications(), []);
  const { data: notifications, loading, error, refetch } = useApi(fetchNotifications, [], { initialData: [] });

  const list = notifications || [];
  const unread = list.filter(n => !n.read).length;

  const markAll = async () => {
    try {
      await campusApi.markAllRead();
      await refetch();
      addToast('All notifications marked as read.', 'success');
    } catch {
      addToast('Could not update notifications.', 'error');
    }
  };

  const markOne = async (id) => {
    try {
      await campusApi.markRead(id);
      await refetch();
    } catch {
      addToast('Could not update that notification.', 'error');
    }
  };

  if (loading) return <LoadingState label="Loading notifications…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 page-enter max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell size={24} className="text-brand-400" /> Notifications
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {unread > 0 ? `${unread} unread of ${list.length}` : `All ${list.length} read`}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="secondary" size="sm" onClick={markAll} className="inline-flex items-center gap-2">
            <CheckCheck size={14} /> Mark all read
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Bell} title="Nothing here yet" description="System and academic updates will appear here." />
      ) : (
        <div className="space-y-3">
          {list.map(n => (
            <GlassCard
              key={n.id}
              hover={false}
              padding="p-4"
              className={`${toneStyles[n.type] || toneStyles.info} ${!n.read ? 'ring-1 ring-brand-500/20' : 'opacity-80'} cursor-pointer transition-opacity`}
            >
              <div onClick={() => !n.read && markOne(n.id)} className="flex items-start gap-3">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${!n.read ? 'bg-brand-400' : 'bg-slate-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <p className="text-sm font-semibold text-white">{n.title}</p>
                    {!n.read && <Badge variant="brand">New</Badge>}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                    <Clock size={10} /> {n.time}
                  </p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;