import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.argv[2]?.replace(/\/$/, "");
const outputDir = path.resolve(process.argv[3] ?? "docs/evidence/g7/screenshots");
const debugOrigin = process.argv[4] ?? "http://127.0.0.1:9227";

if (!baseUrl) throw new Error("Usage: node scripts/edge-g7-uat.mjs <production-url> [output-dir] [debug-origin]");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const json = (value) => JSON.stringify(value);
const results = {
  baseUrl,
  browser: null,
  checks: [],
  screenshots: [],
  consoleIssues: [],
  startedAt: new Date().toISOString(),
};

await mkdir(outputDir, { recursive: true });

const version = await fetch(`${debugOrigin}/json/version`).then((response) => response.json());
results.browser = version.Browser;
const targets = await fetch(`${debugOrigin}/json/list`).then((response) => response.json());
const target = targets.find((item) => item.type === "page");
if (!target?.webSocketDebuggerUrl) throw new Error("No Edge page target found");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params.type)) {
    results.consoleIssues.push({ type: message.params.type, args: message.params.args.map((item) => item.value ?? item.description ?? "") });
  }
  if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params.entry.level)) {
    results.consoleIssues.push({ type: message.params.entry.level, text: message.params.entry.text, url: message.params.entry.url });
  }
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(`${message.error.code}: ${message.error.message}`));
  else resolve(message.result);
});

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text ?? "Runtime evaluation failed");
  return response.result?.value;
}

