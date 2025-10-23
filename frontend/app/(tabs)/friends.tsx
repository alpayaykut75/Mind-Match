import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { friendAPI } from '../../utils/api';
import Avatar from '../../components/Avatar';

interface Friend {
  username: string;
  bio: string;
  avatar: string;
  level: number;
  online: boolean;
}

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
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

  const renderFriend = ({ item }: { item: Friend }) => (
    <View style={styles.card}>
      <View style={styles.friendInfo}>
        <View style={styles.avatarContainer}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.secondary]}
            style={styles.avatar}
          >
            <Ionicons name="person" size={24} color={theme.colors.text} />
          </LinearGradient>
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
    </View>
  );

  const renderRequest = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.friendInfo}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.secondary]}
          style={styles.avatar}
        >
          <Ionicons name="person" size={24} color={theme.colors.text} />
        </LinearGradient>
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
