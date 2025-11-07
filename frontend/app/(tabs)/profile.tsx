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
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  languages: string[];
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [usernameModalVisible, setUsernameModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const response = await userAPI.getMe();
      setProfile(response.data);
      setEditBio(response.data.bio || '');
      setEditAge(response.data.age?.toString() || '');
      setEditCountry(response.data.country || '');
    } catch (error) {
      console.error('Failed to load profile', error);
      // If profile load fails, set a minimal profile to show logout button
      setProfile({
        username: 'User',
        bio: '',
        country: '',
        avatar: '',
        xp: 0,
        level: 1,
        connection_score: 0,
        total_games: 0,
        successful_syncs: 0,
        current_streak: 0,
        badges: []
      });
    } finally {
      setIsLoading(false);
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

  const handleUsernameChange = async () => {
    if (!newUsername.trim()) {
      Alert.alert('Error', 'Please enter a new username');
      return;
    }
    
    try {
      const response = await userAPI.changeUsername(newUsername.trim());
      
      // Update token in AsyncStorage
      if (response.data.token) {
        await AsyncStorage.setItem('token', response.data.token);
      }
      
      setUsernameModalVisible(false);
      setNewUsername('');
      await loadProfile();
      Alert.alert('Success', 'Username updated successfully! You can now login with your new username.');
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to update username';
      Alert.alert('Error', message);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    
    try {
      await userAPI.changePassword(currentPassword, newPassword);
      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password updated successfully!');
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to update password';
      Alert.alert('Error', message);
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={[theme.colors.background, theme.colors.cardBg]}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <Text style={styles.loading}>Loading...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={[theme.colors.background, theme.colors.cardBg]}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <Text style={styles.loading}>Failed to load profile</Text>
            <TouchableOpacity 
              style={styles.emergencyLogoutButton}
              onPress={async () => {
                await logout();
                router.replace('/auth/login');
              }}
            >
              <Text style={styles.emergencyLogoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
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

          {/* Stats Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Performance Stats</Text>
            
            <View style={styles.performanceStats}>
              <View style={styles.performanceCard}>
                <View style={styles.performanceIconContainer}>
                  <Ionicons name="sync" size={24} color={theme.colors.primary} />
                </View>
                <Text style={styles.performanceValue}>{profile.connection_score}%</Text>
                <Text style={styles.performanceLabel}>Connection</Text>
              </View>

              <View style={styles.performanceCard}>
                <View style={styles.performanceIconContainer}>
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.secondary} />
                </View>
                <Text style={styles.performanceValue}>{profile.successful_syncs}</Text>
                <Text style={styles.performanceLabel}>Syncs</Text>
              </View>

              <View style={styles.performanceCard}>
                <View style={styles.performanceIconContainer}>
                  <Ionicons name="flame" size={24} color="#FF6B35" />
                </View>
                <Text style={styles.performanceValue}>{profile.current_streak}</Text>
                <Text style={styles.performanceLabel}>Streak</Text>
              </View>
            </View>
          </View>

          {/* Badges Section */}
          {profile.badges && profile.badges.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Badges</Text>
              <View style={styles.badgesContainer}>
                {profile.badges.map((badge, index) => (
                  <View key={index} style={styles.badge}>
                    <Text style={styles.badgeIcon}>
                      {badge.type === 'first_sync' && '🎯'}
                      {badge.type === 'streak_3' && '🔥'}
                      {badge.type === 'streak_7' && '⚡'}
                      {badge.type === 'games_10' && '🎮'}
                      {badge.type === 'games_50' && '🏆'}
                      {badge.type === 'perfect_sync' && '✨'}
                    </Text>
                    <Text style={styles.badgeName}>{badge.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Settings Button */}
          <TouchableOpacity 
            style={styles.settingsButton} 
            onPress={() => setSettingsModalVisible(true)}
          >
            <Ionicons name="settings-outline" size={20} color={theme.colors.text} />
            <Text style={styles.settingsButtonText}>Account Settings</Text>
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

        {/* Settings Modal */}
        <Modal
          visible={settingsModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSettingsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Account Settings</Text>
              
              <TouchableOpacity 
                style={styles.settingsOption}
                onPress={() => {
                  setSettingsModalVisible(false);
                  setUsernameModalVisible(true);
                }}
              >
                <Ionicons name="person-outline" size={24} color={theme.colors.primary} />
                <Text style={styles.settingsOptionText}>Change Username</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsOption}
                onPress={() => {
                  setSettingsModalVisible(false);
                  setPasswordModalVisible(true);
                }}
              >
                <Ionicons name="lock-closed-outline" size={24} color={theme.colors.secondary} />
                <Text style={styles.settingsOptionText}>Change Password</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setSettingsModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Username Change Modal */}
        <Modal
          visible={usernameModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setUsernameModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Change Username</Text>
              
              <Text style={styles.modalDescription}>
                Current username: <Text style={styles.currentUsername}>{profile.username}</Text>
              </Text>
              
              <TextInput
                style={styles.input}
                placeholder="New username"
                placeholderTextColor={theme.colors.textSecondary}
                value={newUsername}
                onChangeText={setNewUsername}
                autoCapitalize="none"
                maxLength={20}
              />
              
              <TouchableOpacity onPress={handleUsernameChange}>
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.secondary]}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonText}>Change Username</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setUsernameModalVisible(false);
                  setNewUsername('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Password Change Modal */}
        <Modal
          visible={passwordModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPasswordModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Change Password</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Current password"
                placeholderTextColor={theme.colors.textSecondary}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              
              <TextInput
                style={styles.input}
                placeholder="New password (min 6 characters)"
                placeholderTextColor={theme.colors.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={theme.colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              
              <TouchableOpacity onPress={handlePasswordChange}>
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.secondary]}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonText}>Change Password</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setPasswordModalVisible(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
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
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  loading: {
    color: theme.colors.text,
    fontSize: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.xl,
  },
  emergencyLogoutButton: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.lg,
  },
  emergencyLogoutText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
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
  sectionContainer: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  performanceStats: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  performanceCard: {
    flex: 1,
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  performanceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  performanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  performanceLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  badge: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    flex: 1,
    minWidth: 100,
    maxWidth: '31%',
    gap: theme.spacing.xs,
  },
  badgeIcon: {
    fontSize: 32,
  },
  badgeName: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  settingsButton: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  settingsButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.xl,
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
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  settingsOptionText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  modalDescription: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  currentUsername: {
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
});
