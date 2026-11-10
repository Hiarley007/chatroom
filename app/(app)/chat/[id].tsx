import { Ionicons } from '@expo/vector-icons';
import { EmojiKeyboard } from '@softwhere-uz/react-native-emoji-keyboard';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { EmptyState, ErrorState, LoadingView } from '@/components/StateViews';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/Avatar';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  useDirectConversations,
  useDirectMessages,
  useSendDirectAudio,
  useSendDirectText,
} from '@/hooks/useDirectChats';
import { useDirectContactPresence } from '@/hooks/usePresence';
import { useStyles } from '@/hooks/useStyles';
import type { Theme } from '@/theme';
import type { DirectMessage } from '@/services/directChats';
import { getDirectAudioUrl, markDirectMessagesRead } from '@/services/directChats';
import { formatMessageTime } from '@/utils/messages';
import { directChatErrorMessage, friendlyError } from '@/utils/errors';
import { maxContentWidth } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SINGLE_EMOJI =
  /^(?:\p{Extended_Pictographic}(?:\uFE0F)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?(?:\p{Emoji_Modifier})?)*|\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3)$/u;
const EMOJI_TRANSLATION = {
  favorites: 'Favoritos',
  recently_used: 'Recentes',
  smileys_emotion: 'Carinhas e emoções',
  people_body: 'Pessoas e corpo',
  animals_nature: 'Animais e natureza',
  food_drink: 'Comidas e bebidas',
  travel_places: 'Viagens e lugares',
  activities: 'Atividades',
  objects: 'Objetos',
  symbols: 'Símbolos',
  flags: 'Bandeiras',
  search: 'Buscar emoji',
};

