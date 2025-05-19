import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RealtimeChannel } from "@supabase/supabase-js";
import * as Popover from "@radix-ui/react-popover";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  user_id: string;
  channel: string;
  notification_type: string;
  title: string;
  body?: string;
  payload: Record<string, unknown>;
  is_read: boolean;
  priority: "low" | "normal" | "high" | "critical";
  delivered_at: string;
  status: string;
  created_at: string;
}

export const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unreadCount = notifications.length;

  useEffect(() => {
    if (!user) return;

    // Fetch initial unread notifications
    try {
      supabase
        .from("notification_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20)
        .then(({ data, error }) => {
          if (error) {
            console.error("Error fetching notifications:", error);
            return;
          }
          setNotifications(data || []);
        });
    } catch (err) {
      console.error("Exception fetching notifications:", err);
    }

    // Subscribe to new notifications - using current Supabase Realtime API
    const channel = supabase
      .channel(`notification_logs:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_logs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Nova notificação recebida:', payload);
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleMarkRead = async (id: string) => {
    const { error } = await supabase.rpc("mark_notification_read", {
      p_notification_id: id,
    });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="relative p-2">
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Content side="bottom" align="end" className="w-80 p-2 bg-white shadow-lg rounded">
        <h4 className="px-2 py-1 text-sm font-semibold">Notifications</h4>
        <div className="max-h-64 overflow-y-auto">
          {notifications.length === 0 && (
            <div className="p-2 text-sm text-gray-500">No new notifications</div>
          )}
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleMarkRead(notif.id)}
              className={cn(
                "p-2 mb-1 rounded cursor-pointer hover:bg-gray-100",
                notif.priority === "critical" && "border-l-4 border-red-500"
              )}
            >
              <div className="flex justify-between">
                <span className="font-medium text-sm">{notif.title}</span>
                <span className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                </span>
              </div>
              {notif.body && <div className="text-sm text-gray-600">{notif.body}</div>}
            </div>
          ))}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};

export default NotificationCenter;

