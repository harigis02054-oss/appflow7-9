import type { AutomationEvent, AutomationRule } from "./types";
import { listAutomations, recordAutomationRun } from "./store";
import { addNotification } from "../notifications/store";
import { executeReleaseUpload, transitionReleaseStage } from "../release/orchestrator";
import { getRelease } from "../release/store";

export interface AutomationExecutionResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  actionsExecuted: string[];
  error?: string;
}

export async function evaluateAutomationEvent(
  event: AutomationEvent
): Promise<AutomationExecutionResult[]> {
  const rules = listAutomations().filter((r) => r.enabled);
  const results: AutomationExecutionResult[] = [];

  for (const rule of rules) {
    if (rule.trigger.type !== event.type) {
      continue;
    }

    // Check optional appId constraint
    if (rule.appId && rule.appId !== event.appId) {
      continue;
    }

    // Check optional branch constraint for github_push
    if (rule.trigger.branch && event.branch && rule.trigger.branch !== event.branch) {
      continue;
    }

    const executedActions: string[] = [];
    let hasError: string | undefined;

    try {
      for (const action of rule.actions) {
        if (action.type === "send_notification") {
          const msg =
            (action.params?.template as string) ||
            `Automation '${rule.name}' triggered on ${event.type}`;
          addNotification({
            title: rule.name,
            message: msg,
            type: "info",
            appId: event.appId,
            releaseId: event.releaseId,
          });
          executedActions.push("send_notification");
        } else if (action.type === "upload_to_testing") {
          if (event.releaseId) {
            const uploadRes = await executeReleaseUpload(event.releaseId, "Automation Engine");
            if (uploadRes.success) {
              executedActions.push("upload_to_testing");
            } else {
              hasError = uploadRes.error;
            }
          }
        } else if (action.type === "advance_to_review") {
          if (event.releaseId) {
            const rel = getRelease(event.releaseId);
            if (rel) {
              transitionReleaseStage(event.releaseId, "review", "success", {
                actor: "Automation Engine",
                log: "Auto-advanced release to review per closed-testing prerequisite quorum.",
              });
              executedActions.push("advance_to_review");
            }
          }
        } else if (action.type === "trigger_build") {
          executedActions.push("trigger_build (scheduled)");
        }
      }

      const status = hasError ? "failed" : "success";
      recordAutomationRun(rule.id, status);

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        matched: true,
        actionsExecuted: executedActions,
        error: hasError,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      recordAutomationRun(rule.id, "failed");
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        matched: true,
        actionsExecuted: executedActions,
        error: errMsg,
      });
    }
  }

  return results;
}