export default function DirectChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Array.isArray(id) ? id[0] : id;
  const { user } = useAuth();
  const userId = user?.id;
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.top + 44 : 0;
  const styles = useStyles(createStyles);
  const toast = useToast();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<DirectMessage>>(null);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishingRecordingRef = useRef(false);
  const [text, setText] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);
  const [recordingAction, setRecordingAction] = useState(false);

  const conversations = useDirectConversations();
  const conversation = conversations.data?.find((item) => item.id === conversationId);
  const friendOnline = useDirectContactPresence(conversation?.friendId);
  const contactName = conversation?.friendName ?? 'Conversa';
  const contactAvatarColor = conversation?.friendAvatarColor ?? colors.accent;
  const contactLastSeenAt = conversation?.friendLastSeenAt ?? null;
  const contactHeaderOptions = {
    title: '',
    headerTitleAlign: 'left' as const,
    headerTitle: () => (
      <ContactHeaderTitle
        name={contactName}
        avatarColor={contactAvatarColor}
        online={friendOnline === true}
        lastSeenAt={contactLastSeenAt}
        statusReady={friendOnline !== null}
      />
    ),
  };
  const messages = useDirectMessages(conversationId);
  const sendText = useSendDirectText(conversationId);
  const sendAudio = useSendDirectAudio(conversationId);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const playerStatus = useAudioPlayerStatus(player);
  const messageRows = useMemo(() => messages.data ?? [], [messages.data]);
  const messageCount = messageRows.length;

  useFocusEffect(
    useCallback(() => {
      if (!userId || messages.isLoading || messageCount === 0) return undefined;
      let active = true;
      void markDirectMessagesRead(conversationId, userId)
        .then(() => {
          if (active) {
            void queryClient.invalidateQueries({
              queryKey: ['direct-messages', conversationId],
            });
            void queryClient.invalidateQueries({ queryKey: ['direct-conversations'] });
          }
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [conversationId, messageCount, messages.isLoading, queryClient, userId]),
  );

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (messageRows.length) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messageRows.length]);

  const finishRecording = useCallback(
    async (knownDurationMs?: number) => {
      if (finishingRecordingRef.current) return;
      finishingRecordingRef.current = true;
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
      setRecordingAction(true);
      const durationMs = knownDurationMs ?? recorderState.durationMillis;
      try {
        await recorder.stop();
        const uri = recorder.uri;
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        if (!uri || durationMs < 500) {
          toast.show('Grave pelo menos meio segundo de áudio.', 'info');
          return;
        }
        await sendAudio.mutateAsync({ uri, durationMs });
      } catch (error) {
        toast.show(friendlyError(error, 'Não foi possível enviar o áudio.'), 'error');
      } finally {
        finishingRecordingRef.current = false;
        setRecordingAction(false);
      }
    },
    [recorder, recorderState.durationMillis, sendAudio, toast],
  );

  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
    };
  }, []);

  if (messages.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={contactHeaderOptions} />
        <LoadingView />
      </Screen>
    );
  }

  if (messages.isError) {
    return (
      <Screen>
        <Stack.Screen options={contactHeaderOptions} />
        <ErrorState
          message={directChatErrorMessage(
            messages.error,
            'Não foi possível carregar as mensagens.',
          )}
          onRetry={() => void messages.refetch()}
        />
      </Screen>
    );
  }

  async function sendTextMessage() {
    const body = text.trim();
    if (!body || sendText.isPending) return;
    setText('');
    setEmojiPickerOpen(false);
    try {
      await sendText.mutateAsync(body);
    } catch (error) {
      setText(body);
      toast.show(friendlyError(error, 'Não foi possível enviar a mensagem.'), 'error');
    }
  }

  async function startRecording() {
    if (recordingAction) return;
    setRecordingAction(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        toast.show('Permita o acesso ao microfone para gravar um áudio.', 'error');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingTimeoutRef.current = setTimeout(
        () => {
          void finishRecording(9 * 60 * 1000);
        },
        9 * 60 * 1000,
      );
    } catch (error) {
      toast.show(friendlyError(error, 'Não foi possível iniciar a gravação.'), 'error');
    } finally {
      setRecordingAction(false);
    }
  }

  async function toggleRecording() {
    if (recorderState.isRecording) {
      await finishRecording();
    } else {
      await startRecording();
    }
  }

  async function playAudio(message: DirectMessage) {
    if (!message.audioPath || audioLoadingId) return;
    if (activeAudioId === message.id && playerStatus.playing) {
      player.pause();
      return;
    }
    if (activeAudioId === message.id && playerStatus.isLoaded) {
      if (playerStatus.didJustFinish) await player.seekTo(0);
      player.play();
      return;
    }

    setAudioLoadingId(message.id);
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const audioUrl = await getDirectAudioUrl(message.audioPath);
      player.replace(audioUrl);
      setActiveAudioId(message.id);
      player.play();
    } catch (error) {
      toast.show(friendlyError(error, 'Não foi possível reproduzir o áudio.'), 'error');
    } finally {
      setAudioLoadingId(null);
    }
  }

  function addEmoji(emoji: string) {
    setText((previous) => `${previous}${emoji}`);
    setEmojiPickerOpen(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <Stack.Screen options={contactHeaderOptions} />
      <View style={styles.inner}>
        <FlatList
          ref={listRef}
          data={messageRows}
          keyExtractor={(message) => message.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <DirectMessageBubble
              message={item}
              isMine={item.senderId === user?.id}
              styles={styles}
              colors={colors}
              isActive={activeAudioId === item.id}
              isPlaying={activeAudioId === item.id && playerStatus.playing}
              isLoading={audioLoadingId === item.id}
              currentTime={activeAudioId === item.id ? playerStatus.currentTime : 0}
              onPlay={() => void playAudio(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <EmptyState
                icon="chatbubble-ellipses-outline"
                title="Comece a conversa"
                message={`Envie uma mensagem para ${conversation?.friendName ?? 'seu amigo'}.`}
              />
            </View>
          }
        />
        {recorderState.isRecording ? (
          <View style={styles.recordingBar}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              Gravando áudio · {formatDuration(recorderState.durationMillis)}
            </Text>
            <Text style={styles.recordingHint}>máximo 9 min · toque para enviar</Text>
          </View>
        ) : null}
        <View style={styles.composer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              emojiPickerOpen ? 'Fechar seletor de emojis' : 'Abrir seletor de emojis'
            }
            onPress={() => setEmojiPickerOpen((open) => !open)}
            style={styles.iconButton}
          >
            <Ionicons name="happy-outline" size={24} color={colors.muted} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escreva uma mensagem"
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            multiline
            maxLength={2000}
            style={styles.input}
            editable={!recorderState.isRecording && !sendAudio.isPending}
            onSubmitEditing={() => void sendTextMessage()}
            returnKeyType="send"
          />
          {text.trim() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enviar mensagem"
              disabled={sendText.isPending}
              onPress={() => void sendTextMessage()}
              style={[styles.sendButton, sendText.isPending && styles.disabled]}
            >
              <Ionicons name="send" size={19} color={colors.onPrimary} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                recorderState.isRecording ? 'Parar e enviar áudio' : 'Gravar áudio'
              }
              disabled={recordingAction || sendAudio.isPending}
              onPress={() => void toggleRecording()}
              style={[
                styles.sendButton,
                recorderState.isRecording && styles.recordingButton,
                (recordingAction || sendAudio.isPending) && styles.disabled,
              ]}
            >
              <Ionicons
                name={recorderState.isRecording ? 'stop' : 'mic'}
                size={21}
                color={colors.onPrimary}
              />
            </Pressable>
          )}
        </View>
      </View>
      <EmojiPickerModal
        visible={emojiPickerOpen}
        dark={isDark}
        onClose={() => setEmojiPickerOpen(false)}
        onSelect={addEmoji}
      />
    </KeyboardAvoidingView>
  );
}

