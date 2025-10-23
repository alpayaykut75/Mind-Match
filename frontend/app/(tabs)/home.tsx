import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';
import { userAPI, gameAPI, friendAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import Avatar from '../../components/Avatar';

interface User {
  username: string;
  bio: string;
  age?: number;
  country: string;
  avatar: string;
  level: number;
  connection_score: number;
  is_friend: boolean;
  online: boolean;
}

interface ActiveGame {
  game_id: string;
  opponent: string;
  opponent_avatar: string;
  mode: string;
  status: string;
  current_round: number;
  created_at: string;
}

export default function HomeScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const router = useRouter();
  const { username } = useAuth();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, gamesRes] = await Promise.all([
        userAPI.getOnlineUsers(),
        gameAPI.getActiveGames(),
      ]);
      setUsers(usersRes.data);
      setActiveGames(gamesRes.data);
    } catch (error) {
      console.error('Failed to load data', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handlePlayPress = (user: User) => {
    setSelectedUser(user);
    setModalVisible(true);
  };

  const startGame = async (mode: 'friend' | 'ai' | 'random') => {
    try {
      const opponentUsername = mode === 'friend' ? selectedUser?.username : undefined;
      const response = await gameAPI.createGame(mode, opponentUsername);
      setModalVisible(false);
      router.push(`/game/${response.data.game_id}`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to start game');
    }
  };

  const sendFriendRequest = async () => {
    if (!selectedUser) return;
    
    try {
      await friendAPI.sendRequest(selectedUser.username);
      Alert.alert('Success', `Friend request sent to ${selectedUser.username}!`);
      setModalVisible(false);
      await loadUsers(); // Refresh to update friend status
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send friend request');
    }
  };

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderUserCard = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => handlePlayPress(item)}
    >
      <View style={styles.userInfo}>
        <View style={styles.avatarContainer}>
          <Avatar avatar={item.avatar} size={60} />
          {item.online && <View style={styles.onlineIndicator} />}
        </View>
        <View style={styles.userDetails}>
          <View style={styles.userHeader}>
            <Text style={styles.username}>{item.username}</Text>
            {item.is_friend && (
              <Ionicons name="star" size={16} color={theme.colors.secondary} />
            )}
          </View>
          <Text style={styles.bio} numberOfLines={1}>
            {item.bio || 'No bio yet'}
          </Text>
          <View style={styles.stats}>
            <Text style={styles.statText}>Lv {item.level}</Text>
            <Text style={styles.statText}>•</Text>
            <Text style={styles.statText}>{item.connection_score}% sync</Text>
            {item.country && (
              <>
                <Text style={styles.statText}>•</Text>
                <Text style={styles.statText}>{item.country}</Text>
              </>
            )}
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={styles.playButton}
        onPress={() => handlePlayPress(item)}
      >
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.secondary]}
          style={styles.playButtonGradient}
        >
          <Ionicons name="play" size={20} color={theme.colors.text} />
        </LinearGradient>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderActiveGame = ({ item }: { item: ActiveGame }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/game/${item.game_id}`)}
    >
      <View style={styles.userInfo}>
        <Avatar avatar={item.opponent_avatar} size={50} />
        <View style={styles.details}>
          <Text style={styles.username}>{item.opponent}</Text>
          <Text style={styles.bio}>Round {item.current_round} • {item.mode}</Text>
        </View>
      </View>
      <View style={styles.continueButton}>
        <LinearGradient
          colors={['#4CAF50', '#45A049']}
          style={styles.continueButtonGradient}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.cardBg]}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.title}>MindMatch</Text>
          <Text style={styles.subtitle}>Find your wavelength</Text>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => startGame('ai')}
          >
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.secondary]}
              style={styles.quickActionGradient}
            >
              <Ionicons name="cube" size={24} color={theme.colors.text} />
              <Text style={styles.quickActionText}>Play AI</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => startGame('random')}
          >
            <LinearGradient
              colors={[theme.colors.secondary, theme.colors.primary]}
              style={styles.quickActionGradient}
            >
              <Ionicons name="shuffle" size={24} color={theme.colors.text} />
              <Text style={styles.quickActionText}>Random</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {activeGames.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>🎮 Active Games</Text>
            <FlatList
              data={activeGames}
              renderItem={renderActiveGame}
              keyExtractor={(item) => item.game_id}
              contentContainerStyle={styles.activeGamesList}
              horizontal={false}
              scrollEnabled={false}
            />
          </>
        )}

        <Text style={styles.sectionTitle}>Online Players</Text>

        <FlatList
          data={filteredUsers}
          renderItem={renderUserCard}
          keyExtractor={(item) => item.username}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No online players found</Text>
          }
        />

        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Avatar avatar={selectedUser?.avatar} size={80} />
              
              <Text style={styles.modalUsername}>{selectedUser?.username}</Text>
              <Text style={styles.modalBio}>{selectedUser?.bio || 'No bio'}</Text>
              
              <View style={styles.modalStats}>
                <View style={styles.modalStat}>
                  <Text style={styles.modalStatValue}>Lv {selectedUser?.level}</Text>
                  <Text style={styles.modalStatLabel}>Level</Text>
                </View>
                <View style={styles.modalStat}>
                  <Text style={styles.modalStatValue}>{selectedUser?.connection_score}%</Text>
                  <Text style={styles.modalStatLabel}>Sync Rate</Text>
                </View>
              </View>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={styles.modalButtonFlex}
                  onPress={() => startGame('friend')}
                >
                  <LinearGradient
                    colors={[theme.colors.primary, theme.colors.secondary]}
                    style={styles.modalButtonGradient}
                  >
                    <Ionicons name="game-controller" size={20} color={theme.colors.text} />
                    <Text style={styles.modalButtonText}>Play</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {selectedUser?.is_friend && (
                  <TouchableOpacity
                    style={styles.modalButtonFlex}
                    onPress={() => {
                      setModalVisible(false);
                      router.push(`/chat/${selectedUser.username}`);
                    }}
                  >
                    <LinearGradient
                      colors={[theme.colors.secondary, theme.colors.primary]}
                      style={styles.modalButtonGradient}
                    >
                      <Ionicons name="chatbubble" size={20} color={theme.colors.text} />
                      <Text style={styles.modalButtonText}>Chat</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>

              {!selectedUser?.is_friend && (
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={sendFriendRequest}
                >
                  <LinearGradient
                    colors={[theme.colors.secondary, theme.colors.primary]}
                    style={styles.modalButtonGradient}
                  >
                    <Ionicons name="person-add" size={20} color={theme.colors.text} />
                    <Text style={styles.modalButtonText}>Add Friend</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBg,
    marginHorizontal: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 16,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  quickActionButton: {
    flex: 1,
  },
  quickActionGradient: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  quickActionText: {
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  userCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.online,
    borderWidth: 2,
    borderColor: theme.colors.cardBg,
  },
  userDetails: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  bio: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  statText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  playButton: {
    marginLeft: theme.spacing.md,
  },
  playButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '85%',
    alignItems: 'center',
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalUsername: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  modalBio: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  modalStats: {
    flexDirection: 'row',
    gap: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  modalStat: {
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  modalStatLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  modalButtonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  modalButtonFlex: {
    flex: 1,
  },
  modalButton: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  modalButtonGradient: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  modalButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalCancelButton: {
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  modalCancelText: {
    color: theme.colors.textSecondary,
  },
});
