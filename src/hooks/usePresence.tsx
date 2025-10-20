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
        console.log('🔄 [PRESENCE] Raw presence state:', state);
        console.log('🔄 [PRESENCE] Total keys in state:', Object.keys(state).length);
        
        const transformedState: PresenceState = {};
        
        Object.entries(state).forEach(([userId, presences]) => {
          console.log(`👤 [PRESENCE] Processing user ${userId}:`, presences);
          
          if (Array.isArray(presences) && presences.length > 0) {
            const presence = presences[0] as any;
            transformedState[userId] = [{
              userId,
              name: presence.name || 'Usuário',
              route: presence.route || '/',
              timestamp: presence.timestamp || new Date().toISOString()
            }];
          }
        });
        
        console.log('✅ [PRESENCE] Transformed state:', transformedState);
        console.log('✅ [PRESENCE] Total users online:', Object.keys(transformedState).length);
        setPresenceState(transformedState);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('👋 [PRESENCE] User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('👋 [PRESENCE] User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        console.log('📡 [PRESENCE] Channel status:', status);
        
        if (status !== 'SUBSCRIBED') {
          console.warn('⚠️ [PRESENCE] Channel not subscribed, status:', status);
          return;
        }

        const presenceTrackStatus = await channel.track(userPresence);
        console.log('✅ [PRESENCE] Track status:', presenceTrackStatus, 'for user:', userPresence);
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
      console.log('🧹 [PRESENCE] Cleaning up channel:', channelName);
      supabase.removeChannel(channel);
    };
  }, [user, profile?.nome_completo, location.pathname, channelName]);

  // Get online users list
  const onlineUsers = Object.values(presenceState)
    .flat()
    .filter((user, index, self) => 
      index === self.findIndex(u => u.userId === user.userId)
    );

  console.log('📊 [PRESENCE] Final calculation:', {
    presenceStateKeys: Object.keys(presenceState).length,
    onlineUsersBeforeFilter: Object.values(presenceState).flat().length,
    onlineUsersAfterFilter: onlineUsers.length,
    usersList: onlineUsers.map(u => ({ id: u.userId, name: u.name, route: u.route }))
  });

  return {
    onlineUsers,
    isTracking,
    totalOnline: onlineUsers.length,
  };
};