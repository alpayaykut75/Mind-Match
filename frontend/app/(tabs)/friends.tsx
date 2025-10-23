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
import { friendAPI, gameAPI } from '../../utils/api';
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
      const [friendsRes, requestsRes] = await Promise.all([
        friendAPI.getFriends(),
        friendAPI.getRequests(),
      ]);
      setFriends(friendsRes.data);
      setRequests(requestsRes.data);
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
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.secondary]}
            style={styles.actionButtonGradient}
          >
            <Ionicons name="chatbubble" size={18} color={theme.colors.text} />
          </LinearGradient>
        </TouchableOpacity>
        
        {/* Play Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handlePlayGame(item)}
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
          data={[...requests, ...friends]}
          renderItem={(props) => {
            if (requests.includes(props.item)) {
              return renderRequest(props);
            }
            return renderFriend(props);
          }}
          keyExtractor={(item, index) => `${item.username}-${index}`}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No friends yet</Text>
          }
          ListHeaderComponent={
            requests.length > 0 ? (
              <Text style={styles.sectionTitle}>Friend Requests</Text>
            ) : null
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
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
});
