import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';
import { userAPI } from '../../utils/api';

export default function StatsScreen() {
  const [badges, setBadges] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [badgesRes, profileRes] = await Promise.all([
        userAPI.getBadgeProgress(),
        userAPI.getMe(),
      ]);
      setBadges(badgesRes.data);
      setProfile(profileRes.data);
    } catch (error) {
      console.error('Failed to load stats', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.cardBg]}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.header}>
            <Text style={styles.pageTitle}>📊 Your Stats</Text>
            <TouchableOpacity
              style={styles.leaderboardIconButton}
              onPress={() => router.push('/leaderboard')}
            >
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.secondary]}
                style={styles.leaderboardIconGradient}
              >
                <Ionicons name="trophy" size={24} color={theme.colors.text} />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Quick Stats */}
          {profile && (
            <View style={styles.quickStats}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{profile.total_games || 0}</Text>
                <Text style={styles.statLabel}>Games</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{profile.connection_score || 0}%</Text>
                <Text style={styles.statLabel}>Win Rate</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{profile.level || 1}</Text>
                <Text style={styles.statLabel}>Level</Text>
              </View>
            </View>
          )}

          {/* Badges Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🏆 Badges</Text>
              <Text style={styles.badgesCount}>
                {badges.filter(b => b.earned).length}/{badges.length}
              </Text>
            </View>

            {badges.map((badge) => (
              <View key={badge.id} style={[styles.badgeCard, badge.earned && styles.badgeCardEarned]}>
                <Text style={styles.badgeName}>{badge.name}</Text>
                <Text style={styles.badgeDesc}>{badge.description}</Text>
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBar}>
                    <LinearGradient
                      colors={badge.earned ? ['#4CAF50', '#45A049'] : [theme.colors.primary, theme.colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressFill, { width: `${Math.min((badge.progress / badge.target) * 100, 100)}%` }]}
                    />
                  </View>
                  <Text style={styles.progressText}>{badge.progress}/{badge.target}</Text>
                </View>
                {!badge.earned && (
                  <Text style={styles.progressHint}>{badge.target - badge.progress} more to unlock!</Text>
                )}
                {badge.earned && (
                  <Text style={styles.earnedBadge}>✅ Unlocked!</Text>
                )}
              </View>
            ))}
          </View>

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
  content: {
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  leaderboardIconButton: {
    // Trophy icon button
  },
  leaderboardIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickStats: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
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
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  badgesCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.secondary,
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
});
