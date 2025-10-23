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
import { theme } from '../../constants/theme';
import { chatAPI } from '../../utils/api';
import Avatar from '../../components/Avatar';

interface Conversation {
  username: string;
  avatar: string;
  bio: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

export default function ChatsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadConversations = async () => {
    try {
      console.log('🔍 Loading conversations...');
      const response = await chatAPI.getConversations();
      console.log('✅ Conversations response:', response.data);
      console.log('📊 Count:', response.data?.length || 0);
      setConversations(response.data || []);
    } catch (error) {
      console.error('❌ Failed to load conversations', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/chat/${item.username}`)}
    >
      <Avatar avatar={item.avatar} size={50} />
      <View style={styles.details}>
        <View style={styles.header}>
          <Text style={styles.username}>{item.username}</Text>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.last_message || 'Start a conversation'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.cardBg]}
        style={styles.gradient}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Chats</Text>
          <Text style={styles.subtitle}>Chat with users you've synced with</Text>
        </View>

        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.username}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.textSecondary} />
              <Text style={styles.emptyText}>No chats yet</Text>
              <Text style={styles.emptySubtext}>Play games and sync with others to unlock chat!</Text>
            </View>
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
  headerContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
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
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  details: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  unreadBadge: {
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  lastMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.xl * 2,
  },
  emptyText: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: theme.spacing.lg,
  },
  emptySubtext: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
  },
});
