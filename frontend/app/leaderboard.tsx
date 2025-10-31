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
import { useRouter } from 'expo-router';
import { theme } from '../constants/theme';
import { userAPI } from '../utils/api';
import Avatar from '../components/Avatar';

export default function LeaderboardScreen() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [period, setPeriod] = useState<string>('all_time');
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadLeaderboard();
  }, [period]);

  const loadLeaderboard = async () => {
    try {
      const response = await userAPI.getLeaderboard(period);
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Failed to load leaderboard', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  };

  const renderPlayer = ({ item }: { item: any }) => {
    const isCurrentUser = item.is_current_user;
    const medalEmoji = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : '';
    
    return (
      <View style={[styles.card, isCurrentUser && styles.currentUserCard]}>
        <Text style={styles.rank}>#{item.rank}</Text>
        
        <Avatar avatar={item.avatar} size={40} />
        
        <View style={styles.playerInfo}>
          <View style={styles.nameRow}>
            {medalEmoji && <Text style={styles.medal}>{medalEmoji}</Text>}
            <Text style={[styles.username, isCurrentUser && styles.currentUserText]}>
              {item.username}
            </Text>
          </View>
          <Text style={styles.stats}>
            Lv {item.level} • {item.connection_score}% • {item.total_games} games
          </Text>
        </View>
        
        <Text style={styles.score}>{item.score.toFixed(1)}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.cardBg]}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>🏆 Leaderboard</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Period Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, period === 'daily' && styles.activeTab]}
            onPress={() => setPeriod('daily')}
          >
            <Text style={[styles.tabText, period === 'daily' && styles.activeTabText]}>
              Daily
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, period === 'weekly' && styles.activeTab]}
            onPress={() => setPeriod('weekly')}
          >
            <Text style={[styles.tabText, period === 'weekly' && styles.activeTabText]}>
              Weekly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, period === 'monthly' && styles.activeTab]}
            onPress={() => setPeriod('monthly')}
          >
            <Text style={[styles.tabText, period === 'monthly' && styles.activeTabText]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, period === 'all_time' && styles.activeTab]}
            onPress={() => setPeriod('all_time')}
          >
            <Text style={[styles.tabText, period === 'all_time' && styles.activeTabText]}>
              All Time
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={leaderboard}
          renderItem={renderPlayer}
          keyExtractor={(item) => item.username}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No players yet</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    backgroundColor: theme.colors.cardBg,
  },
  activeTab: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  activeTabText: {
    color: theme.colors.text,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  currentUserCard: {
    borderWidth: 2,
    borderColor: theme.colors.secondary,
  },
  rank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    width: 40,
  },
  playerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  medal: {
    fontSize: 16,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  currentUserText: {
    color: theme.colors.secondary,
  },
  stats: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  score: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
});
