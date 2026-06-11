import { Alert, Platform } from "react-native";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

/**
 * Cross-platform confirmation dialog.
 *
 * On native it uses `Alert.alert` with Cancel/Confirm buttons. On web the
 * button callbacks of `Alert.alert` are unreliable, so it falls back to the
 * browser's native `window.confirm`. This guarantees the confirm callback
 * actually fires on every platform (web, iOS, Android).
 */
export function confirmAction({
  title,
  message = "",
  confirmText = "OK",
  cancelText = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmOptions): void {
  if (Platform.OS === "web") {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== "undefined" && window.confirm(text)) {
      onConfirm();
    } else {
      onCancel?.();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: "cancel", onPress: onCancel },
    {
      text: confirmText,
      style: destructive ? "destructive" : "default",
      onPress: onConfirm,
    },
  ]);
}
