import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

// Types
interface WebsiteConfig {
  name: string;
  url: string;
  discordWebhookUrl: string;
  storageFile?: string; // Optional, will be auto-generated if not provided
}

interface MonitorConfig {
  websites: WebsiteConfig[];
  checkIntervalMinutes: number;
  storageDirectory: string;
}

// Configuration - Add your websites here
const config: MonitorConfig = {
  checkIntervalMinutes: 5,
  storageDirectory: "./storage",
  websites: [
    {
      name: "Tech News",
      url: "https://example-tech.com",
      discordWebhookUrl:
        "https://discord.com/api/webhooks/YOUR_TECH_WEBHOOK_URL",
    },
    {
      name: "Gaming News",
      url: "https://example-gaming.com",
      discordWebhookUrl:
        "https://discord.com/api/webhooks/YOUR_GAMING_WEBHOOK_URL",
    },
    {
      name: "Business News",
      url: "https://example-business.com",
      discordWebhookUrl:
        "https://discord.com/api/webhooks/YOUR_BUSINESS_WEBHOOK_URL",
      storageFile: "custom-business-headlines.json", // Custom storage file name
    },
  ],
};

// Pure function to generate storage file path
const generateStorageFilePath = (
  website: WebsiteConfig,
  storageDirectory: string
): string => {
  const fileName =
    website.storageFile ||
    `${website.name.toLowerCase().replace(/\s+/g, "-")}-headlines.json`;
  return `${storageDirectory}/${fileName}`;
};

// Pure function to ensure storage directory exists
const ensureStorageDirectory = async (directory: string): Promise<void> => {
  try {
    await Deno.stat(directory);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      await Deno.mkdir(directory, { recursive: true });
      console.log(`Created storage directory: ${directory}`);
    } else {
      console.error("Error checking/creating storage directory:", error);
    }
  }
};

// Pure functions for file operations
const readHeadlinesFromFile = async (filePath: string): Promise<string[]> => {
  try {
    const data = await Deno.readTextFile(filePath);
    return JSON.parse(data);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return [];
    }
    console.error(`Error reading headlines from ${filePath}:`, error);
    return [];
  }
};

const writeHeadlinesToFile = async (
  filePath: string,
  headlines: string[]
): Promise<void> => {
  try {
    await Deno.writeTextFile(filePath, JSON.stringify(headlines, null, 2));
  } catch (error) {
    console.error(`Error writing headlines to ${filePath}:`, error);
  }
};

// Pure function to extract headlines from HTML using Deno DOM
const extractHeadlinesFromHtml = (html: string): string[] => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return [];

  const h3Elements = doc.querySelectorAll("h3");
  const headlines: string[] = [];

  h3Elements.forEach((element) => {
    const text = element.textContent?.trim();
    if (text) {
      headlines.push(text);
    }
  });

  return headlines;
};

// Pure function to find new headlines
const findNewHeadlines = (
  currentHeadlines: string[],
  previousHeadlines: string[]
): string[] => {
  const previousSet = new Set(previousHeadlines);
  return currentHeadlines.filter((headline) => !previousSet.has(headline));
};

// Pure function to create Discord embed payload
const createDiscordEmbed = (headlines: string[], website: WebsiteConfig) => ({
  embeds: [
    {
      title: `🆕 New Headlines from ${website.name}!`,
      description: headlines.map((headline) => `• ${headline}`).join("\n"),
      color: 0x00ff00,
      timestamp: new Date().toISOString(),
      url: website.url,
      footer: {
        text: `Monitored from ${new URL(website.url).hostname}`,
      },
    },
  ],
});

