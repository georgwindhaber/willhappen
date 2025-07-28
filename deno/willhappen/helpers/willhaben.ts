import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.55/deno-dom-wasm.ts";
import { WillhabenAppartment } from "../types/general.ts";

export const extractDataFromWillhabenSearch = (html: string) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return [];

  const linkElements = doc.querySelectorAll(
    "a[id*=search-result-entry-header]"
  );
  const appartmentData: WillhabenAppartment[] = [];

  linkElements.forEach((linkElement) => {
    const teaserAttributes = linkElement.querySelectorAll(
      "[data-testid*=search-result-entry-teaser-attributes]"
    );

    const priceElement = linkElement.querySelector(
      "[data-testid*=search-result-entry-price]"
    );

    appartmentData.push({
      url: `https://www.willhaben.at${linkElement.getAttribute("href")!}`,
      title: linkElement.querySelector("h3")?.innerText || "(No title)",
      price: priceElement?.innerText || "No price found",
      rooms: teaserAttributes[2].innerText,
      area: teaserAttributes[1].innerText,
      imageUrl:
        linkElement.querySelector("img")?.getAttribute("src") || undefined,
    });
  });

  return appartmentData;
};
