import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { AutomationRule } from "./types";

const BUILDS_DIR = path.join(process.cwd(), ".builds");
const AUTOMATIONS_FILE = path.join(BUILDS_DIR, "automations.json");

function ensureBuildsDir() {
  if (!fs.existsSync(BUILDS_DIR)) {
    fs.mkdirSync(BUILDS_DIR, { recursive: true });
  }
}

export function listAutomations(): AutomationRule[] {
  ensureBuildsDir();
  if (!fs.existsSync(AUTOMATIONS_FILE)) {
    const defaultRules: AutomationRule[] = [
      {
        id: "auto_git_push",
        name: "Auto-Build on Git Push",
        description: "Automatically trigger a clean release compile whenever commits are pushed to the main branch.",
        trigger: {
          type: "github_push",
          branch: "main",
        },
        actions: [
          {
            type: "trigger_build",
          },
          {
            type: "send_notification",
            params: { template: "Automated build triggered for branch main" },
          },
        ],
        enabled: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: "auto_distribute_internal",
        name: "Auto-Distribute to Internal Testing",
        description: "Immediately upload and distribute binary packages to Google Play Internal Testing & Apple TestFlight after build succeeds.",
        trigger: {
          type: "build_success",
        },
        actions: [
          {
            type: "upload_to_testing",
          },
          {
            type: "send_notification",
            params: { template: "Binary package uploaded to internal testing track" },
          },
        ],
        enabled: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: "auto_advance_closed_testing",
        name: "Advance on Closed Testing Quorum",
        description: "Automatically move release to Ready for Review when 12 testers and 14 days closed testing requirement is fulfilled.",
        trigger: {
          type: "testing_completed",
        },
        actions: [
          {
            type: "advance_to_review",
          },
          {
            type: "send_notification",
            params: { template: "12-tester / 14-day requirement met. Release advanced to review." },
          },
        ],
        enabled: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: "auto_nightly_build",
        name: "Nightly Clean Release Pipeline",
        description: "Scheduled daily build to detect regression issues and ensure release health.",
        trigger: {
          type: "cron_schedule",
          cron: "0 0 * * *",
        },
        actions: [
          {
            type: "trigger_build",
          },
        ],
        enabled: false,
        createdAt: new Date().toISOString(),
      },
    ];

    saveAllAutomations(defaultRules);
    return defaultRules;
  }

  try {
    const raw = fs.readFileSync(AUTOMATIONS_FILE, "utf-8");
    return JSON.parse(raw) as AutomationRule[];
  } catch (err) {
    console.error("[automations-store] Failed to read automations.json:", err);
    return [];
  }
}

export function saveAllAutomations(rules: AutomationRule[]) {
  ensureBuildsDir();
  const tempPath = `${AUTOMATIONS_FILE}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(rules, null, 2), "utf-8");
  fs.renameSync(tempPath, AUTOMATIONS_FILE);
}

export function getAutomation(id: string): AutomationRule | null {
  const rules = listAutomations();
  return rules.find((r) => r.id === id) || null;
}

export function toggleAutomation(id: string, enabled: boolean): AutomationRule | null {
  const rules = listAutomations();
  const rule = rules.find((r) => r.id === id);
  if (!rule) return null;
  rule.enabled = enabled;
  saveAllAutomations(rules);
  return rule;
}

export function recordAutomationRun(id: string, status: "success" | "failed" | "skipped"): void {
  const rules = listAutomations();
  const rule = rules.find((r) => r.id === id);
  if (!rule) return;
  rule.lastRunAt = new Date().toISOString();
  rule.lastStatus = status;
  saveAllAutomations(rules);
}

export function createAutomationRule(input: {
  name: string;
  description: string;
  appId?: string;
  trigger: AutomationRule["trigger"];
  actions: AutomationRule["actions"];
}): AutomationRule {
  const rules = listAutomations();
  const newRule: AutomationRule = {
    id: `auto_${crypto.randomBytes(4).toString("hex")}`,
    name: input.name,
    description: input.description,
    appId: input.appId,
    trigger: input.trigger,
    actions: input.actions,
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  rules.push(newRule);
  saveAllAutomations(rules);
  return newRule;
}