// Async function to fetch website content using Deno's built-in fetch
const fetchWebsiteContent = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.error(`HTTP error ${response.status} for ${url}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error(`Error fetching content from ${url}:`, error);
    return null;
  }
};

// Async function to send Discord notification using fetch
const sendDiscordNotification = async (
  webhookUrl: string,
  payload: object
): Promise<boolean> => {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (error) {
    console.error(
      `Error sending Discord notification to ${webhookUrl}:`,
      error
    );
    return false;
  }
};

// Function to check headlines for a single website
const checkWebsiteHeadlines = async (
  website: WebsiteConfig,
  storageDirectory: string
): Promise<void> => {
  const storageFilePath = generateStorageFilePath(website, storageDirectory);

  console.log(`\n--- Checking ${website.name} ---`);

  // Load previous headlines
  const previousHeadlines = await readHeadlinesFromFile(storageFilePath);
  console.log(
    `Loaded ${previousHeadlines.length} previous headlines for ${website.name}`
  );

  // Fetch current content
  console.log(`Fetching content from ${website.url}...`);
  const htmlContent = await fetchWebsiteContent(website.url);
  if (!htmlContent) {
    console.log(`Failed to fetch content from ${website.name}`);
    return;
  }

  // Extract current headlines
  const currentHeadlines = extractHeadlinesFromHtml(htmlContent);
  console.log(
    `Found ${currentHeadlines.length} h3 headlines on ${website.name}`
  );

  if (currentHeadlines.length === 0) {
    console.log(`No headlines found on ${website.name}`);
    return;
  }

  // Find new headlines
  const newHeadlines = findNewHeadlines(currentHeadlines, previousHeadlines);

  if (newHeadlines.length > 0) {
    console.log(
      `Found ${newHeadlines.length} new headlines on ${website.name}:`
    );
    newHeadlines.forEach((headline) => console.log(`  - ${headline}`));

    // Send Discord notification
    const embedPayload = createDiscordEmbed(newHeadlines, website);
    const notificationSent = await sendDiscordNotification(
      website.discordWebhookUrl,
      embedPayload
    );

    if (notificationSent) {
      console.log(`Discord notification sent successfully for ${website.name}`);

      // Update stored headlines with all current headlines
      await writeHeadlinesToFile(storageFilePath, currentHeadlines);
    } else {
      console.log(`Failed to send Discord notification for ${website.name}`);
    }
  } else {
    console.log(`No new headlines found on ${website.name}`);
  }
};

// Function to check all websites
const checkAllWebsites = async (config: MonitorConfig): Promise<void> => {
  console.log(`\n=== Checking ${config.websites.length} websites ===`);

  // Process websites sequentially to avoid overwhelming servers
  for (const website of config.websites) {
    try {
      await checkWebsiteHeadlines(website, config.storageDirectory);
    } catch (error) {
      console.error(`Error checking ${website.name}:`, error);
    }
  }

  console.log("=== Finished checking all websites ===\n");
};

// Function to validate configuration
const validateConfig = (config: MonitorConfig): boolean => {
  if (!config.websites || config.websites.length === 0) {
    console.error("Error: No websites configured");
    return false;
  }

  for (const website of config.websites) {
    if (!website.name || !website.url || !website.discordWebhookUrl) {
      console.error(
        `Error: Invalid configuration for website: ${JSON.stringify(website)}`
      );
      return false;
    }

    try {
      new URL(website.url);
    } catch {
      console.error(`Error: Invalid URL for ${website.name}: ${website.url}`);
      return false;
    }
  }

  return true;
};

// Function to create a monitoring interval
const createMonitoringInterval = (config: MonitorConfig): number => {
  const intervalMs = config.checkIntervalMinutes * 60 * 1000;

  return setInterval(async () => {
    try {
      await checkAllWebsites(config);
    } catch (error) {
      console.error("Error during monitoring check:", error);
    }
  }, intervalMs);
};

// Function to start the monitoring process
const startMonitoring = async (config: MonitorConfig): Promise<void> => {
  console.log("Starting multi-website monitor...");
  console.log(`Monitoring ${config.websites.length} websites:`);

  config.websites.forEach((website, index) => {
    console.log(`  ${index + 1}. ${website.name} - ${website.url}`);
  });

  console.log(`Check interval: ${config.checkIntervalMinutes} minutes`);
  console.log(`Storage directory: ${config.storageDirectory}`);

  // Validate configuration
  if (!validateConfig(config)) {
    throw new Error("Invalid configuration");
  }

  // Ensure storage directory exists
  await ensureStorageDirectory(config.storageDirectory);

  // Initial check
  await checkAllWebsites(config);

  // Set up periodic checking
  createMonitoringInterval(config);

  console.log("Monitor is running... Press Ctrl+C to stop");

  // Keep the program running
  await new Promise(() => {});
};

// Function to handle graceful shutdown
const setupGracefulShutdown = (): void => {
  const shutdown = () => {
    console.log("\nShutting down gracefully...");
    Deno.exit(0);
  };

  // Handle Ctrl+C
  Deno.addSignalListener("SIGINT", shutdown);

  // Handle terminate signal (Unix)
  if (Deno.build.os !== "windows") {
    Deno.addSignalListener("SIGTERM", shutdown);
  }
};

// Main execution function
const main = async (): Promise<void> => {
  setupGracefulShutdown();

  try {
    await startMonitoring(config);
  } catch (error) {
    console.error("Error in main:", error);
    Deno.exit(1);
  }
};

// Start the monitor
if (import.meta.main) {
  await main();
}
