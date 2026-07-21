import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.argv[2];
const outputDir = path.resolve(process.argv[3] ?? "docs/evidence/g6/screenshots");
const debugOrigin = process.argv[4] ?? "http://127.0.0.1:9225";

if (!baseUrl) throw new Error("Usage: node scripts/edge-g6-qa.mjs <preview-url> [output-dir] [debug-origin]");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const json = (value) => JSON.stringify(value);
const results = { baseUrl, browser: null, screenshots: [], checks: [], startedAt: new Date().toISOString() };

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

async function waitFor(expression, label, timeoutMs = 20_000) {
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

async function setViewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await delay(150);
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

async function fillTextArea(value) {
  const changed = await evaluate(`(() => {
    const target = document.querySelector("textarea#reject-reason");
    if (!target) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(target, ${json(value)});
    target.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
  if (!changed) throw new Error("Rejection textarea not found");
}

async function screenshot(name) {
  const capture = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const bytes = Buffer.from(capture.data, "base64");
  const file = path.join(outputDir, name);
  await writeFile(file, bytes);
  results.screenshots.push({ file: path.relative(process.cwd(), file).replaceAll("\\", "/"), sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
}

async function bodyIncludes(text) {
  return evaluate(`document.body.innerText.includes(${json(text)})`);
}

async function record(name, passed, detail) {
  results.checks.push({ name, passed: Boolean(passed), detail });
  if (!passed) throw new Error(`${name}: ${detail}`);
}

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

try {
  await setViewport(390, 844);
  await navigate(`${baseUrl}/student/jobs`);
  await waitFor('document.body.innerText.includes("五条合成演示班次") && document.body.innerText.includes("5 / 5 条")', "five jobs");
  await record("Edge岗位首页", await bodyIncludes("入库分拣"), "J-01 first path visible");
  await screenshot("01-jobs-390.png");

  await clickJ01Detail();
  await waitFor('document.body.innerText.includes("立即报名")', "J-01 detail");
  await clickText("立即报名", "button");
  await waitFor('document.body.innerText.includes("确认报名 入库分拣")', "application modal");
  await clickText("确认报名", "button");
  await waitFor('document.body.innerText.includes("仍可取消报名")', "pending application");
  await screenshot("02-cancel-pending-390.png");

  await send("Network.setBlockedURLs", { urls: ["*supabase.co/*"] });
  await clickText("取消报名", "button");
  await waitFor('document.body.innerText.includes("确认取消这条报名？")', "cancel modal");
  await clickText("确认取消报名", "button");
  await waitFor('document.body.innerText.includes("取消未完成") || document.body.innerText.includes("取消报名失败")', "cancel network error");
  await record("取消失败不伪造成功", await bodyIncludes("待招聘方确认") && !(await bodyIncludes("报名已取消，当前记录只读")), "pending preserved while Supabase is blocked");
  await screenshot("03-cancel-network-error-390.png");

  await send("Network.setBlockedURLs", { urls: [] });
  await waitFor('[...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "确认取消报名" && !button.disabled)', "cancel retry enabled");
  await clickText("确认取消报名", "button");
  await waitFor('document.body.innerText.includes("报名已取消，当前记录只读")', "cancelled terminal state");
  await screenshot("04-cancelled-390.png");

  await clickText("重置Demo", "button");
  await waitFor('document.body.innerText.includes("确认恢复演示基线？")', "reset modal");
  await clickText("确认重置", "button");
  await waitFor('document.body.innerText.includes("5/5 人") && document.body.innerText.includes("查看详情")', "reset baseline");

  await clickJ01Detail();
  await waitFor('document.body.innerText.includes("立即报名")', "rejection application detail");
  await clickText("立即报名", "button");
  await waitFor('document.body.innerText.includes("确认报名 入库分拣")', "rejection application modal");
  await clickText("确认报名", "button");
  await waitFor('document.body.innerText.includes("仍可取消报名")', "rejection pending application");
  await clickText("招聘方端", "button");
  await waitFor('document.body.innerText.includes("待处理报名") && document.body.innerText.includes("确认报名")', "employer dashboard");
  await clickText("确认报名", "a");
  await waitFor('document.body.innerText.includes("拒绝报名")', "employer decision page");
  await clickText("拒绝报名", "button");
  await waitFor('document.body.innerText.includes("填写未通过原因")', "rejection modal");
  await record("拒绝原因必填", await evaluate('document.querySelector("button.danger-button")?.disabled === true'), "empty rejection submit disabled");
  await screenshot("05-reject-empty-390.png");
  const reason = "该班次临时调整为需要夜间作业经验";
  await fillTextArea(reason);
  await waitFor('document.querySelector("textarea#reject-reason")?.value.length > 0 && [...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "确认拒绝报名" && !button.disabled)', "valid rejection reason");
  await clickText("确认拒绝报名", "button");
  await waitFor('document.body.innerText.includes("当前记录已终止") && document.body.innerText.includes("该班次临时调整为需要夜间作业经验")', "rejected employer state");
  await screenshot("06-rejected-employer-390.png");

  await clickText("学生端", "button");
  await waitFor('document.body.innerText.includes("五条合成演示班次")', "student jobs after rejection");
  await clickText("我的报名", "a");
  await waitFor('document.body.innerText.includes("报名未通过，当前记录只读") && document.body.innerText.includes("该班次临时调整为需要夜间作业经验")', "student rejection reason");
  await screenshot("07-rejected-student-390.png");

  await send("Network.setBlockedURLs", { urls: ["*supabase.co/*"] });
  await clickText("刷新状态", "button");
  await waitFor('document.body.innerText.includes("刷新失败")', "stale-data refresh error");
  await record("刷新失败保留真实数据", await bodyIncludes("报名未通过，当前记录只读") && await bodyIncludes(reason), "rejected record and reason remain visible");
  await screenshot("08-refresh-network-error-390.png");
  await send("Network.setBlockedURLs", { urls: [] });

  await send("Network.setBlockedURLs", { urls: ["*supabase.co/*"] });
  await send("Storage.clearDataForOrigin", { origin: new URL(baseUrl).origin, storageTypes: "all" });
  await navigate(`${baseUrl}/student/jobs`);
  await waitFor('document.body.innerText.includes("云端连接失败") && document.body.innerText.includes("重新连接")', "bootstrap network error");
  await screenshot("09-bootstrap-network-error-390.png");
  await send("Network.setBlockedURLs", { urls: [] });
  await clickText("重新连接", "button");
  await waitFor('document.body.innerText.includes("五条合成演示班次")', "bootstrap recovery");
  await record("网络恢复重试", await bodyIncludes("5 / 5 条"), "five jobs restored after unblocking Supabase");

  await setViewport(375, 812);
  await screenshot("10-jobs-375.png");
  const metrics375 = await evaluate('({clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth})');
  await setViewport(768, 1024);
  await screenshot("11-jobs-768.png");
  const metrics768 = await evaluate('({clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth})');
  await setViewport(1440, 900);
  await screenshot("12-jobs-1440.png");
  const metrics1440 = await evaluate('({clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth})');
  await record("四视口无横向溢出", [metrics375, metrics768, metrics1440].every((item) => item.clientWidth === item.scrollWidth), { metrics375, metrics768, metrics1440 });
  results.completedAt = new Date().toISOString();
  results.passed = true;
} catch (error) {
  results.completedAt = new Date().toISOString();
  results.passed = false;
  results.error = error instanceof Error ? error.stack : String(error);
  try { await send("Network.setBlockedURLs", { urls: [] }); } catch {}
} finally {
  const resultFile = path.join(outputDir, "edge-g6-results.json");
  await writeFile(resultFile, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  socket.close();
}

if (!results.passed) throw new Error(results.error ?? "Edge G6 QA failed");
console.log(JSON.stringify(results, null, 2));
