
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Team, TeamWithChannels, Channel } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useTeams = () => {
  const [teams, setTeams] = useState<TeamWithChannels[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      setTeams([]);
      setLoading(false);
      return;
    }
    
    const fetchTeams = async () => {
      try {
        setLoading(true);
        
        // Fetch teams the user is a member of
        const { data: teamMembers, error: teamMembersError } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.id);
            
        if (teamMembersError) {
          throw teamMembersError;
        }
        
        if (!teamMembers || teamMembers.length === 0) {
          setTeams([]);
          setLoading(false);
          return;
        }
        
        const teamIds = teamMembers.map(tm => tm.team_id);
        
        // Fetch team details
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .in('id', teamIds);
            
        if (teamsError) {
          throw teamsError;
        }
        
        // For each team, fetch channels
        const teamsWithChannels = await Promise.all(teamsData.map(async (team) => {
          const { data: channels, error: channelsError } = await supabase
            .from('channels')
            .select('*')
            .eq('team_id', team.id);
              
          if (channelsError) {
            throw channelsError;
          }
          
          return {
            ...team,
            channels: channels as Channel[] || []
          };
        }));
        
        setTeams(teamsWithChannels);
        setLoading(false);
      } catch (error: any) {
        console.error('Error fetching teams:', error);
        toast({
          variant: "destructive",
          title: "Error loading teams",
          description: error.message || "Could not load your teams",
        });
        setLoading(false);
      }
    };
    
    fetchTeams();
    
    // Set up real-time subscription for teams changes
    const subscription = supabase
      .channel('teams_changes')
      .on('postgres_changes', 
        {
          event: '*', 
          schema: 'public', 
          table: 'teams',
        }, 
        () => {
          fetchTeams();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, toast]);

  const createTeam = async (name: string, description?: string) => {
    try {
      if (!user) throw new Error("User not authenticated");
      
      // Create new team
      const { data: newTeam, error: teamError } = await supabase
        .from('teams')
        .insert({ 
          name, 
          description,
          created_by: user.id
        })
        .select()
        .single();
          
      if (teamError) throw teamError;
      
      // Add user as team member and admin
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: newTeam.id,
          user_id: user.id,
          role: 'admin'
        });
          
      if (memberError) throw memberError;
      
      // Create default general channel
      const { error: channelError } = await supabase
        .from('channels')
        .insert({
          team_id: newTeam.id,
          name: 'general',
          description: 'General channel for the entire team',
          created_by: user.id
        });
          
      if (channelError) throw channelError;
      
      toast({
        title: "Team created successfully",
      });
      
      return newTeam.id;
    } catch (error: any) {
      console.error('Error creating team:', error);
      toast({
        variant: "destructive",
        title: "Error creating team",
        description: error.message || "Could not create team",
      });
      throw error;
    }
  };

  return { 
    teams, 
    loading, 
    createTeam 
  };
};
