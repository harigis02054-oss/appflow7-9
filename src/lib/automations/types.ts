export type AutomationTriggerType =
  | "github_push"
  | "build_success"
  | "testing_completed"
  | "cron_schedule";

export type AutomationActionType =
  | "trigger_build"
  | "upload_to_testing"
  | "advance_to_review"
  | "send_notification";

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  appId?: string; // If undefined, applies to all apps
  trigger: {
    type: AutomationTriggerType;
    branch?: string;
    cron?: string;
  };
  actions: {
    type: AutomationActionType;
    params?: Record<string, unknown>;
  }[];
  enabled: boolean;
  lastRunAt?: string;
  lastStatus?: "success" | "failed" | "skipped";
  createdAt: string;
}

export interface AutomationEvent {
  type: AutomationTriggerType;
  appId: string;
  branch?: string;
  commitSha?: string;
  releaseId?: string;
  buildId?: string;
  timestamp: string;
}
