export type NotificationType = "info" | "success" | "warning" | "error";

export interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  appId?: string;
  releaseId?: string;
  read: boolean;
  createdAt: string;
}
