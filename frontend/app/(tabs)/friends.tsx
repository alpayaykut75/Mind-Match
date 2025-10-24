import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';
import { friendAPI, gameAPI, chatAPI } from '../../utils/api';
import Avatar from '../../components/Avatar';

interface Friend {
  username: string;
  bio: string;
  avatar: string;
  level: number;
  online: boolean;
}

interface GameInvite {
  invite_id: string;
  from_username: string;
  to_username: string;
  status: string;
  created_at: string;
  from_user_avatar?: string;
  from_user_level?: number;
}

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [gameInvites, setGameInvites] = useState<GameInvite[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadData();
    // Her 5 saniyede bir yenile (friend request kabul edilince hemen görünsün)
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [friendsRes, requestsRes, invitesRes, unreadRes] = await Promise.all([
        friendAPI.getFriends(),
        friendAPI.getRequests(),
        gameAPI.getGameInvites(),
        chatAPI.getUnreadByUser(),
      ]);
      setFriends(friendsRes.data);
      setRequests(requestsRes.data);
      setGameInvites(invitesRes.data);
      setUnreadMessages(unreadRes.data);
    } catch (error) {
      console.error('Failed to load friends', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const acceptRequest = async (username: string) => {
    try {
      await friendAPI.acceptRequest(username);
      await loadData();
    } catch (error) {
      console.error('Failed to accept request', error);
    }
  };

  const handleSendGameInvite = async (friend: Friend) => {
    try {
      await gameAPI.sendGameInvite(friend.username);
      Alert.alert('Success', `Game invite sent to ${friend.username}`);
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send game invite');
    }
  };

  const handleAcceptInvite = async (invite: GameInvite) => {
    try {
      const response = await gameAPI.acceptGameInvite(invite.invite_id);
      Alert.alert('Success', 'Game invite accepted!');
      router.push(`/game/${response.data.game_id}`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to accept invite');
      await loadData();
    }
  };

  const handleDeclineInvite = async (invite: GameInvite) => {
    try {
      await gameAPI.declineGameInvite(invite.invite_id);
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to decline invite');
    }
  };

  const handlePlayGame = async (friend: Friend) => {
    try {
      const response = await gameAPI.createGame('friend', friend.username);
      router.push(`/game/${response.data.game_id}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to start game');
    }
  };

  const handleChat = (friend: Friend) => {
    router.push(`/chat/${friend.username}`);
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <View style={styles.card}>
      <View style={styles.friendInfo}>
        <View style={styles.avatarContainer}>
          <Avatar avatar={item.avatar} size={50} />
          {item.online && <View style={styles.onlineIndicator} />}
        </View>
        <View style={styles.details}>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.bio} numberOfLines={1}>
            {item.bio || 'No bio'}
          </Text>
          <Text style={styles.level}>Level {item.level}</Text>
        </View>
      </View>
      
      <View style={styles.actionButtons}>
        {/* Chat Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleChat(item)}
        >
          <View style={{ position: 'relative' }}>
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.secondary]}
              style={styles.actionButtonGradient}
            >
              <Ionicons name="chatbubble" size={18} color={theme.colors.text} />
            </LinearGradient>
            {unreadMessages[item.username] > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>
                  {unreadMessages[item.username]}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        
        {/* Invite to Play Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleSendGameInvite(item)}
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.secondary]}
            style={styles.actionButtonGradient}
          >
            <Ionicons name="game-controller" size={18} color={theme.colors.text} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRequest = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.friendInfo}>
        <Avatar avatar={item.avatar} size={50} />
        <View style={styles.details}>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.bio} numberOfLines={1}>
            {item.bio || 'No bio'}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.acceptButton}
        onPress={() => acceptRequest(item.username)}
      >
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.secondary]}
          style={styles.acceptButtonGradient}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderGameInvite = ({ item }: { item: GameInvite }) => (
    <View style={styles.card}>
      <View style={styles.friendInfo}>
        <Avatar avatar={item.from_user_avatar || '🎮'} size={50} />
        <View style={styles.details}>
          <Text style={styles.username}>{item.from_username}</Text>
          <Text style={styles.inviteText}>wants to play with you!</Text>
          {item.from_user_level && (
            <Text style={styles.level}>Level {item.from_user_level}</Text>
          )}
        </View>
      </View>
      <View style={styles.inviteButtons}>
        <TouchableOpacity
          style={styles.declineButton}
          onPress={() => handleDeclineInvite(item)}
        >
          <Ionicons name="close-circle" size={32} color="#ff6b6b" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptInviteButton}
          onPress={() => handleAcceptInvite(item)}
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.secondary]}
            style={styles.acceptInviteGradient}
          >
            <Ionicons name="checkmark-circle" size={32} color={theme.colors.text} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.cardBg]}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Friends</Text>
        </View>

        <FlatList
          data={[...gameInvites, ...requests, ...friends]}
          renderItem={(props) => {
            if (gameInvites.includes(props.item)) {
              return renderGameInvite(props);
            }
            if (requests.includes(props.item)) {
              return renderRequest(props);
            }
            return renderFriend(props);
          }}
          keyExtractor={(item, index) => {
            if ('invite_id' in item) return `invite-${item.invite_id}`;
            if ('username' in item) return `${item.username}-${index}`;
            return `item-${index}`;
          }}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No friends yet</Text>
          }
          ListHeaderComponent={
            <>
              {gameInvites.length > 0 && (
                <Text style={styles.sectionTitle}>🎮 Game Invites</Text>
              )}
              {gameInvites.length === 0 && requests.length > 0 && (
                <Text style={styles.sectionTitle}>Friend Requests</Text>
              )}
            </>
          }
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  gradient: {
    flex: 1,
  },
  header: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.online,
    borderWidth: 2,
    borderColor: theme.colors.cardBg,
  },
  details: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  bio: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  level: {
    fontSize: 12,
    color: theme.colors.primary,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginLeft: theme.spacing.md,
  },
  actionButton: {
    // Button container
  },
  actionButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  chatBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  acceptButton: {
    marginLeft: theme.spacing.md,
  },
  acceptButtonGradient: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  acceptButtonText: {
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  inviteText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  inviteButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginLeft: theme.spacing.md,
    alignItems: 'center',
  },
  declineButton: {
    // Button container for decline
  },
  acceptInviteButton: {
    // Button container for accept
  },
  acceptInviteGradient: {
    borderRadius: 16,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
});
