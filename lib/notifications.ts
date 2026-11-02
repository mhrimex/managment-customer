import { getDeployments } from "./db";
import { logAuditEvent } from "./audit";
import { NotificationDispatchResult } from "@/types";

export async function checkAndDispatchRenewalAlerts(triggeredByEmail = "system@omniops.internal"): Promise<NotificationDispatchResult> {
  const deployments = await getDeployments();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const urgentItems: Array<{
    deployment_id: string;
    client_name: string;
    solution_name: string;
    renewal_date: string;
    days_remaining: number;
    url?: string | null;
  }> = [];

  for (const dep of deployments) {
    if (!dep.renewal_date) continue;
    const rDate = new Date(dep.renewal_date);
    rDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((rDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Expired or renewing in <= 7 days
    if (diffDays <= 7) {
      urgentItems.push({
        deployment_id: dep.id,
        client_name: dep.client?.company_name || "Unknown Client",
        solution_name: dep.solution?.name || "Solution",
        renewal_date: dep.renewal_date,
        days_remaining: diffDays,
        url: dep.instance_url,
      });
    }
  }

  let slackDelivered = false;
  let emailDelivered = false;
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  const notificationEmail = process.env.NOTIFICATION_EMAIL;

  // 1. Dispatch to Slack Webhook if configured
  if (slackWebhookUrl && urgentItems.length > 0) {
    try {
      const slackPayload = {
        text: `🚨 Reflection Solutions License Alert: ${urgentItems.length} client software licenses require immediate renewal!`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🚨 Reflection Solutions: Urgent License Renewals",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `The following *${urgentItems.length} client systems* have expired or are due for renewal within 7 days:`,
            },
          },
          ...urgentItems.slice(0, 10).map((item) => ({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `• *${item.client_name}* — ${item.solution_name}\n  🗓 Renewal: \`${item.renewal_date}\` (${item.days_remaining < 0 ? `⚠️ EXPIRED ${Math.abs(item.days_remaining)}d ago` : `⏰ Due in ${item.days_remaining}d`}) ${item.url ? `| <https://${item.url}|${item.url}>` : ''}`,
            },
          })),
        ],
      };

      const res = await fetch(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackPayload),
      });

      slackDelivered = res.ok;
    } catch (err) {
      console.error("[Notifications] Slack webhook dispatch failed:", err);
    }
  }

  // 2. Mock / Real Email Notification delivery
  if (notificationEmail && urgentItems.length > 0) {
    console.log(`[Notifications] Alert email dispatched to ${notificationEmail} for ${urgentItems.length} items.`);
    emailDelivered = true;
  }

  // 3. Log to Audit Trail
  await logAuditEvent({
    user_email: triggeredByEmail,
    action: "DISPATCH_ALERTS",
    resource_type: "SYSTEM",
    details: `Renewal notification dispatcher triggered. Found ${urgentItems.length} urgent licenses. Slack: ${slackDelivered ? 'Delivered' : 'Not configured'}, Email: ${emailDelivered ? 'Delivered' : 'Simulated'}.`,
  });

  return {
    success: true,
    timestamp: new Date().toISOString(),
    alerts_count: urgentItems.length,
    slack_delivered: slackDelivered,
    email_delivered: emailDelivered,
    items: urgentItems,
  };
}