interface DirectMessageBubbleProps {
  message: DirectMessage;
  isMine: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: Theme['colors'];
  isActive: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  onPlay: () => void;
}

function DirectMessageBubble({
  message,
  isMine,
  styles,
  colors,
  isActive,
  isPlaying,
  isLoading,
  currentTime,
  onPlay,
}: DirectMessageBubbleProps) {
  const emojiOnly = message.type === 'text' && SINGLE_EMOJI.test(message.body.trim());
  const duration = message.audioDurationMs ?? 0;
  const playbackMs = isActive ? currentTime * 1000 : 0;
  const displayedTime = isActive && isPlaying ? playbackMs : duration;
  return (
    <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          emojiOnly && styles.emojiOnlyBubble,
        ]}
      >
        {message.type === 'audio' ? (
          <View style={styles.audioMessage}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
              onPress={onPlay}
              style={[styles.audioPlayButton, !isMine && styles.audioPlayButtonTheirs]}
            >
              <Ionicons
                name={isLoading ? 'hourglass-outline' : isPlaying ? 'pause' : 'play'}
                size={20}
                color={isMine ? colors.onPrimary : colors.accent}
              />
            </Pressable>
            <View style={styles.audioInfo}>
              <View style={styles.audioTrack}>
                <View
                  style={[
                    styles.audioProgress,
                    {
                      width: `${isActive && duration ? Math.min(playbackMs / duration, 1) * 100 : 0}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.audioDuration, isMine && styles.timeMine]}>
                {formatDuration(displayedTime)}
              </Text>
            </View>
          </View>
        ) : (
          <Text
            style={[
              styles.messageText,
              isMine && styles.messageTextMine,
              emojiOnly && styles.emojiOnlyText,
            ]}
          >
            {message.body}
          </Text>
        )}
        <View style={[styles.messageFooter, emojiOnly && styles.emojiOnlyFooter]}>
          <Text style={[styles.messageTime, isMine && styles.timeMine]}>
            {formatMessageTime(message.createdAt)}
          </Text>
          {isMine ? (
            <Ionicons
              name="checkmark-done"
              size={15}
              color={message.readAt ? '#7DD3FC' : '#CBD5E1'}
              accessibilityLabel={message.readAt ? 'Mensagem lida' : 'Mensagem enviada'}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatLastSeen(value: string | null): string {
  if (!value) return 'Visto por último indisponível';

  const lastSeen = new Date(value);
  if (Number.isNaN(lastSeen.getTime())) return 'Visto por último indisponível';

  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(lastSeen);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (lastSeen.toDateString() === today.toDateString()) {
    return `Visto por último hoje às ${time}`;
  }
  if (lastSeen.toDateString() === yesterday.toDateString()) {
    return `Visto por último ontem às ${time}`;
  }

  const date = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(lastSeen);
  return `Visto por último em ${date} às ${time}`;
}

function ContactHeaderTitle({
  name,
  avatarColor,
  online,
  lastSeenAt,
  statusReady,
}: {
  name: string;
  avatarColor: string;
  online: boolean;
  lastSeenAt: string | null;
  statusReady: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles(createStyles);

  return (
    <View style={styles.navigationContactHeader}>
      <Avatar username={name} color={avatarColor} size={40} online={online} />
      <View style={styles.navigationContactInfo}>
        <Text style={styles.navigationContactName} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.navigationContactStatusRow}>
          {online ? <View style={styles.navigationContactDot} /> : null}
          <Text
            style={[
              styles.navigationContactStatus,
              online && { color: colors.online },
            ]}
            numberOfLines={1}
          >
            {!statusReady
              ? 'Verificando status…'
              : online
                ? 'Online'
                : formatLastSeen(lastSeenAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function EmojiPickerModal({
  visible,
  dark,
  onClose,
  onSelect,
}: {
  visible: boolean;
  dark: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={modalStyles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar seletor de emojis"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={[modalStyles.panel, dark && modalStyles.panelDark]}>
          <View style={modalStyles.heading}>
            <Text style={[modalStyles.title, dark && modalStyles.titleDark]}>Emojis</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar seletor de emojis"
              onPress={onClose}
              style={modalStyles.closeButton}
            >
              <Ionicons name="close" size={21} color={dark ? '#E2E8F0' : '#334155'} />
            </Pressable>
          </View>
          <View style={modalStyles.keyboard}>
            <EmojiKeyboard
              locale="pt-BR"
              colorScheme={dark ? 'dark' : 'light'}
              translation={EMOJI_TRANSLATION}
              enableRecentlyUsed
              enableSearchBar
              defaultHeight={400}
              onEmojiSelected={({ emoji }) => {
                onSelect(emoji);
                onClose();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = ({ colors, radius, spacing, typography }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    inner: { flex: 1, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
    messageList: {
      padding: spacing.md,
      gap: spacing.sm,
      flexGrow: 1,
      justifyContent: 'flex-end',
    },
    emptyMessages: { flex: 1, minHeight: 280 },
    navigationContactHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      maxWidth: 260,
    },
    navigationContactInfo: { flexShrink: 1, minWidth: 0, gap: 1 },
    navigationContactName: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
    navigationContactStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    navigationContactDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.online,
    },
    navigationContactStatus: { ...typography.small, color: colors.muted, flexShrink: 1 },
    messageRow: { flexDirection: 'row', justifyContent: 'flex-start' },
    messageRowMine: { justifyContent: 'flex-end' },
    bubble: {
      maxWidth: '86%',
      minWidth: 56,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    bubbleMine: { backgroundColor: colors.bubbleMine, borderBottomRightRadius: 4 },
    bubbleTheirs: { backgroundColor: colors.bubbleTheirs, borderBottomLeftRadius: 4 },
    messageText: { ...typography.body, color: colors.text },
    messageTextMine: { color: colors.onPrimary },
    emojiOnlyBubble: {
      backgroundColor: 'transparent',
      paddingHorizontal: 2,
      paddingVertical: 0,
    },
    emojiOnlyText: { fontSize: 50, lineHeight: 58, textAlign: 'center' },
    messageFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 3,
      marginTop: 3,
    },
    emojiOnlyFooter: {
      alignSelf: 'flex-end',
      marginTop: 0,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
    },
    messageTime: { ...typography.small, color: colors.muted, textAlign: 'right' },
    timeMine: { color: '#DBEAFE' },
    audioMessage: {
      width: 190,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    audioPlayButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.22)',
    },
    audioPlayButtonTheirs: { backgroundColor: colors.primarySoft },
    audioInfo: { flex: 1, gap: 5 },
    audioTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(127,127,127,0.35)',
      overflow: 'hidden',
    },
    audioProgress: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
    audioDuration: { ...typography.small, color: colors.text },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      padding: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      ...typography.body,
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      minWidth: 0,
      paddingHorizontal: spacing.md,
      paddingTop: 12,
      paddingBottom: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
    },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    recordingButton: { backgroundColor: colors.danger },
    disabled: { opacity: 0.55 },
    recordingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      backgroundColor: colors.dangerSoft,
    },
    recordingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.danger,
    },
    recordingText: { ...typography.caption, color: colors.dangerText },
    recordingHint: { ...typography.small, color: colors.muted, marginLeft: 'auto' },
  });

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  panel: {
    height: '72%',
    maxHeight: 620,
    minHeight: 390,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  panelDark: { backgroundColor: '#131C2E' },
  heading: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  titleDark: { color: '#F1F5F9' },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  keyboard: { flex: 1, overflow: 'hidden' },
});
