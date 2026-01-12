import { z } from "zod";
import { defineTool } from "./types.ts";
import { GmailClient } from "../integration/gmail/client.ts";

export const gmailTool = defineTool({
  name: "gmail",
  description: `Interact with Gmail. Actions:
- list: List recent emails
- search: Search emails by query
- read: Read a specific email by ID
- summarize: Get a summary of recent emails
- draft: Create a draft email
Note: Requires Gmail authentication via 'dadgpt auth --google'`,

  parameters: z.object({
    action: z.enum(["list", "search", "read", "summarize", "draft"]),
    query: z.string().optional().describe("Search query for emails"),
    emailId: z.string().optional().describe("Email ID for read action"),
    maxResults: z.number().optional().describe("Maximum number of emails to return"),
    to: z.string().optional().describe("Recipient email for draft"),
    subject: z.string().optional().describe("Subject for draft"),
    body: z.string().optional().describe("Body for draft"),
  }),

  async execute(args, _ctx) {
    // Check authentication
    if (!(await GmailClient.isAuthenticated())) {
      return {
        title: "Gmail Not Configured",
        output: "Gmail is not set up. Run 'dadgpt auth --google' to authenticate with Google.",
        error: true,
      };
    }

    try {
      switch (args.action) {
        case "list":
          return await listEmails(args.maxResults);
        case "search":
          return await searchEmails(args.query, args.maxResults);
        case "read":
          return await readEmail(args.emailId);
        case "summarize":
          return await summarizeEmails(args.maxResults);
        case "draft":
          return await createDraft(args);
        default:
          return {
            title: "Error",
            output: `Unknown action: ${args.action}`,
            error: true,
          };
      }
    } catch (err) {
      return {
        title: "Gmail Error",
        output: `Error: ${(err as Error).message}`,
        error: true,
      };
    }
  },
});

async function listEmails(maxResults?: number) {
  const emails = await GmailClient.listMessages({ maxResults: maxResults ?? 10 });

  if (emails.length === 0) {
    return {
      title: "No Emails",
      output: "No recent emails found.",
    };
  }

  const output = emails
    .map((e) => {
      const date = new Date(e.date).toLocaleDateString();
      const readStatus = e.isRead ? "" : "[UNREAD] ";
      return `${readStatus}${date} - From: ${e.from}\n  Subject: ${e.subject}`;
    })
    .join("\n\n");

  return {
    title: `Recent Emails (${emails.length})`,
    output,
    metadata: { emails },
  };
}

async function searchEmails(query?: string, maxResults?: number) {
  if (!query) {
    return {
      title: "Error",
      output: "Search query is required",
      error: true,
    };
  }

  const emails = await GmailClient.listMessages({
    query,
    maxResults: maxResults ?? 10,
  });

  if (emails.length === 0) {
    return {
      title: "No Results",
      output: `No emails found matching: "${query}"`,
    };
  }

  const output = emails
    .map((e) => {
      const date = new Date(e.date).toLocaleDateString();
      return `${date} - From: ${e.from}\n  Subject: ${e.subject}\n  ID: ${e.id}`;
    })
    .join("\n\n");

  return {
    title: `Search Results (${emails.length})`,
    output,
    metadata: { emails, query },
  };
}

async function readEmail(emailId?: string) {
  if (!emailId) {
    return {
      title: "Error",
      output: "Email ID is required",
      error: true,
    };
  }

  // Try to find in cached emails
  const cached = await GmailClient.getCachedEmails();
  const email = cached.find((e) => e.id === emailId);

  if (!email) {
    return {
      title: "Email Not Found",
      output: `Could not find email with ID: ${emailId}. Try searching first.`,
      error: true,
    };
  }

  const output = `From: ${email.from}
To: ${email.to.join(", ")}
Date: ${new Date(email.date).toLocaleString()}
Subject: ${email.subject}

${email.body || email.snippet}`;

  return {
    title: email.subject,
    output,
    metadata: { email },
  };
}

async function summarizeEmails(maxResults?: number) {
  const emails = await GmailClient.listMessages({ maxResults: maxResults ?? 20 });

  if (emails.length === 0) {
    return {
      title: "No Emails",
      output: "No recent emails to summarize.",
    };
  }

  // Group by sender
  const bySender: Record<string, number> = {};
  let unreadCount = 0;

  for (const email of emails) {
    const sender = email.from.split("<")[0]?.trim() ?? email.from;
    bySender[sender] = (bySender[sender] ?? 0) + 1;
    if (!email.isRead) unreadCount++;
  }

  const topSenders = Object.entries(bySender)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([sender, count]) => `  ${sender}: ${count} emails`)
    .join("\n");

  const output = `Email Summary:
- Total: ${emails.length} emails
- Unread: ${unreadCount}

Top Senders:
${topSenders}`;

  return {
    title: "Email Summary",
    output,
    metadata: { total: emails.length, unread: unreadCount, bySender },
  };
}

async function createDraft(args: {
  to?: string;
  subject?: string;
  body?: string;
}) {
  if (!args.to || !args.subject || !args.body) {
    return {
      title: "Error",
      output: "To, subject, and body are required for creating a draft",
      error: true,
    };
  }

  const draft = await GmailClient.createDraft({
    to: args.to,
    subject: args.subject,
    body: args.body,
  });

  return {
    title: "Draft Created",
    output: `Created draft email to ${args.to} with subject "${args.subject}"`,
    metadata: { draftId: draft.id },
  };
}
