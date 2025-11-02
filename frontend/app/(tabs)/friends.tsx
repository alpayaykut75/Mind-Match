import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
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
  age?: number;
  country?: string;
  connection_score?: number;
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

interface ActiveGame {
  game_id: string;
  opponent: string;
  opponent_avatar: string;
  mode: string;
  status: string;
  current_round: number;
  created_at: string;
}

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [gameInvites, setGameInvites] = useState<GameInvite[]>([]);
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    loadData();
    // Her 5 saniyede bir yenile (friend request kabul edilince hemen görünsün)
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [friendsRes, requestsRes, invitesRes, gamesRes, unreadRes] = await Promise.all([
        friendAPI.getFriends(),
        friendAPI.getRequests(),
        gameAPI.getGameInvites(),
        gameAPI.getActiveGames(),
        chatAPI.getUnreadByUser(),
      ]);
      setFriends(friendsRes.data);
      setRequests(requestsRes.data);
      setGameInvites(invitesRes.data);
      setActiveGames(gamesRes.data);
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

  const handleContinueGame = (game: ActiveGame) => {
    router.push(`/game/${game.game_id}`);
  };

  const handleEndGame = async (game: ActiveGame) => {
    try {
      await gameAPI.abandonGame(game.game_id);
      Alert.alert('Success', 'Game ended');
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to end game');
    }
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <View style={styles.card}>
      <TouchableOpacity 
        style={styles.friendInfoTouchable}
        onPress={() => {
          setSelectedFriend(item);
          setModalVisible(true);
        }}
      >
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
          </View>
        </View>
      </TouchableOpacity>
      
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
    <TouchableOpacity 
      style={styles.card}
      onPress={() => {
        setSelectedRequest(item);
        setRequestModalVisible(true);
      }}
    >
      <View style={styles.friendInfo}>
        <Avatar avatar={item.avatar} size={50} />
        <View style={styles.details}>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.bio} numberOfLines={1}>
            {item.bio || 'No bio'}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={24} color={theme.colors.textSecondary} />
    </TouchableOpacity>
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

  const renderActiveGame = ({ item }: { item: ActiveGame }) => (
    <View style={styles.card}>
      <View style={styles.friendInfo}>
        <Avatar avatar={item.opponent_avatar} size={50} />
        <View style={styles.details}>
          <Text style={styles.username}>{item.opponent}</Text>
          <Text style={styles.gameInfo}>Round {item.current_round} • {item.mode}</Text>
        </View>
      </View>
      <View style={styles.gameButtons}>
        <TouchableOpacity
          style={styles.endButton}
          onPress={() => handleEndGame(item)}
        >
          <Ionicons name="close-circle" size={28} color="#ff6b6b" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => handleContinueGame(item)}
        >
          <LinearGradient
            colors={['#4CAF50', '#45A049']}
            style={styles.continueButtonGradient}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
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
          data={[...activeGames, ...gameInvites, ...requests, ...friends]}
          renderItem={(props) => {
            const { item, index } = props;
            const prevItem = index > 0 ? [...activeGames, ...gameInvites, ...requests, ...friends][index - 1] : null;
            
            // Determine if we need to show a section header
            let sectionHeader = null;
            
            // Active Games section
            if (activeGames.includes(item) && !activeGames.includes(prevItem)) {
              sectionHeader = <Text style={styles.sectionTitle}>🎮 Active Games</Text>;
            }
            // Game Invites section
            else if (gameInvites.includes(item) && !gameInvites.includes(prevItem)) {
              sectionHeader = <Text style={styles.sectionTitle}>📨 Game Invites</Text>;
            }
            // Friend Requests section
            else if (requests.includes(item) && !requests.includes(prevItem)) {
              sectionHeader = <Text style={styles.sectionTitle}>👥 Friend Requests</Text>;
            }
            // Friends section
            else if (friends.includes(item) && !friends.includes(prevItem)) {
              sectionHeader = <Text style={styles.sectionTitle}>🧑‍🤝‍🧑 Friends</Text>;
            }
            
            return (
              <>
                {sectionHeader}
                {activeGames.includes(item) ? renderActiveGame(props) :
                 gameInvites.includes(item) ? renderGameInvite(props) :
                 requests.includes(item) ? renderRequest(props) :
                 renderFriend(props)}
              </>
            );
          }}
          keyExtractor={(item, index) => {
            if ('game_id' in item) return `game-${item.game_id}`;
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
        />
      </LinearGradient>

      {/* Friend Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Avatar avatar={selectedFriend?.avatar} size={80} />
            
            <Text style={styles.modalUsername}>{selectedFriend?.username}</Text>
            <Text style={styles.modalBio}>{selectedFriend?.bio || 'No bio'}</Text>
            
            {/* Age & Country */}
            {(selectedFriend?.age || selectedFriend?.country) && (
              <View style={styles.modalMetadata}>
                {selectedFriend?.country && (
                  <Text style={styles.modalMetaText}>🌍 {selectedFriend.country}</Text>
                )}
                {selectedFriend?.age && (
                  <Text style={styles.modalMetaText}>🎂 {selectedFriend.age} years old</Text>
                )}
              </View>
            )}
            
            <View style={styles.modalStats}>
              <View style={styles.modalStat}>
                <Text style={styles.modalStatValue}>Lv {selectedFriend?.level}</Text>
                <Text style={styles.modalStatLabel}>Level</Text>
              </View>
              <View style={styles.modalStat}>
                <Text style={styles.modalStatValue}>{selectedFriend?.connection_score || 0}%</Text>
                <Text style={styles.modalStatLabel}>Sync</Text>
              </View>
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setModalVisible(false);
                  if (selectedFriend) handleChat(selectedFriend);
                }}
              >
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.secondary]}
                  style={styles.modalButtonGradient}
                >
                  <Ionicons name="chatbubble" size={20} color={theme.colors.text} />
                  <Text style={styles.modalButtonText}>Chat</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setModalVisible(false);
                  if (selectedFriend) handleSendGameInvite(selectedFriend);
                }}
              >
                <LinearGradient
                  colors={[theme.colors.secondary, theme.colors.primary]}
                  style={styles.modalButtonGradient}
                >
                  <Ionicons name="game-controller" size={20} color={theme.colors.text} />
                  <Text style={styles.modalButtonText}>Play</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Friend Request Detail Modal */}
      <Modal
        visible={requestModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRequestModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Avatar avatar={selectedRequest?.avatar || ''} size={80} />
            <Text style={styles.modalTitle}>{selectedRequest?.username}</Text>
            <Text style={styles.modalSubtitle}>{selectedRequest?.bio || 'No bio'}</Text>
            
            {(selectedRequest?.country || selectedRequest?.age) && (
              <View style={styles.modalMeta}>
                {selectedRequest?.country && (
                  <Text style={styles.modalMetaText}>🌍 {selectedRequest.country}</Text>
                )}
                {selectedRequest?.age && (
                  <Text style={styles.modalMetaText}>🎂 {selectedRequest.age} years old</Text>
                )}
              </View>
            )}
            
            <View style={styles.modalStats}>
              <View style={styles.modalStat}>
                <Text style={styles.modalStatValue}>Lv {selectedRequest?.level}</Text>
                <Text style={styles.modalStatLabel}>Level</Text>
              </View>
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setRequestModalVisible(false)}
              >
                <LinearGradient
                  colors={[theme.colors.cardBackground, theme.colors.cardBackground]}
                  style={styles.modalButtonGradient}
                >
                  <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                  <Text style={[styles.modalButtonText, {color: theme.colors.textSecondary}]}>Reject</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={async () => {
                  if (selectedRequest) {
                    await acceptRequest(selectedRequest.username);
                    setRequestModalVisible(false);
                  }
                }}
              >
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.secondary]}
                  style={styles.modalButtonGradient}
                >
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.text} />
                  <Text style={styles.modalButtonText}>Accept</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setRequestModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
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
  gameInfo: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  gameButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginLeft: theme.spacing.md,
    alignItems: 'center',
  },
  endButton: {
    // Button container for end game
  },
  continueButton: {
    // Button container for continue
  },
  continueButtonGradient: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  continueButtonText: {
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  friendInfoTouchable: {
    flex: 1,
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
  modalUsername: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.md,
  },
  modalBio: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  modalMetadata: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  modalMetaText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  modalStats: {
    flexDirection: 'row',
    gap: theme.spacing.xl,
    marginTop: theme.spacing.lg,
  },
  modalStat: {
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  modalStatLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    width: '100%',
  },
  modalButton: {
    flex: 1,
  },
  modalButtonGradient: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  modalButtonText: {
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  modalCloseText: {
    color: theme.colors.textSecondary,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
  },
  modalButtonPrimary: {
    flex: 1,
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalButtonTextSecondary: {
    color: theme.colors.text,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
});
