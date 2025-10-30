import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';
import { userAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import AvatarPicker from '../../components/AvatarPicker';
import Avatar from '../../components/Avatar';

interface Badge {
  type: string;
  name: string;
}

interface UserProfile {
  username: string;
  bio: string;
  age?: number;
  country: string;
  avatar: string;
  xp: number;
  level: number;
  connection_score: number;
  total_games: number;
  successful_syncs: number;
  current_streak: number;
  badges: Badge[];
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await userAPI.getMe();
      setProfile(response.data);
      setEditBio(response.data.bio || '');
      setEditAge(response.data.age?.toString() || '');
      setEditCountry(response.data.country || '');
    } catch (error) {
      console.error('Failed to load profile', error);
    }
  };

  // loadBadges function removed - badges now come from profile.badges

  const handleSaveBio = async () => {
    try {
      const updateData: any = { bio: editBio };
      
      if (editAge) {
        updateData.age = parseInt(editAge);
      }
      
      if (editCountry) {
        updateData.country = editCountry;
      }
      
      await userAPI.updateProfile(updateData);
      setEditModalVisible(false);
      await loadProfile();
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleAvatarSelect = async (avatar: string) => {
    try {
      await userAPI.updateProfile({ avatar });
      await loadProfile();
      Alert.alert('Success', 'Avatar updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update avatar');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={[theme.colors.background, theme.colors.cardBg]}
          style={styles.gradient}
        >
          <Text style={styles.loading}>Loading...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.cardBg]}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Avatar & Basic Info */}
          <View style={styles.header}>
            <View style={styles.avatarContainer}>
              <Avatar avatar={profile.avatar} size={100} />
              <TouchableOpacity 
                style={styles.editAvatarButton}
                onPress={() => setShowAvatarPicker(true)}
              >
                <Ionicons name="camera" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.username}>{profile.username}</Text>
            
            <TouchableOpacity 
              style={styles.bioContainer}
              onPress={() => setEditModalVisible(true)}
            >
              <Text style={styles.bio}>{profile.bio || 'Add a bio...'}</Text>
              <Ionicons name="pencil" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            {/* Age & Country */}
            {(profile.age || profile.country) && (
              <View style={styles.metadataContainer}>
                {profile.country && (
                  <Text style={styles.metadataText}>🌍 {profile.country}</Text>
                )}
                {profile.age && (
                  <Text style={styles.metadataText}>🎂 {profile.age} years old</Text>
                )}
              </View>
            )}
          </View>

          {/* Stats Cards - Level & Games */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.level}</Text>
              <Text style={styles.statLabel}>Level</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.total_games}</Text>
              <Text style={styles.statLabel}>Games</Text>
            </View>
          </View>

          {/* XP Progress */}
          <View style={styles.xpContainer}>
            <Text style={styles.xpLabel}>Experience Points</Text>
            <Text style={styles.xpValue}>{profile.xp} XP</Text>
            <View style={styles.xpBar}>
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.xpProgress,
                  { width: `${(profile.xp % 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.xpNext}>{100 - (profile.xp % 100)} XP to level {profile.level + 1}</Text>
          </View>

          {/* Stats & Badges Button */}
          <TouchableOpacity
            style={styles.statsButton}
            onPress={() => router.push('/stats')}
          >
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.secondary]}
              style={styles.statsGradient}
            >
              <Ionicons name="stats-chart" size={24} color={theme.colors.text} />
              <Text style={styles.statsButtonText}>View Stats & Badges</Text>
              <Ionicons name="chevron-forward" size={24} color={theme.colors.text} />
            </LinearGradient>
          </TouchableOpacity>

          {/* Leaderboard Button */}
          <TouchableOpacity
            style={styles.leaderboardButton}
            onPress={() => router.push('/leaderboard')}
          >
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.secondary]}
              style={styles.leaderboardGradient}
            >
              <Ionicons name="trophy" size={24} color={theme.colors.text} />
              <Text style={styles.leaderboardText}>View Leaderboard</Text>
              <Ionicons name="chevron-forward" size={24} color={theme.colors.text} />
            </LinearGradient>
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Edit Bio Modal */}
        <Modal
          visible={editModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              
              <TextInput
                style={styles.bioInput}
                placeholder="Tell us about yourself..."
                placeholderTextColor={theme.colors.textSecondary}
                value={editBio}
                onChangeText={setEditBio}
                multiline
                maxLength={150}
              />
              <Text style={styles.charCount}>{editBio.length}/150</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Age (optional)"
                placeholderTextColor={theme.colors.textSecondary}
                value={editAge}
                onChangeText={setEditAge}
                keyboardType="number-pad"
                maxLength={3}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Country (optional)"
                placeholderTextColor={theme.colors.textSecondary}
                value={editCountry}
                onChangeText={setEditCountry}
                maxLength={50}
              />
              
              <TouchableOpacity onPress={handleSaveBio}>
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.secondary]}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Avatar Picker Modal */}
        <AvatarPicker
          visible={showAvatarPicker}
          onClose={() => setShowAvatarPicker(false)}
          onSelectAvatar={handleAvatarSelect}
          currentAvatar={profile.avatar}
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
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  loading: {
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: theme.spacing.md,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.background,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  bioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  bio: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  metadataContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  metadataText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  info: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  statCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    minWidth: 120,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  xpContainer: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  xpLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  xpValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  xpBar: {
    height: 8,
    backgroundColor: theme.colors.background,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  xpProgress: {
    height: '100%',
  },
  xpNext: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  badgesContainer: {
    marginBottom: theme.spacing.xl,
  },
  badgesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  badgesCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.secondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  badgeCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    opacity: 0.6,
  },
  badgeCardEarned: {
    opacity: 1,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  badgeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  badgeDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    minWidth: 40,
  },
  progressHint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  earnedBadge: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 4,
  },
  leaderboardButton: {
    marginBottom: theme.spacing.md,
  },
  leaderboardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  leaderboardText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  logoutText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  bioInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 14,
    marginBottom: theme.spacing.md,
  },
  charCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginBottom: theme.spacing.lg,
  },
  modalButton: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalCancelButton: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  modalCancelText: {
    color: theme.colors.textSecondary,
  },
});
