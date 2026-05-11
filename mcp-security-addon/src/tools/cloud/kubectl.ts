import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TimeoutSchema, sanitizeArg } from "../../util/validation.js";

export function registerKubectlTools(server: McpServer): void {
  server.tool(
    "kubectl_enum",
    "Enumerate a Kubernetes cluster: list pods, deployments, services, and RBAC roles. Requires kubectl configured with a valid kubeconfig.",
    {
      namespace: z.string().default("default").describe("Kubernetes namespace, or 'all' for all namespaces"),
      resource: z.enum(["pods", "deployments", "services", "roles", "rolebindings", "clusterroles", "secrets", "configmaps"]).default("pods"),
      timeout_sec: TimeoutSchema,
    },
    async ({ namespace, resource, timeout_sec }) => {
      const nsFlag = namespace === "all" ? ["--all-namespaces"] : ["-n", sanitizeArg(namespace)];
      const args = ["get", sanitizeArg(resource), ...nsFlag, "-o", "wide"];
      const result = await runCommand("kubectl", args, { timeoutMs: timeout_sec * 1000 });
      return { content: [{ type: "text", text: formatResult(`kubectl_enum (${resource})`, result) }] };
    }
  );

  server.tool(
    "kubectl_rbac_audit",
    "Audit RBAC permissions in a Kubernetes cluster for overly permissive roles.",
    {
      namespace: z.string().default("default"),
      timeout_sec: TimeoutSchema,
    },
    async ({ namespace, timeout_sec }) => {
      const nsFlag = namespace === "all" ? ["--all-namespaces"] : ["-n", sanitizeArg(namespace)];
      const args = ["auth", "can-i", "--list", ...nsFlag];
      const result = await runCommand("kubectl", args, { timeoutMs: timeout_sec * 1000 });
      return { content: [{ type: "text", text: formatResult("kubectl_rbac_audit", result) }] };
    }
  );
}
