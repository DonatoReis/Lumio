
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Channel, ChannelWithMembers, ChannelMember, Profile } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useChannels = (teamId: string | null) => {
  const [channels, setChannels] = useState<ChannelWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !teamId) {
      setChannels([]);
      setLoading(false);
      return;
    }
    
    const fetchChannels = async () => {
      try {
        setLoading(true);
        
        // Fetch channels for the team
        const { data: channelsData, error: channelsError } = await supabase
          .from('channels')
          .select('*')
          .eq('team_id', teamId);
            
        if (channelsError) {
          throw channelsError;
        }
        
        if (!channelsData || channelsData.length === 0) {
          setChannels([]);
          setLoading(false);
          return;
        }
        
        // For each channel, fetch members
        const channelsWithMembers = await Promise.all(channelsData.map(async (channel) => {
          // Fetch channel members
          const { data: membersData, error: membersError } = await supabase
            .from('channel_members')
            .select('*')
            .eq('channel_id', channel.id);
              
          if (membersError) {
            throw membersError;
          }
          
          let memberProfiles: Profile[] = [];
          if (membersData && membersData.length > 0) {
            const memberIds = membersData.map(m => m.user_id);
            
            // Fetch profiles of members
            const { data: profilesData, error: profilesError } = await supabase
              .from('profiles')
              .select('*')
              .in('id', memberIds);
                
            if (profilesError) {
              throw profilesError;
            }
            
            memberProfiles = profilesData || [];
          }
          
          // Combine member data with profiles
          const membersWithProfiles = (membersData || []).map(member => {
            const profile = memberProfiles.find(p => p.id === member.user_id);
            return { ...member, profile } as ChannelMember & { profile: Profile };
          });
          
          return {
            ...channel,
            members: membersWithProfiles
          } as ChannelWithMembers;
        }));
        
        setChannels(channelsWithMembers);
        setLoading(false);
      } catch (error: any) {
        console.error('Error fetching channels:', error);
        toast({
          variant: "destructive",
          title: "Error loading channels",
          description: error.message || "Could not load channels",
        });
        setLoading(false);
      }
    };
    
    fetchChannels();
    
    // Set up real-time subscription for channel changes
    const subscription = supabase
      .channel('channels_changes')
      .on('postgres_changes', 
        {
          event: '*', 
          schema: 'public', 
          table: 'channels',
          filter: `team_id=eq.${teamId}`
        }, 
        () => {
          fetchChannels();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, teamId, toast]);

  const createChannel = async (name: string, description?: string) => {
    try {
      if (!user || !teamId) throw new Error("Invalid data");
      
      // Create new channel
      const { data: newChannel, error: channelError } = await supabase
        .from('channels')
        .insert({ 
          team_id: teamId,
          name, 
          description,
          created_by: user.id
        })
        .select()
        .single();
          
      if (channelError) throw channelError;
      
      toast({
        title: "Channel created successfully",
      });
      
      return newChannel.id;
    } catch (error: any) {
      console.error('Error creating channel:', error);
      toast({
        variant: "destructive",
        title: "Error creating channel",
        description: error.message || "Could not create channel",
      });
      throw error;
    }
  };

  return { 
    channels, 
    loading, 
    createChannel 
  };
};
