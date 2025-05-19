import React, { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import * as Accordion from "@radix-ui/react-accordion";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as Select from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { User } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

type NotifyTypes = Record<string, boolean>;

interface ChannelPref {
  channel_id: string;
  channel_name: string;
  frequency: "instant" | "daily" | "weekly";
  notify_types: NotifyTypes;
  is_enabled: boolean;
}

interface FormValues {
  channels: ChannelPref[];
}

export const NotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { channels: [] },
  });

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notification-prefs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc<
        Database['public']['Functions']['get_user_notification_prefs']['Returns'][],
        { p_user_id: string }
      >("get_user_notification_prefs", { p_user_id: user!.id });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (prefs) {
      reset({ channels: prefs || [] });
    }
  }, [prefs, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    try {
      for (const ch of values.channels) {
        const settings = {
          frequency: ch.frequency,
          notify_types: ch.notify_types,
          is_enabled: ch.is_enabled,
        };
        const { error } = await supabase.rpc<
          string,
          {
            p_user_id: string;
            p_channel_id: string;
            p_settings: {
              frequency: "instant" | "daily" | "weekly";
              notify_types: NotifyTypes;
              is_enabled: boolean;
            };
          }
        >("upsert_notification_pref", {
          p_user_id: user.id,
          p_channel_id: ch.channel_id,
          p_settings: settings,
        });
        if (error) throw error;
      }
      toast({ title: "Preferences saved." });
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error saving preferences", description: err.message });
    }
  };

  if (isLoading) {
    return <div>Loading notification settings...</div>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Accordion.Root type="single" collapsible>
        {(Array.isArray(prefs) ? prefs : [])?.map((pref, idx) => (
          <Accordion.Item key={pref.channel_id} value={pref.channel_id} className="border rounded-lg">
            <Accordion.Header>
              <Accordion.Trigger className="flex justify-between w-full p-4 font-medium">
                {pref.channel_name}
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="p-4 space-y-3">
              <Controller
                control={control}
                name={`channels.${idx}.is_enabled`}
                render={({ field }) => (
                  <div className="flex items-center space-x-2">
                    <SwitchPrimitive.Root
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className={cn(
                        "w-9 h-5 bg-gray-200 rounded-full relative",
                        field.value && "bg-indigo-600"
                      )}
                    >
                      <SwitchPrimitive.Thumb className="block w-4 h-4 bg-white rounded-full m-0.5 transition" />
                    </SwitchPrimitive.Root>
                    <span>Enabled</span>
                  </div>
                )}
              />
              <div>
                <label className="block mb-1">Frequency</label>
                <Controller
                  control={control}
                  name={`channels.${idx}.frequency`}
                  render={({ field }) => (
                    <Select.Root value={field.value} onValueChange={field.onChange}>
                      <Select.Trigger className="border rounded px-2 py-1">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content className="bg-white border rounded mt-1">
                        {["instant", "daily", "weekly"].map((freq) => (
                          <Select.Item key={freq} value={freq}>
                            <Select.ItemText>{freq}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  )}
                />
              </div>
              <div>
                <span className="block mb-1">Notification Types</span>
                <div className="space-y-1">
                  {Object.keys(pref.notify_types).map((key) => (
                    <Controller
                      key={key}
                      control={control}
                      name={`channels.${idx}.notify_types.${key}`}
                      render={({ field }) => (
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                            className="form-checkbox"
                          />
                          <span>{key}</span>
                        </label>
                      )}
                    />
                  ))}
                </div>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
      <button
        type="submit"
        className="px-4 py-2 bg-indigo-600 text-white rounded-md"
      >
        Save Preferences
      </button>
    </form>
  );
};

export default NotificationSettings;

