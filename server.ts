import Fastify from "fastify";
import axios from "axios";
import * as cheerio from "cheerio";
import { execSync } from "child_process";
import { promises as fs } from "fs";
import path from "path";

interface HeadlineData {
  timestamp: string;
  headlines: string[];
}

class WebsiteMonitor {
  private readonly dataFile = path.join(process.cwd(), "headlines.json");
  private readonly targetUrl: string;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(url: string) {
    this.targetUrl = url;
  }

  async start(): Promise<void> {
    console.log(`Starting monitor for ${this.targetUrl}`);

    this.playSound("start");

    // Run initial check
    await this.checkForUpdates();

    // Set up interval for every 3.5 minutes
    this.intervalId = setInterval(async () => {
      await this.checkForUpdates();
    }, 1000 * 60 * 3.5);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("Monitor stopped");
    }
  }

  private async checkForUpdates(): Promise<void> {
    try {
      console.log(`Checking for updates at ${new Date().toISOString()}`);

      const headlines = await this.fetchHeadlines();
      const previousData = await this.loadPreviousData();

      const currentData: HeadlineData = {
        timestamp: new Date().toISOString(),
        headlines: headlines,
      };

      // Save current data
      await this.saveData(currentData);

      // Compare with previous data
      if (
        previousData &&
        this.hasNewHeadlines(previousData.headlines, headlines)
      ) {
        const newHeadlines = headlines.filter(
          (h) => !previousData.headlines.includes(h)
        );
        console.log(`New headlines detected: ${newHeadlines.length}`);
        console.log("New headlines:", newHeadlines);

        await this.playSound("success");
        await this.playSound("start");
      } else {
        console.log("No new headlines detected");
        // await this.playSound("error");
      }
    } catch (error) {
      console.error("Error during update check:", error);
    }
  }

  private async fetchHeadlines(): Promise<string[]> {
    try {
      const response = await axios.get(this.targetUrl, {
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      const $ = cheerio.load(response.data);
      const headlines: string[] = [];

      $("h3").each((index, element) => {
        const text = $(element).text().trim();
        if (text) {
          headlines.push(text);
        }
      });

      return headlines;
    } catch (error) {
      console.error("Error fetching headlines:", error);
      return [];
    }
  }

  private async loadPreviousData(): Promise<HeadlineData | null> {
    try {
      const data = await fs.readFile(this.dataFile, "utf-8");
      return JSON.parse(data) as HeadlineData;
    } catch (error) {
      // File doesn't exist or is invalid, return null
      return null;
    }
  }

  private async saveData(data: HeadlineData): Promise<void> {
    try {
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Error saving data:", error);
    }
  }

  private hasNewHeadlines(
    oldHeadlines: string[],
    newHeadlines: string[]
  ): boolean {
    return newHeadlines.some((headline) => !oldHeadlines.includes(headline));
  }

  private async playSound(mode: "success" | "start" | "error"): Promise<void> {
    const soundFilename =
      mode === "success"
        ? "./sounds/alert.mp3"
        : mode === "start"
        ? "./sounds/start.mp3"
        : "./sounds/error.mp3";

    try {
      // Cross-platform sound playing
      const platform = process.platform;

      if (platform === "darwin") {
        // macOS
        execSync(`afplay ${soundFilename}`, {
          stdio: "ignore",
        });
      } else if (platform === "win32") {
        // Windows
        execSync(
          'powershell -c (New-Object Media.SoundPlayer "C:\\Windows\\Media\\notify.wav").PlaySync();',
          { stdio: "ignore" }
        );
      } else if (platform === "linux") {
        // Linux (requires paplay/pulseaudio or aplay/alsa)
        try {
          execSync("paplay /usr/share/sounds/alsa/Front_Left.wav", {
            stdio: "ignore",
          });
        } catch {
          try {
            execSync("aplay /usr/share/sounds/alsa/Front_Left.wav", {
              stdio: "ignore",
            });
          } catch {
            console.log("🔔  (Could not play sound)");
          }
        }
      }
    } catch (error) {
      console.log("🔔 (Could not play sound)");
    }
  }
}

// Fastify server setup
const fastify = Fastify({ logger: true });

// Configuration
const TARGET_URL =
  process.env.TARGET_URL ||
  "https://www.willhaben.at/iad/immobilien/mietwohnungen/mietwohnung-angebote?areaId=117223&areaId=117225&areaId=117226&areaId=117227&areaId=117228&areaId=117229&areaId=117237&ESTATE_SIZE/LIVING_AREA_FROM=42&sfId=b4bea2d3-89cc-4ca8-9b31-dff41d00d387&page=1&rows=30&PRICE_TO=900&searchKey=131&isNavigation=true";
const PORT = parseInt(process.env.PORT || "4567");

// Initialize monitor
const monitor = new WebsiteMonitor(TARGET_URL);

// Routes
fastify.get("/", async (request, reply) => {
  return {
    message: "Website Monitor Server",
    targetUrl: TARGET_URL,
    status: "running",
  };
});

fastify.get("/headlines", async (request, reply) => {
  try {
    const data = await fs.readFile(
      path.join(process.cwd(), "headlines.json"),
      "utf-8"
    );
    return JSON.parse(data);
  } catch (error) {
    return { error: "No headlines data found" };
  }
});

fastify.get("/status", async (request, reply) => {
  return {
    status: "active",
    targetUrl: TARGET_URL,
    lastCheck: new Date().toISOString(),
  };
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully");
  monitor.stop();
  fastify.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down gracefully");
  monitor.stop();
  fastify.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Server listening on port ${PORT}`);
    console.log(`Monitoring: ${TARGET_URL}`);

    // Start the monitor
    await monitor.start();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
