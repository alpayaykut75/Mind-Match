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
  
  // Şu anki round'ın kelimelerini göster
  const myCurrentWord = isPlayer1 ? gameStatus.player1_word : gameStatus.player2_word;
  const opponentCurrentWord = isPlayer1 ? gameStatus.player2_word : gameStatus.player1_word;
  
  // Eğer şu anki round'da kelime yoksa, son round'dan al
  let myLastWord = myCurrentWord;
  let opponentLastWord = opponentCurrentWord;
  
  // Eğer mevcut round'da kelime yoksa ve rounds varsa, son round'dan göster
  if (!myCurrentWord && !opponentCurrentWord && gameStatus.rounds.length > 0) {
    const lastCompletedRound = gameStatus.rounds[gameStatus.rounds.length - 1];
    myLastWord = isPlayer1 ? lastCompletedRound.player1_word : lastCompletedRound.player2_word;
    opponentLastWord = isPlayer1 ? lastCompletedRound.player2_word : lastCompletedRound.player1_word;
  }
  
  // Her iki kelimeyi de aynı font boyutunda göstermek için - uzun olana göre ayarla
  const maxLength = Math.max(myLastWord?.length || 0, opponentLastWord?.length || 0);
  const calculateFontSize = (length: number) => {
    if (length === 0) return 18;
    if (length > 15) return 12;
    if (length > 12) return 14;
    if (length > 10) return 15;
    if (length > 7) return 16;
    return 18;
  };
  const syncedFontSize = calculateFontSize(maxLength);
  
  const isInitialRound = gameStatus.status === 'round_1_initial';

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
              {isInitialRound ? 'Type your starting word' : 'Find the connecting word'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Type your word"
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

        {/* Players Side by Side - YANYANA İKİ KİŞİ */}
        <View style={styles.playersContainer}>
          {/* You */}
          <View style={styles.playerCard}>
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.secondary]}
              style={styles.playerAvatar}
            >
              <Ionicons name="person" size={32} color={theme.colors.text} />
            </LinearGradient>
            <Text style={styles.playerName}>You</Text>
            {myLastWord && (
              <View style={styles.wordBubble}>
                <Text 
                  style={[styles.wordBubbleText, { fontSize: syncedFontSize }]}
                  numberOfLines={1}
                >
                  {myLastWord}
                </Text>
              </View>
            )}
          </View>

          {/* VS */}
          <View style={styles.vsContainer}>
            <Ionicons name="flash" size={24} color={theme.colors.primary} />
          </View>

          {/* Opponent */}
          <View style={styles.playerCard}>
            <LinearGradient
              colors={[theme.colors.secondary, theme.colors.primary]}
              style={styles.playerAvatar}
            >
              <Ionicons name="sparkles" size={32} color={theme.colors.text} />
            </LinearGradient>
            <Text style={styles.playerName}>{opponentName}</Text>
            {opponentLastWord && (
              <View style={styles.wordBubble}>
                <Text 
                  style={[styles.wordBubbleText, { fontSize: syncedFontSize }]}
                  numberOfLines={1}
                >
                  {opponentLastWord}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* History - TERS SIRALI (son roundlar üstte) */}
        <ScrollView style={styles.historyScroll} contentContainerStyle={styles.historyContent}>
          <Text style={styles.historyTitle}>Round History</Text>
          {gameStatus.rounds.length > 0 ? (
            [...gameStatus.rounds].reverse().map((round) => {
              // Her round için o round'un kelimelerine göre font boyutu hesapla
              const roundMaxLength = Math.max(
                round.player1_word?.length || 0,
                round.player2_word?.length || 0
              );
              const roundFontSize = calculateFontSize(roundMaxLength);
              
              return (
                <View key={round.round} style={styles.historyCard}>
                  <Text style={styles.historyRoundNum}>Round {round.round}</Text>
                  <View style={styles.historyWordsRow}>
                    <Text style={[styles.historyWord, { fontSize: roundFontSize }]}>
                      {round.player1_word}
                    </Text>
                    <Text style={styles.historySep}>+</Text>
                    <Text style={[styles.historyWord, { fontSize: roundFontSize }]}>
                      {round.player2_word}
                    </Text>
                  </View>
                </View>
              );
            })
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
  roundBadge: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
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
  playersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background,
  },
  playerCard: {
    alignItems: 'center',
    flex: 1,
  },
  playerAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  playerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  wordBubble: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xs,
    maxWidth: 140,
  },
  wordBubbleText: {
    fontWeight: 'bold',
    color: theme.colors.primary,
    textAlign: 'center',
  },
  vsContainer: {
    marginHorizontal: theme.spacing.md,
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
