import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme } from '../../constants/theme';
import { gameAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

export default function ResultScreen() {
  const { id } = useLocalSearchParams();
  const [gameStatus, setGameStatus] = useState<any>(null);
  const [scaleAnim] = useState(new Animated.Value(0));
  const router = useRouter();
  const { username } = useAuth();

  useEffect(() => {
    loadGameStatus();
  }, []);

  useEffect(() => {
    if (gameStatus) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  }, [gameStatus]);

  const loadGameStatus = async () => {
    try {
      const response = await gameAPI.getGameStatus(id as string);
      setGameStatus(response.data);
    } catch (error) {
      console.error('Failed to load game result', error);
    }
  };

  if (!gameStatus) {
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

  const isPlayer1 = username === gameStatus.player1;
  const opponentName = isPlayer1 ? gameStatus.player2 : gameStatus.player1;
  const canChat = gameStatus.player2 !== 'AI';

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.cardBg]}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.syncContainer,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.secondary]}
              style={styles.syncCircle}
            >
              <Ionicons name="flash" size={64} color={theme.colors.text} />
            </LinearGradient>
          </Animated.View>

          <Text style={styles.syncTitle}>SYNC!</Text>
          <Text style={styles.syncWord}>"{gameStatus.sync_word}"</Text>

          <View style={styles.statsCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Rounds to Sync</Text>
              <Text style={styles.statValue}>{gameStatus.total_rounds}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Wavelength Score</Text>
              <Text style={styles.statValue}>{gameStatus.wavelength_score}%</Text>
            </View>
          </View>

          <View style={styles.roundsHistory}>
            <Text style={styles.historyTitle}>Round History</Text>
            {gameStatus.rounds.map((round: any) => (
              <View key={round.round} style={styles.roundItem}>
                <Text style={styles.roundNumber}>Round {round.round}</Text>
                <View style={styles.roundWords}>
                  <Text style={styles.roundWord}>{round.player1_word}</Text>
                  <Text style={styles.roundSeparator}>+</Text>
                  <Text style={styles.roundWord}>{round.player2_word}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            {canChat && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push(`/chat/${opponentName}`)}
              >
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.secondary]}
                  style={styles.actionButtonGradient}
                >
                  <Ionicons name="chatbubbles" size={24} color={theme.colors.text} />
                  <Text style={styles.actionButtonText}>Chat</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/home')}
            >
              <LinearGradient
                colors={[theme.colors.secondary, theme.colors.primary]}
                style={styles.actionButtonGradient}
              >
                <Ionicons name="home" size={24} color={theme.colors.text} />
                <Text style={styles.actionButtonText}>Home</Text>
              </LinearGradient>
            </TouchableOpacity>
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
    paddingBottom: theme.spacing.xl * 2,
  },
  loading: {
    color: theme.colors.text,
    textAlign: 'center',
  },
  syncContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  syncCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  syncWord: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  statsCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  statLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  roundsHistory: {
    marginBottom: theme.spacing.xl,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  roundItem: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  roundNumber: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  roundWords: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  roundWord: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  roundSeparator: {
    fontSize: 16,
    color: theme.colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  actionButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
