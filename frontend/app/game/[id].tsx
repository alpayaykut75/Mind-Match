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

      // Check if game is completed
      if (status.synced) {
        router.replace(`/result/${id}`);
      }

      // Check if current player has submitted
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
        // Sync achieved!
        router.replace(`/result/${id}`);
      } else if (response.data.next_round) {
        // Move to next round
        setWord('');
        setSubmitted(false);
        await loadGameStatus();
      } else {
        // Waiting for opponent
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.opponent}>vs {opponentName}</Text>
            <Text style={styles.roundInfo}>Round {gameStatus.current_round}</Text>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.instructionContainer}>
            <Ionicons name="bulb" size={32} color={theme.colors.secondary} />
            <Text style={styles.instruction}>
              {isInitialRound
                ? 'Type your starting word'
                : 'Find a word that connects both words below'}
            </Text>
          </View>

          {lastRound && bothSubmitted && !isInitialRound && (
            <View style={styles.lastRoundContainer}>
              <Text style={styles.lastRoundTitle}>Previous Round:</Text>
              <View style={styles.lastRoundWords}>
                <View style={styles.wordBox}>
                  <Text style={styles.wordBoxLabel}>{gameStatus.player1}</Text>
                  <Text style={styles.wordBoxText}>{lastRound.player1_word}</Text>
                </View>
                <Ionicons name="add" size={24} color={theme.colors.primary} />
                <View style={styles.wordBox}>
                  <Text style={styles.wordBoxLabel}>{gameStatus.player2}</Text>
                  <Text style={styles.wordBoxText}>{lastRound.player2_word}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>Round History</Text>
            {gameStatus.rounds.length > 0 ? (
              gameStatus.rounds.map((round) => (
                <View key={round.round} style={styles.historyItem}>
                  <Text style={styles.historyRound}>Round {round.round}</Text>
                  <View style={styles.historyWords}>
                    <Text style={styles.historyWord}>{round.player1_word}</Text>
                    <Text style={styles.historySeparator}>+</Text>
                    <Text style={styles.historyWord}>{round.player2_word}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noHistory}>No history yet</Text>
            )}
          </View>
        </ScrollView>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={submitted ? 'Waiting for opponent...' : 'Enter your word'}
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
          </View>

          {submitted && (
            <View style={styles.waitingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.waitingText}>Waiting for {opponentName}...</Text>
            </View>
          )}
        </KeyboardAvoidingView>
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
    flex: 1,
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    marginRight: theme.spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  opponent: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  roundInfo: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  lastRoundContainer: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  lastRoundTitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  lastRoundWords: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordBox: {
    flex: 1,
    alignItems: 'center',
  },
  wordBoxLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  wordBoxText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  instructionContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  instruction: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  input: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 24,
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  waitingContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  waitingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  historyContainer: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  historyItem: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  historyRound: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  historyWords: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  historyWord: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  historySeparator: {
    color: theme.colors.textSecondary,
  },
});
