import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme } from '../../constants/theme';
import { gameAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

interface GameStatus {
  game_id: string;
  player1: string;
  player2: string;
  mode: string;
  status: string;
  current_round: number;
  player1_word: string | null;
  player2_word: string | null;
  synced: boolean;
  sync_word: string | null;
  total_rounds: number;
  wavelength_score: number;
  rounds: Array<{
    round: number;
    player1_word: string;
    player2_word: string;
    synced: boolean;
  }>;
}

export default function GameScreen() {
  const { id } = useLocalSearchParams();
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [word, setWord] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();
  const { username } = useAuth();

  useEffect(() => {
    if (id) {
      loadGameStatus();
      const interval = setInterval(loadGameStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [id]);

  const loadGameStatus = async () => {
    try {
      const response = await gameAPI.getGameStatus(id as string);
      const status = response.data;
      setGameStatus(status);

      if (status.synced) {
        router.replace(`/result/${id}`);
      }

      const isPlayer1 = username === status.player1;
      const hasSubmitted = isPlayer1 ? status.player1_word !== null : status.player2_word !== null;
      setSubmitted(hasSubmitted);
    } catch (error) {
      console.error('Failed to load game status', error);
    }
  };

  const submitWord = async () => {
    if (!word.trim()) {
      Alert.alert('Error', 'Please enter a word');
      return;
    }

    setLoading(true);
    try {
      const response = await gameAPI.submitWord(id as string, word.trim());
      
      if (response.data.synced) {
        router.replace(`/result/${id}`);
      } else if (response.data.next_round) {
        setWord('');
        setSubmitted(false);
        await loadGameStatus();
      } else {
        setSubmitted(true);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit word');
    } finally {
      setLoading(false);
    }
  };

  if (!gameStatus) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={[theme.colors.background, theme.colors.cardBg]}
          style={styles.gradient}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const isPlayer1 = username === gameStatus.player1;
  const opponentName = isPlayer1 ? gameStatus.player2 : gameStatus.player1;
  const isInitialRound = gameStatus.status === 'round_1_initial';
  const bothSubmitted = gameStatus.player1_word && gameStatus.player2_word;
  const lastRound = gameStatus.rounds[gameStatus.rounds.length - 1];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.cardBg]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.opponent}>vs {opponentName}</Text>
            <Text style={styles.roundBadge}>Round {gameStatus.current_round}</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* Input Section - EN ÜSTTE */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>
              {isInitialRound ? 'Your Starting Word' : 'Find Connecting Word'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={submitted ? 'Waiting for opponent...' : 'Type your word'}
              placeholderTextColor={theme.colors.textSecondary}
              value={word}
              onChangeText={setWord}
              autoCapitalize="characters"
              editable={!submitted}
            />
            {!submitted && (
              <TouchableOpacity
                onPress={submitWord}
                disabled={loading || !word.trim()}
              >
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.secondary]}
                  style={[styles.submitButton, (!word.trim() || loading) && styles.submitButtonDisabled]}
                >
                  {loading ? (
                    <ActivityIndicator color={theme.colors.text} />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            {submitted && (
              <View style={styles.waitingBox}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.waitingText}>Waiting for {opponentName}...</Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>

        {/* Previous Round - HEMEN ALTTA */}
        {lastRound && bothSubmitted && !isInitialRound && (
          <View style={styles.previousRound}>
            <Text style={styles.previousRoundLabel}>Previous Round:</Text>
            <View style={styles.wordsRow}>
              <View style={styles.wordChip}>
                <Text style={styles.wordChipText}>{lastRound.player1_word}</Text>
              </View>
              <Text style={styles.plusSign}>+</Text>
              <View style={styles.wordChip}>
                <Text style={styles.wordChipText}>{lastRound.player2_word}</Text>
              </View>
            </View>
          </View>
        )}

        {/* History - EN ALTTA */}
        <ScrollView style={styles.historyScroll} contentContainerStyle={styles.historyContent}>
          <Text style={styles.historyTitle}>Round History</Text>
          {gameStatus.rounds.length > 0 ? (
            gameStatus.rounds.map((round) => (
              <View key={round.round} style={styles.historyCard}>
                <Text style={styles.historyRoundNum}>Round {round.round}</Text>
                <View style={styles.historyWordsRow}>
                  <Text style={styles.historyWord}>{round.player1_word}</Text>
                  <Text style={styles.historySep}>+</Text>
                  <Text style={styles.historyWord}>{round.player2_word}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noHistory}>No history yet</Text>
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBg,
  },
  headerCenter: {
    alignItems: 'center',
  },
  opponent: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  roundBadge: {
    fontSize: 12,
    color: theme.colors.primary,
    marginTop: 2,
  },
  inputSection: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBg,
  },
  inputLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  input: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  submitButton: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  waitingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  previousRound: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background,
  },
  previousRoundLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  wordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  wordChip: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  wordChipText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  plusSign: {
    fontSize: 24,
    color: theme.colors.textSecondary,
    fontWeight: 'bold',
  },
  historyScroll: {
    flex: 1,
  },
  historyContent: {
    padding: theme.spacing.lg,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  historyCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  historyRoundNum: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  historyWordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  historyWord: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '600',
  },
  historySep: {
    fontSize: 14,
    color: theme.colors.primary,
  },
  noHistory: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
});
