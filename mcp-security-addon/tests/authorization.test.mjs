import test from "node:test";
import assert from "node:assert/strict";
import { TargetSchema, UrlSchema, isAuthorizedTarget } from "../dist/util/validation.js";
import { registerAllSecurityTools } from "../dist/tools/index.js";

test("no network target is authorized without operator allowlist", () => {
  delete process.env.SECURITY_ADDON_ALLOWED_TARGET_IPS;
  assert.equal(isAuthorizedTarget("127.0.0.1"), false);
  assert.equal(TargetSchema.safeParse("8.8.8.8").success, false);
  assert.equal(UrlSchema.safeParse("https://127.0.0.1/").success, false);
});

test("exact authorized IP works, others and hostnames fail", () => {
  process.env.SECURITY_ADDON_ALLOWED_TARGET_IPS = "192.0.2.10";
  assert.equal(TargetSchema.safeParse("192.0.2.10").success, true);
  for (const value of [
    "192.0.2.11", "192.0.2.10/24", "localhost",
    "169.254.169.254", "example.com", "192.0.2.10;echo",
    "127.0.0.1", "10.0.0.1", "::1",
  ]) assert.equal(TargetSchema.safeParse(value).success, false, value);
});

test("URL authorization refuses DNS, metadata, credentials and HTTP", () => {
  process.env.SECURITY_ADDON_ALLOWED_TARGET_IPS = "192.0.2.10";
  assert.equal(UrlSchema.safeParse("https://192.0.2.10/").success, true);
  for (const url of [
    "https://example.com/", "https://localhost/",
    "http://192.0.2.10/", "https://name:pwd@192.0.2.10/",
    "https://169.254.169.254/latest/meta-data",
    "https://192.0.2.10/#frag",
  ]) assert.equal(UrlSchema.safeParse(url).success, false, url);
});

test("registry exposes only two separately scoped Nmap tools", () => {
  const names = [];
  const server = { tool: (name) => { names.push(name); } };
  registerAllSecurityTools(server);
  assert.deepEqual(names, ["nmap_scan", "nmap_discovery"]);
  assert.equal(names.includes("sqlmap_scan"), false);
  assert.equal(names.includes("http_headers_security"), false);
});
