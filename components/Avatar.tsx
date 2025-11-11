import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

interface AvatarProps {
  avatar?: string;
  size?: number;
  style?: any;
}

export default function Avatar({ avatar, size = 60, style }: AvatarProps) {
  const isEmoji = avatar && avatar.length <= 2; // Emoji are 1-2 characters
  const isImage = avatar && avatar.startsWith('data:image');

  if (isImage) {
    // Photo avatar
    return (
      <Image
        source={{ uri: avatar }}
        style={[
          styles.imageAvatar,
          { width: size, height: size, borderRadius: size / 2 },
          style,
        ]}
      />
    );
  }

  if (isEmoji) {
    // Emoji avatar
    return (
      <View
        style={[
          styles.emojiContainer,
          { width: size, height: size, borderRadius: size / 2 },
          style,
        ]}
      >
        <Text style={[styles.emojiText, { fontSize: size * 0.5 }]}>{avatar}</Text>
      </View>
    );
  }

  // Default gradient avatar
  return (
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.secondary]}
      style={[
        styles.defaultAvatar,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Ionicons name="person" size={size * 0.5} color={theme.colors.text} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  imageAvatar: {
    backgroundColor: theme.colors.cardBg,
  },
  emojiContainer: {
    backgroundColor: theme.colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    textAlign: 'center',
  },
  defaultAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