async function waitFor(expression, label, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function navigate(url) {
  await send("Page.navigate", { url });
  await waitFor('document.readyState === "complete"', `document ready: ${url}`);
}

async function reload() {
  await send("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"', "page reload");
}

async function setViewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await delay(100);
}

async function clickText(text, selector = "button,a") {
  const clicked = await evaluate(`(() => {
    const target = [...document.querySelectorAll(${json(selector)})]
      .find((element) => element.textContent.trim() === ${json(text)} && !element.disabled);
    if (!target) return false;
    target.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Clickable text not found: ${text}`);
}

async function clickJ01Detail() {
  const clicked = await evaluate(`(() => {
    const card = [...document.querySelectorAll("article.job-card")]
      .find((element) => element.textContent.includes("J-01 · 合成直招演示岗位"));
    const link = card?.querySelector("a[href*='/student/jobs/']");
    if (!link) return false;
    link.click();
    return true;
  })()`);
  if (!clicked) throw new Error("J-01 detail link not found");
}

async function setInput(selector, value) {
  const changed = await evaluate(`(() => {
    const target = document.querySelector(${json(selector)});
    if (!(target instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(target, ${json(value)});
    target.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
  if (!changed) throw new Error(`Input not found: ${selector}`);
}

async function screenshot(name) {
  const capture = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const bytes = Buffer.from(capture.data, "base64");
  const file = path.join(outputDir, name);
  await writeFile(file, bytes);
  results.screenshots.push({
    file: path.relative(process.cwd(), file).replaceAll("\\", "/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  });
}

async function record(name, passed, detail) {
  results.checks.push({ name, passed: Boolean(passed), detail });
  if (!passed) throw new Error(`${name}: ${JSON.stringify(detail)}`);
}

async function getJ01Href() {
  return evaluate(`(() => {
    const card = [...document.querySelectorAll("article.job-card")]
      .find((element) => element.textContent.includes("J-01 · 合成直招演示岗位"));
    return card?.querySelector("a[href*='/student/jobs/']")?.getAttribute("href") ?? null;
  })()`);
}

async function resetDemo(previousJ01Href = null) {
  await clickText("重置Demo", "button");
  await waitFor('document.body.innerText.includes("确认恢复演示基线？")', "reset confirmation");
  await clickText("确认重置", "button");
  const changedInstance = previousJ01Href
    ? `(() => {
        const card = [...document.querySelectorAll("article.job-card")]
          .find((element) => element.textContent.includes("J-01 · 合成直招演示岗位"));
        return card?.querySelector("a[href*='/student/jobs/']")?.getAttribute("href") !== ${json(previousJ01Href)};
      })()`
    : "true";
  await waitFor(`document.body.innerText.includes("当前匿名会话已重置") && document.body.innerText.includes("5/5 人") && (${changedInstance})`, "reset baseline");
}

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Log.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });

try {
  await setViewport(390, 844);
  await send("Storage.clearDataForOrigin", { origin: new URL(baseUrl).origin, storageTypes: "all" });
  await navigate(`${baseUrl}/student/jobs`);
  await waitFor('document.body.innerText.includes("五条合成演示班次") && document.body.innerText.includes("5 / 5 条")', "anonymous session and five jobs");

  const shell = await evaluate('({ title: document.title, lang: document.documentElement.lang, path: location.pathname, text: document.body.innerText.slice(0, 500) })');
  await record("Production中文应用壳", shell.title === "校园零工平台" && shell.lang === "zh-CN" && shell.path === "/student/jobs", shell);
  await screenshot("01-production-jobs-390.png");

  const staticRoutes = [
    "/",
    "/student/jobs",
    "/student/compare",
    "/student/applications",
    "/employer/dashboard",
    "/employer/applications",
    "/employer/settlements",
  ];
  const routeResults = [];
  for (const route of staticRoutes) {
    await navigate(`${baseUrl}${route}`);
    await waitFor('document.title === "校园零工平台" && document.body.innerText.includes("校园零工平台")', `route shell: ${route}`);
    routeResults.push({ route, path: await evaluate("location.pathname"), hasNotFound: await evaluate('document.body.innerText.includes("404")') });
  }
  await record("根路由与直接子路由", routeResults.every((item) => !item.hasNotFound), routeResults);

  await navigate(`${baseUrl}/student/jobs`);
  await waitFor('document.body.innerText.includes("五条合成演示班次")', "jobs before reset");
  const beforeResetJ01Href = await getJ01Href();
  await resetDemo(beforeResetJ01Href);
  const initialJ01Href = await getJ01Href();

  await clickJ01Detail();
  await waitFor('document.body.innerText.includes("立即报名") && document.body.innerText.includes("工资支付主体")', "transparent J-01 detail");
  await clickText("立即报名", "button");
  await waitFor('document.body.innerText.includes("确认报名 入库分拣")', "application confirmation");
  await clickText("确认报名", "button");
  await waitFor('document.body.innerText.includes("仍可取消报名") && document.querySelectorAll("ol.timeline li").length === 1', "pending with one event");
  await record("学生报名", await evaluate('document.body.innerText.includes("待招聘方确认") && document.querySelectorAll("ol.timeline li").length === 1'), "pending, one event");
  await screenshot("02-production-pending-390.png");

  await reload();
  await waitFor('document.body.innerText.includes("仍可取消报名") && document.querySelectorAll("ol.timeline li").length === 1', "pending reload");
  await clickText("招聘方端", "button");
  await waitFor('document.body.innerText.includes("待处理报名") && document.body.innerText.includes("确认报名")', "employer dashboard pending");
  await clickText("确认报名", "a");
  await waitFor('document.body.innerText.includes("拒绝报名")', "employer application pending");
  await clickText("确认报名", "button");
  await waitFor('document.body.innerText.includes("核定实际工时并确认完工") && document.querySelectorAll("ol.timeline li").length === 2', "confirmed application");
  await record("招聘方确认", await evaluate('document.body.innerText.includes("报名已确认") && document.querySelectorAll("ol.timeline li").length === 2'), "confirmed, two events");
  await screenshot("03-production-confirmed-390.png");

  await setInput("#actual-minutes", "270");
  await waitFor('[...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "确认完工并生成待结算" && !button.disabled)', "valid minutes");
  await clickText("确认完工并生成待结算", "button");
  await waitFor('document.body.innerText.includes("已生成待模拟结算") && document.body.innerText.includes("¥54") && document.querySelectorAll("ol.timeline li").length === 4', "pending settlement with four events");
  await record("完工与数据库计价", await evaluate('document.body.innerText.includes("270 分钟") && document.body.innerText.includes("¥54") && document.querySelectorAll("ol.timeline li").length === 4'), "270 minutes, ¥54, four events");
  await screenshot("04-production-pending-settlement-390.png");

  await clickText("查看待结算", "a");
  await waitFor('document.body.innerText.includes("确认 Demo 模拟结算") && document.body.innerText.includes("¥54")', "settlement page");
  await clickText("确认 Demo 模拟结算", "button");
  await waitFor('document.body.innerText.includes("已结算（Demo模拟）") && document.body.innerText.includes("终态只读")', "settled employer state");
  await record("唯一模拟结算", await evaluate('document.body.innerText.includes("¥54") && document.body.innerText.includes("已结算（Demo模拟）")'), "settled_demo, ¥54");
  await screenshot("05-production-settled-employer-390.png");

  await clickText("学生端", "button");
  await waitFor('document.body.innerText.includes("五条合成演示班次")', "student jobs after settlement");
  await clickText("我的报名", "a");
  await waitFor('document.body.innerText.includes("已结算（Demo模拟）") && document.body.innerText.includes("¥54") && document.querySelectorAll("ol.timeline li").length === 5', "student settled readback");
  const settledReadback = await evaluate('({ eventCount: document.querySelectorAll("ol.timeline li").length, hasAmount: document.body.innerText.includes("¥54"), hasMinutes: document.body.innerText.includes("300 / 270 分钟"), hasDemo: document.body.innerText.includes("不发生真实支付") })');
  await record("学生五事件回读", Object.values(settledReadback).every(Boolean), settledReadback);
  await screenshot("06-production-settled-student-390.png");

  await reload();
  await waitFor('document.body.innerText.includes("已结算（Demo模拟）") && document.querySelectorAll("ol.timeline li").length === 5', "settled reload");
  await record("终态刷新保持", await evaluate('document.body.innerText.includes("¥54") && document.querySelectorAll("ol.timeline li").length === 5'), "state and events survived hard reload");

  await resetDemo(initialJ01Href);
  const resetState = await evaluate(`(() => {
    const card = [...document.querySelectorAll("article.job-card")].find((element) => element.textContent.includes("J-01 · 合成直招演示岗位"));
    return {
      href: card?.querySelector("a[href*='/student/jobs/']")?.getAttribute("href") ?? null,
      hasBaselineSlots: card?.textContent.includes("5/5 人") ?? false,
      hasAppliedCopy: document.body.innerText.includes("查看已报名岗位"),
    };
  })()`);
  await record("终态重置", resetState.href && resetState.href !== initialJ01Href && resetState.hasBaselineSlots && !resetState.hasAppliedCopy, { initialJ01Href, resetState });

  await setViewport(1440, 900);
  await screenshot("07-production-reset-1440.png");
  const viewport = await evaluate('({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })');
  await record("Production桌面无横向溢出", viewport.clientWidth === viewport.scrollWidth, viewport);

  const appConsoleIssues = results.consoleIssues.filter((item) => !String(item.text ?? item.args ?? "").includes("favicon"));
  await record("控制台无应用错误", appConsoleIssues.length === 0, appConsoleIssues);
  results.completedAt = new Date().toISOString();
  results.passed = true;
} catch (error) {
  results.completedAt = new Date().toISOString();
  results.passed = false;
  results.error = error instanceof Error ? error.stack : String(error);
  try {
    results.failureState = await evaluate('({ url: location.href, title: document.title, body: document.body.innerText.slice(0, 2000) })');
  } catch {
    results.failureState = null;
  }
} finally {
  const resultFile = path.join(outputDir, "edge-g7-results.json");
  await writeFile(resultFile, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  socket.close();
}

if (!results.passed) throw new Error(results.error ?? "Edge G7 UAT failed");
console.log(JSON.stringify(results, null, 2));
