import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { useLocation } from 'react-router-dom';

interface PresenceUser {
  userId: string;
  name: string;
  route: string;
  timestamp: string;
}

interface PresenceState {
  [key: string]: PresenceUser[];
}

export const usePresence = (channelName: string = 'presence:governanca') => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const location = useLocation();
  const [presenceState, setPresenceState] = useState<PresenceState>({});
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    const userPresence: PresenceUser = {
      userId: user.id,
      name: profile?.nome_completo || user.email?.split('@')[0] || 'Usuário',
      route: location.pathname,
      timestamp: new Date().toISOString(),
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setPresenceState(state as PresenceState);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;

        const presenceTrackStatus = await channel.track(userPresence);
        setIsTracking(presenceTrackStatus === 'ok');
      });

    // Update presence when route changes
    const updatePresence = () => {
      const updatedPresence: PresenceUser = {
        ...userPresence,
        route: location.pathname,
        timestamp: new Date().toISOString(),
      };
      channel.track(updatedPresence);
    };

    updatePresence();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile, location.pathname, channelName]);

  // Get online users list
  const onlineUsers = Object.values(presenceState)
    .flat()
    .filter((user, index, self) => 
      index === self.findIndex(u => u.userId === user.userId)
    );

  return {
    onlineUsers,
    isTracking,
    totalOnline: onlineUsers.length,
  };
};