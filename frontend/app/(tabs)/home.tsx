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

export default function HomeScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const router = useRouter();
  const { username } = useAuth();

  useEffect(() => {
    loadUsers();
    const interval = setInterval(loadUsers, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadUsers = async () => {
    try {
      const response = await userAPI.getOnlineUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to load users', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const handlePlayPress = (user: User) => {
    setSelectedUser(user);
    setModalVisible(true);
  };

  const startGame = async (mode: 'friend' | 'ai' | 'random') => {
    try {
      const response = await gameAPI.createGame({
        mode,
        opponent_username: mode === 'friend' ? selectedUser?.username : undefined,
      });
      setModalVisible(false);
      router.push(`/game/${response.data.game_id}`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to start game');
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
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.secondary]}
            style={styles.avatar}
          >
            <Ionicons name="person" size={32} color={theme.colors.text} />
          </LinearGradient>
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
              <Text style={styles.modalTitle}>Play with {selectedUser?.username}?</Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => startGame('friend')}
              >
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.secondary]}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Start Game</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
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
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  modalButton: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  modalButtonGradient: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  modalButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalCancelButton: {
    padding: theme.spacing.md,
  },
  modalCancelText: {
    color: theme.colors.textSecondary,
  },
});
