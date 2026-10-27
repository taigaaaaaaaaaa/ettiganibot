import { readFile } from "node:fs/promises";
import { statfs } from "node:fs/promises";
import { cpus, freemem, platform, release, totalmem, uptime } from "node:os";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let previousCpuTimes;
let previousNetworkSample;

function getCpuUsage(cpuList) {
  const current = cpuList.map(({ times }) => ({
    idle: times.idle,
    total: Object.values(times).reduce((sum, value) => sum + value, 0),
  }));
  const previous = previousCpuTimes;
  previousCpuTimes = current;

  if (!previous || previous.length !== current.length) return null;

  const totals = current.reduce(
    (sum, cpu, index) => {
      sum.total += cpu.total - previous[index].total;
      sum.idle += cpu.idle - previous[index].idle;
      return sum;
    },
    { idle: 0, total: 0 },
  );

  if (totals.total <= 0) return null;
  return Math.max(0, Math.min(100, ((totals.total - totals.idle) / totals.total) * 100));
}

function getPhysicalCoreCount(cpuInfo) {
  const physicalCores = new Set();
  const coresPerSocket = new Map();

  for (const block of cpuInfo.split(/\r?\n\s*\r?\n/)) {
    const physicalId = block.match(/^physical id\s*:\s*(.+)$/m)?.[1];
    const coreId = block.match(/^core id\s*:\s*(.+)$/m)?.[1];
    const coreCount = Number(block.match(/^cpu cores\s*:\s*(\d+)$/m)?.[1]);

    if (physicalId !== undefined && coreId !== undefined) {
      physicalCores.add(`${physicalId}:${coreId}`);
    } else if (physicalId !== undefined && Number.isFinite(coreCount)) {
      coresPerSocket.set(physicalId, coreCount);
    }
  }

  if (physicalCores.size > 0) return physicalCores.size;
  if (coresPerSocket.size > 0) {
    return [...coresPerSocket.values()].reduce((sum, count) => sum + count, 0);
  }
  return null;
}

async function getNetworkSample() {
  if (platform() !== "linux") return null;

  const content = await readFile("/proc/net/dev", "utf8");
  const totals = content
    .split(/\r?\n/)
    .slice(2)
    .reduce(
      (sum, line) => {
        const separator = line.indexOf(":");
        if (separator < 0) return sum;

        const values = line
          .slice(separator + 1)
          .trim()
          .split(/\s+/)
          .map(Number);
        if (values.length < 9 || values.some((value) => !Number.isFinite(value))) return sum;

        sum.received += values[0];
        sum.sent += values[8];
        return sum;
      },
      { received: 0, sent: 0 },
    );
  const sampledAt = Date.now();
  const previous = previousNetworkSample;
  previousNetworkSample = { ...totals, sampledAt };

  if (!previous || sampledAt <= previous.sampledAt) {
    return { ...totals, receiveSpeed: null, sendSpeed: null };
  }

  const elapsedSeconds = (sampledAt - previous.sampledAt) / 1000;
  return {
    ...totals,
    receiveSpeed: Math.max(0, (totals.received - previous.received) / elapsedSeconds),
    sendSpeed: Math.max(0, (totals.sent - previous.sent) / elapsedSeconds),
  };
}

export async function GET() {
  const cpuList = cpus();
  const memoryTotal = totalmem();
  const memoryUsed = memoryTotal - freemem();
  const filesystem = await statfs("/");
  const [cpuInfo, network] = await Promise.all([
    readFile("/proc/cpuinfo", "utf8").catch((error) => {
      if (error.code === "ENOENT") return "";
      throw error;
    }),
    getNetworkSample().catch((error) => {
      if (error.code === "ENOENT" && platform() === "linux") return null;
      throw error;
    }),
  ]);
  const cpuModel = cpuList[0]?.model ?? null;
  const storageTotal = filesystem.blocks * filesystem.bsize;
  const storageUsed = (filesystem.blocks - filesystem.bfree) * filesystem.bsize;

  return NextResponse.json(
    {
      system: {
        os: `${platform()} ${release()}`,
        cpuModel,
        physicalCores: getPhysicalCoreCount(cpuInfo),
        threads: cpuList.length,
        memoryTotal,
        storageTotal,
        uptime: uptime(),
        currentTime: new Date().toISOString(),
      },
      metrics: {
        cpuUsage: getCpuUsage(cpuList),
        memoryUsed,
        memoryUsage: memoryTotal > 0 ? (memoryUsed / memoryTotal) * 100 : null,
        storageUsed,
        storageUsage: storageTotal > 0 ? (storageUsed / storageTotal) * 100 : null,
        network,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
