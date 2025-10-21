import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';
import { userAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

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
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await userAPI.getMe();
      setProfile(response.data);
    } catch (error) {
      console.error('Failed to load profile', error);
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
          <View style={styles.header}>
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.secondary]}
              style={styles.avatar}
            >
              <Ionicons name="person" size={48} color={theme.colors.text} />
            </LinearGradient>
            <Text style={styles.username}>{profile.username}</Text>
            <Text style={styles.bio}>{profile.bio || 'No bio yet'}</Text>
            {profile.age && profile.country && (
              <Text style={styles.info}>
                {profile.age} • {profile.country}
              </Text>
            )}
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.level}</Text>
              <Text style={styles.statLabel}>Level</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.connection_score}%</Text>
              <Text style={styles.statLabel}>Connection</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.successful_syncs}</Text>
              <Text style={styles.statLabel}>Syncs</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.total_games}</Text>
              <Text style={styles.statLabel}>Games</Text>
            </View>
          </View>

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

          {profile.badges.length > 0 && (
            <View style={styles.badgesContainer}>
              <Text style={styles.sectionTitle}>Badges</Text>
              <View style={styles.badgesList}>
                {profile.badges.map((badge, index) => (
                  <View key={index} style={styles.badge}>
                    <Ionicons
                      name={badge.type === 'mind_reader' ? 'brain' : badge.type === 'word_wizard' ? 'sparkles' : 'star'}
                      size={24}
                      color={theme.colors.secondary}
                    />
                    <Text style={styles.badgeName}>{badge.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
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
  avatar: {
    width: 100,
    height: 100,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  username: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  bio: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  info: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
  },
  statCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  badgesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  badge: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    minWidth: 100,
  },
  badgeName: {
    fontSize: 12,
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  logoutText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
