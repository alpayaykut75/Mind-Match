import { Tabs } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import Avatar from '../../components/Avatar';
import { userAPI, friendAPI, gameAPI, chatAPI } from '../../utils/api';

export default function TabsLayout() {
  const [userAvatar, setUserAvatar] = useState<string>('');
  const [hasFriendsBadge, setHasFriendsBadge] = useState(false);

  useEffect(() => {
    loadUserAvatar();
    loadBadgeStatus();
    
    // Refresh badge every 5 seconds
    const interval = setInterval(loadBadgeStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadUserAvatar = async () => {
    try {
      const response = await userAPI.getMe();
      setUserAvatar(response.data.avatar || '');
    } catch (error) {
      console.log('Failed to load user avatar for tab');
    }
  };

  const loadBadgeStatus = async () => {
    try {
      const [friendRequestsRes, gameInvitesRes, unreadCountRes] = await Promise.all([
        friendAPI.getRequests(),
        gameAPI.getGameInvites(),
        chatAPI.getUnreadCount(),
      ]);

      const hasBadge = 
        friendRequestsRes.data.length > 0 || 
        gameInvitesRes.data.length > 0 || 
        unreadCountRes.data.unread_count > 0;

      setHasFriendsBadge(hasBadge);
    } catch (error) {
      console.log('Failed to load badge status');
    }
  };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.cardBg,
          borderTopColor: theme.colors.primary,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <View style={{ 
              width: 28, 
              height: 28, 
              borderRadius: 14, 
              overflow: 'hidden',
              borderWidth: focused ? 2 : 0,
              borderColor: theme.colors.primary,
            }}>
              <Avatar avatar={userAvatar} size={28} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
