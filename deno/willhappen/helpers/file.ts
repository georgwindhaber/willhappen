import { WillhabenAppartment } from "../types/general.ts";

export const writeAppartemntsToFile = async (
  filePath: string,
  appartments: Array<WillhabenAppartment>
) => {
  try {
    await Deno.writeTextFile(filePath, JSON.stringify(appartments, null, 2));
  } catch (error) {
    console.error(`Error writing headlines to ${filePath}:`, error);
  }
};

export const generateStorageFilePath = (
  name: string,
  storageDirectory: string
): string => {
  const fileName = `${name
    .toLowerCase()
    .replace(/\s+/g, "-")}-appartmetns.json`;
  return `${storageDirectory}/${fileName}`;
};

// Pure function to ensure storage directory exists
export const ensureStorageDirectory = async (directory: string) => {
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
export const readAppartmentsFromFile = async (
  filePath: string
): Promise<Array<WillhabenAppartment>> => {
  try {
    const data = await Deno.readTextFile(filePath);
    return JSON.parse(data);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return [];
    }
    console.error(`Error reading appartments from ${filePath}:`, error);
    return [];
  }
};
