import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TimeoutSchema, sanitizeArg } from "../../util/validation.js";

export function registerMobsfTools(server: McpServer): void {
  server.tool(
    "mobsf_upload_analyze",
    "Upload a mobile app (APK/IPA) to a running MobSF instance and return the analysis report. Requires MOBSF_URL and MOBSF_API_KEY environment variables.",
    {
      file_path: z.string().describe("Absolute path to the APK or IPA file to analyse"),
      timeout_sec: z.number().int().min(30).max(600).default(300),
    },
    async ({ file_path, timeout_sec }) => {
      const mobsfUrl = process.env.MOBSF_URL ?? "http://localhost:8000";
      const apiKey = process.env.MOBSF_API_KEY;
      if (!apiKey) {
        return { content: [{ type: "text", text: "MOBSF_API_KEY environment variable is not set" }] };
      }

      // Step 1: upload
      const formData = new FormData();
      const { readFile } = await import("node:fs/promises");
      const { basename } = await import("node:path");
      const fileBytes = await readFile(sanitizeArg(file_path));
      formData.append("file", new Blob([fileBytes]), basename(file_path));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout_sec * 1000);

      try {
        const uploadResp = await fetch(`${mobsfUrl}/api/v1/upload`, {
          method: "POST",
          headers: { Authorization: apiKey },
          body: formData,
          signal: controller.signal,
        });
        if (!uploadResp.ok) return { content: [{ type: "text", text: `MobSF upload failed: HTTP ${uploadResp.status}` }] };
        const uploadData = await uploadResp.json() as { hash: string };

        // Step 2: scan
        const scanResp = await fetch(`${mobsfUrl}/api/v1/scan`, {
          method: "POST",
          headers: { Authorization: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ hash: uploadData.hash, re_scan: "0" }),
          signal: controller.signal,
        });
        if (!scanResp.ok) return { content: [{ type: "text", text: `MobSF scan failed: HTTP ${scanResp.status}` }] };

        // Step 3: report
        const reportResp = await fetch(`${mobsfUrl}/api/v1/report_json`, {
          method: "POST",
          headers: { Authorization: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ hash: uploadData.hash }),
          signal: controller.signal,
        });
        if (!reportResp.ok) return { content: [{ type: "text", text: `MobSF report failed: HTTP ${reportResp.status}` }] };

        const report = await reportResp.json();
        return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
      } finally {
        clearTimeout(timer);
      }
    }
  );
}
